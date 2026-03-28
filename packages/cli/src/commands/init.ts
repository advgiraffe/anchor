import type { Command } from "commander";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { TargetDetector, type AnchorTargetConfig } from "../core/index.js";

export type InitHost =
  | "claude"
  | "copilot"
  | "cursor"
  | "windsurf"
  | "openclaw"
  | "github-actions"
  | "all";

export interface InitCommandOptions {
  host: InitHost;
  src: string;
  force: boolean;
}

export interface InitDependencies {
  targetDetector?: TargetDetector;
  templateRoot?: string;
  cwd?: string;
  emitOutput?: (output: string) => void;
}

export interface InitResult {
  configPath: string;
  writtenFiles: string[];
  skippedFiles: string[];
  targets: AnchorTargetConfig[];
}

export function registerInitCommand(program: Command): void {
	program
		.command("init")
		.description("Initialize host integration templates")
		.option("--host <host>", "Host to scaffold: claude|copilot|cursor|windsurf|openclaw|github-actions|all", "claude")
		.option("--src <path>", "Source directory used for target detection", ".")
		.option("--force", "Overwrite existing files", false)
		.action(async (opts: InitCommandOptions) => {
			try {
				await initAction(opts);
			} catch (error) {
				console.error(`init error: ${error instanceof Error ? error.message : String(error)}`);
				process.exitCode = 1;
			}
		});
}

export async function initAction(
	opts: InitCommandOptions,
	dependencies: InitDependencies = {},
): Promise<InitResult> {
	const cwd = dependencies.cwd ?? process.cwd();
	const templateRoot = dependencies.templateRoot ?? resolve(cwd, "templates");
	const sourcePath = resolve(cwd, opts.src);
	const targetDetector = dependencies.targetDetector ?? new TargetDetector();

	const targets = targetDetector.detect(sourcePath);
	const writtenFiles: string[] = [];
	const skippedFiles: string[] = [];

	const configPath = resolve(cwd, ".anchor.yaml");
	if (!existsSync(configPath) || opts.force) {
		writeFileSync(configPath, renderConfigYaml(targets), "utf8");
		writtenFiles.push(configPath);
	} else {
		skippedFiles.push(configPath);
	}

	for (const mapping of resolveMappings(opts.host)) {
		const sourceTemplatePath = join(templateRoot, mapping.template);
		const destinationPath = resolve(cwd, mapping.destination);

		if (!existsSync(sourceTemplatePath)) {
			continue;
		}

		if (existsSync(destinationPath) && !opts.force) {
			skippedFiles.push(destinationPath);
			continue;
		}

		mkdirSync(dirname(destinationPath), { recursive: true });
		copyFileSync(sourceTemplatePath, destinationPath);
		writtenFiles.push(destinationPath);
	}

	const result: InitResult = {
		configPath,
		writtenFiles,
		skippedFiles,
		targets,
	};

	emitInitResult(result, dependencies);
	return result;
}

function emitInitResult(result: InitResult, dependencies: InitDependencies): void {
	const lines: string[] = [];
	lines.push("Anchor init complete");
	lines.push("");
	lines.push(`Detected targets: ${result.targets.map((target) => target.name).join(", ")}`);
	lines.push(`Config: ${result.configPath}`);
	lines.push("");

	if (result.writtenFiles.length > 0) {
		lines.push("Written files:");
		for (const filePath of result.writtenFiles) {
			lines.push(`- ${filePath}`);
		}
		lines.push("");
	}

	if (result.skippedFiles.length > 0) {
		lines.push("Skipped existing files:");
		for (const filePath of result.skippedFiles) {
			lines.push(`- ${filePath}`);
		}
		lines.push("");
	}

	const output = `${lines.join("\n")}\n`;
	if (dependencies.emitOutput) {
		dependencies.emitOutput(output);
		return;
	}

	process.stdout.write(output);
}

function resolveMappings(host: InitHost): Array<{ template: string; destination: string }> {
	const allMappings = new Map<Exclude<InitHost, "all">, Array<{ template: string; destination: string }>>([
		[
			"claude",
			[
				{ template: "claude/CLAUDE.md.template", destination: "CLAUDE.md" },
				{ template: "claude/anchor-check.md.template", destination: ".claude/commands/anchor-check.md" },
			],
		],
		[
			"copilot",
			[
				{ template: "copilot/copilot-instructions.md.template", destination: ".github/copilot-instructions.md" },
				{ template: "copilot/anchor-skill.md.template", destination: ".github/copilot/skills/anchor.md" },
			],
		],
		[
			"cursor",
			[{ template: "cursor/anchor.mdc.template", destination: ".cursor/rules/anchor.mdc" }],
		],
		[
			"windsurf",
			[
				{ template: "windsurf/anchor.windsurfrules.template", destination: ".windsurfrules/anchor.windsurfrules" },
			],
		],
		[
			"openclaw",
			[{ template: "openclaw/openclaw-workflow.yaml.template", destination: ".openclaw/workflows/anchor-workflow.yaml" }],
		],
		[
			"github-actions",
			[{ template: "github-actions/anchor.yml.template", destination: ".github/workflows/anchor.yml" }],
		],
	]);

	if (host === "all") {
		return Array.from(allMappings.values()).flat();
	}

	return allMappings.get(host) ?? [];
}

function renderConfigYaml(targets: AnchorTargetConfig[]): string {
	const lines: string[] = [];
	lines.push("version: 3");
	lines.push("targets:");

	for (const target of targets) {
		lines.push(`  - name: ${target.name}`);
		if (target.description) {
			lines.push(`    description: ${quoteIfNeeded(target.description)}`);
		}
		lines.push("    fileGlobs:");
		for (const glob of target.fileGlobs) {
			lines.push(`      - ${quoteIfNeeded(glob)}`);
		}
		if (target.excludeGlobs && target.excludeGlobs.length > 0) {
			lines.push("    excludeGlobs:");
			for (const glob of target.excludeGlobs) {
				lines.push(`      - ${quoteIfNeeded(glob)}`);
			}
		}
		if (target.minSeverity) {
			lines.push(`    minSeverity: ${target.minSeverity}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

function quoteIfNeeded(value: string): string {
	if (/[:\-\[\]{}",\s]/.test(value)) {
		return JSON.stringify(value);
	}
	return value;
}
