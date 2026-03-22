import { McpServer as MCPServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type {
	AnchorTargetConfig,
	FileDelta,
	SectionDelta,
	AnchorConfig,
	Severity,
	CorpusFileChange,
} from "@anchor_app/core";
import {
	ConfigLoader,
	GitExtractor,
	MarkdownParser,
	SectionDiffer,
	SectionClassifier,
	CorpusTreeDiffer,
	GitTreeDiffer,
	ConsoleLogger,
	type Logger,
} from "@anchor_app/core";

export interface McpServerConfig {
	cwd?: string;
	verbose?: boolean;
}

/**
 * MCP Server for Anchor
 *
 * Exposes Anchor functionality as MCP tools:
 * - anchor_compare_corpus: Compare spec files across git refs
 * - anchor_compare: Compare a single file across git refs
 * - anchor_targets: List configured targets
 * - anchor_baseline_status: Get scope and targets from baseline
 */
export class AnchorMcpServer {
	private server: MCPServer;
	private cwd: string;
	private verbose: boolean;
	private logger: Logger;
	private gitExtractor: GitExtractor;
	private gitTreeDiffer: GitTreeDiffer;
	private corpusDiffer: CorpusTreeDiffer;
	private configLoader: ConfigLoader;
	private parser: MarkdownParser;
	private differ: SectionDiffer;
	private classifier: SectionClassifier;

	constructor(config: McpServerConfig = {}) {
		this.cwd = config.cwd || process.cwd();
		this.verbose = config.verbose || false;
		this.logger = new ConsoleLogger(this.verbose ? "debug" : "info");

		// Initialize dependencies
		this.gitExtractor = new GitExtractor(this.cwd);
		this.gitTreeDiffer = new GitTreeDiffer(this.cwd);
		this.parser = new MarkdownParser();
		this.differ = new SectionDiffer();
		this.corpusDiffer = new CorpusTreeDiffer({
			repoPath: this.cwd,
			gitExtractor: this.gitExtractor,
			gitTreeDiffer: this.gitTreeDiffer,
			parser: this.parser,
			differ: this.differ,
		});
		this.configLoader = new ConfigLoader();
		this.classifier = new SectionClassifier();

		// Initialize MCP server
		this.server = new MCPServer({
			name: "anchor",
			version: "1.0.0",
		});

		this.setupTools();
	}

	private setupTools(): void {
		// Tool 1: Compare Corpus
		this.server.registerTool(
			"anchor_compare_corpus",
			{
				title: "Compare Spec Corpus",
				description:
					"Compare a folder of spec/doc files between two git refs and detect section-level changes. " +
					"Returns deltas for each file in the corpus, classified by severity (BREAKING, BEHAVIORAL, INFORMATIONAL, COSMETIC). " +
					"Use this to understand what spec changes impact implementation targets before writing code.",
				inputSchema: z.object({
					folderPath: z.string().describe(
						"Path to the folder containing spec files (e.g., 'docs/specs', 'spec'). Relative to repo root."
					),
					fromRef: z
						.string()
						.default("main")
						.describe(
							"Git ref to compare from (e.g., 'main', 'HEAD~1', 'v1.0.0'). Defaults to 'main'."
						),
					toRef: z
						.string()
						.default("HEAD")
						.describe(
							"Git ref to compare to (e.g., 'HEAD', 'main', 'feature-branch'). Defaults to 'HEAD'."
						),
					targets: z
						.array(z.string())
						.optional()
						.describe(
							"Optional list of targets to filter results. If provided, only changes affecting these targets are returned."
						),
					format: z
						.enum(["json", "text"])
						.default("json")
						.describe(
							"Output format. 'json' returns structured deltas; 'text' returns human-readable summary."
						),
				}),
			},
			async (args) => {
				const result = await this.handleCompareCorpus(args);
				return {
					content: [{ type: "text" as const, text: result }],
				};
			}
		);

		// Tool 2: Compare File
		this.server.registerTool(
			"anchor_compare",
			{
				title: "Compare Single File",
				description:
					"Compare a single file between two git refs and detect section-level changes. " +
					"Returns deltas for the file, classified by severity. Use this for targeted analysis of a specific spec file.",
				inputSchema: z.object({
					filePath: z.string().describe(
						"Path to the file to compare (e.g., 'docs/specs/api.md', 'spec.md'). Relative to repo root."
					),
					fromRef: z
						.string()
						.default("main")
						.describe(
							"Git ref to compare from (e.g., 'main', 'HEAD~1'). Defaults to 'main'."
						),
					toRef: z
						.string()
						.default("HEAD")
						.describe(
							"Git ref to compare to (e.g., 'HEAD', 'main'). Defaults to 'HEAD'."
						),
					targets: z
						.array(z.string())
						.optional()
						.describe(
							"Optional list of targets to filter results. If provided, only changes affecting these targets are returned."
						),
					format: z
						.enum(["json", "text"])
						.default("json")
						.describe(
							"Output format. 'json' returns structured deltas; 'text' returns human-readable summary."
						),
				}),
			},
			async (args) => {
				const result = await this.handleCompare(args);
				return {
					content: [{ type: "text" as const, text: result }],
				};
			}
		);

		// Tool 3: List Targets
		this.server.registerTool(
			"anchor_targets",
			{
				title: "List Targets",
				description:
					"List all configured targets from .anchor.yaml. " +
					"Returns target names, file globs, and severity thresholds. " +
					"Use this to understand what targets are configured and which files each target covers.",
				inputSchema: z.object({
					configPath: z
						.string()
						.default(".anchor.yaml")
						.describe("Path to .anchor.yaml config file."),
					format: z
						.enum(["json", "table"])
						.default("json")
						.describe("Output format. 'json' or 'table'."),
				}),
			},
			async (args) => {
				const result = await this.handleTargets(args);
				return {
					content: [{ type: "text" as const, text: result }],
				};
			}
		);

		// Tool 4: Baseline Status
		this.server.registerTool(
			"anchor_baseline_status",
			{
				title: "Baseline Status",
				description:
					"Check the current baseline corpus status and scope. " +
					"Returns detected targets, included files, and configuration. " +
					"Use this to verify baseline setup or see what scope the baseline covers.",
				inputSchema: z.object({
					corpusPath: z
						.string()
						.optional()
						.describe("Path to the baseline corpus folder (e.g., 'spec/baseline')."),
					format: z
						.enum(["json", "text"])
						.default("json")
						.describe("Output format. 'json' or 'text'."),
				}),
			},
			async (args) => {
				const result = await this.handleBaselineStatus(args);
				return {
					content: [{ type: "text" as const, text: result }],
				};
			}
		);
	}

	private async handleCompareCorpus(args: {
		folderPath: string;
		fromRef: string;
		toRef: string;
		targets?: string[];
		format: "json" | "text";
	}): Promise<string> {
		try {
			// Perform corpus comparison
			const corpusChanges = await this.corpusDiffer.diff(
				args.fromRef,
				args.toRef,
				args.folderPath
			);

			// Classify sections and build FileDelta
			const fileDeltas: FileDelta[] = [];
			for (const fileChange of corpusChanges) {
				const fileDelta = await this.classifyFileChanges(fileChange);
				fileDeltas.push(fileDelta);
			}

			let output: string;
			if (args.format === "json") {
				output = JSON.stringify({ fileDeltas }, null, 2);
			} else {
				output = this.formatFileDeltasAsText(fileDeltas);
			}

			return output;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return `Error comparing corpus: ${errorMessage}`;
		}
	}

	private async handleCompare(args: {
		filePath: string;
		fromRef: string;
		toRef: string;
		targets?: string[];
		format: "json" | "text";
	}): Promise<string> {
		try {
			// Extract content from git refs
			let oldContent = "";
			let newContent = "";

			try {
				oldContent = await this.gitExtractor.extractFileAtRef(args.fromRef, args.filePath);
			} catch (error) {
				// File might not exist in old ref
				oldContent = "";
			}

			try {
				newContent = await this.gitExtractor.extractFileAtRef(args.toRef, args.filePath);
			} catch (error) {
				// File might not exist in new ref
				newContent = "";
			}

			// Parse and diff
			const oldSections = oldContent ? this.parser.parse(oldContent) : [];
			const newSections = newContent ? this.parser.parse(newContent) : [];
			const sectionChanges = this.differ.diff(oldSections, newSections);

			// Classify
			const sectionDeltas: SectionDelta[] = [];
			let maxSeverity: Severity = "COSMETIC";

			for (const change of sectionChanges) {
				// Only classify ADDED, REMOVED, MODIFIED (not RENAMED, REORDERED)
				if (!["ADDED", "REMOVED", "MODIFIED"].includes(change.changeType)) {
					continue;
				}

				const classifiableChangeType: "ADDED" | "REMOVED" | "MODIFIED" =
					change.changeType as "ADDED" | "REMOVED" | "MODIFIED";

				const classification = await this.classifier.classifyChange(
					change.title,
					change.oldContent,
					change.newContent,
					classifiableChangeType
				);

				sectionDeltas.push({
					sectionId: change.sectionId,
					title: change.title,
					changeType: change.changeType,
					severity: classification.severity,
					summary: classification.summary,
				});

				if (this.severityOrder(classification.severity) > this.severityOrder(maxSeverity)) {
					maxSeverity = classification.severity;
				}
			}

			const result: FileDelta[] = [
				{
					path: args.filePath,
					changeType:
						oldContent && newContent
							? "MODIFIED"
							: oldContent
								? "REMOVED"
								: "ADDED",
					sectionDeltas,
					maxSeverity,
				},
			];

			let output: string;
			if (args.format === "json") {
				output = JSON.stringify({ fileDeltas: result }, null, 2);
			} else {
				output = this.formatFileDeltasAsText(result);
			}

			return output;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return `Error comparing file: ${errorMessage}`;
		}
	}

	private async handleTargets(args: {
		configPath: string;
		format: "json" | "table";
	}): Promise<string> {
		try {
			let config: AnchorConfig;
			try {
				config = await this.configLoader.load(args.configPath);
			} catch {
				// Return empty if config not found
				config = { version: 1, targets: [] };
			}

			let output: string;
			if (args.format === "json") {
				output = JSON.stringify(config.targets, null, 2);
			} else {
				output = this.formatTargetsAsTable(config.targets);
			}

			return output;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return `Error listing targets: ${errorMessage}`;
		}
	}

	private async handleBaselineStatus(args: {
		corpusPath?: string;
		format: "json" | "text";
	}): Promise<string> {
		// This is a placeholder - would check for baseline corpus and config
		const status = {
			hasBaseline: false,
			targets: [],
			scope: "Not initialized",
		};

		let output: string;
		if (args.format === "json") {
			output = JSON.stringify(status, null, 2);
		} else {
			output = `Baseline Status:\n  Initialized: ${status.hasBaseline}\n  Targets: ${status.targets.join(", ") || "None"}\n  Scope: ${status.scope}`;
		}

		return output;
	}

	private async classifyFileChanges(fileChange: CorpusFileChange): Promise<FileDelta> {
		const sectionDeltas: SectionDelta[] = [];
		let maxSeverity: Severity = "COSMETIC";

		for (const change of fileChange.sectionChanges) {
			// Only classify ADDED, REMOVED, MODIFIED (not RENAMED, REORDERED)
			if (!["ADDED", "REMOVED", "MODIFIED"].includes(change.changeType)) {
				continue;
			}

			const classifiableChangeType: "ADDED" | "REMOVED" | "MODIFIED" =
				change.changeType as "ADDED" | "REMOVED" | "MODIFIED";

			const classification = await this.classifier.classifyChange(
				change.title,
				change.oldContent,
				change.newContent,
				classifiableChangeType
			);

			sectionDeltas.push({
				sectionId: change.sectionId,
				title: change.title,
				changeType: change.changeType,
				severity: classification.severity,
				summary: classification.summary,
			});

			if (this.severityOrder(classification.severity) > this.severityOrder(maxSeverity)) {
				maxSeverity = classification.severity;
			}
		}

		return {
			path: fileChange.path,
			changeType: fileChange.changeType,
			sectionDeltas,
			maxSeverity,
		};
	}

	private severityOrder(severity: Severity): number {
		const order: Record<Severity, number> = {
			BREAKING: 4,
			BEHAVIORAL: 3,
			INFORMATIONAL: 2,
			COSMETIC: 1,
		};
		return order[severity];
	}

	private formatFileDeltasAsText(deltas: FileDelta[]): string {
		let output = "Comparison Results:\n\n";

		if (deltas.length === 0) {
			output += "No changes detected.\n";
			return output;
		}

		for (const file of deltas) {
			output += `📄 ${file.path} (${file.changeType}) [${file.maxSeverity}]\n`;
			if (file.sectionDeltas && file.sectionDeltas.length > 0) {
				for (const section of file.sectionDeltas) {
					output += `  - [${section.severity}] ${section.title}: ${section.changeType}\n`;
					if (section.summary) {
						output += `    ${section.summary}\n`;
					}
				}
			} else {
				output += "  (no section-level changes)\n";
			}
			output += "\n";
		}

		return output;
	}

	private formatTargetsAsTable(targets: AnchorTargetConfig[]): string {
		if (!targets || targets.length === 0) {
			return "No targets configured.\n";
		}

		let output = "Targets:\n";
		output += "┌─────────────┬─────────────────────────────────┐\n";
		output += "│ Target      │ File Globs                      │\n";
		output += "├─────────────┼─────────────────────────────────┤\n";

		for (const target of targets) {
			const globs = target.fileGlobs ? target.fileGlobs.join(", ") : "N/A";
			output += `│ ${target.name.padEnd(11)} │ ${globs.padEnd(31)} │\n`;
		}

		output += "└─────────────┴─────────────────────────────────┘\n";
		return output;
	}

	async start(): Promise<void> {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		if (this.verbose) {
			this.logger.info("🚀 Anchor MCP server started via stdio");
		}
	}
}
