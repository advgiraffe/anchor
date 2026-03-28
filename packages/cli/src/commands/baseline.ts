import type { Command } from "commander";
import {
	CorpusWriter,
	SectionGenerator,
	TargetDetector,
	type AnchorTargetConfig,
	type BaselineSection,
	type CorpusWriteResult,
} from "../core/index.js";

export interface BaselineCommandOptions {
	src: string;
	out: string;
	dryRun: boolean;
	format: "text" | "json";
}

export interface BaselineDependencies {
	targetDetector?: TargetDetector;
	sectionGenerator?: SectionGenerator;
	corpusWriter?: CorpusWriter;
	emitOutput?: (output: string) => void;
	cwd?: string;
}

export interface BaselineResult {
	sourcePath: string;
	outputPath: string;
	targets: AnchorTargetConfig[];
	sections: BaselineSection[];
	writeResult: CorpusWriteResult;
}

export function registerBaselineCommand(program: Command): void {
	program
		.command("baseline")
		.description("Bootstrap a baseline spec corpus from code")
		.option("--src <path>", "Source directory to analyze", ".")
		.option("--out <path>", "Output corpus directory", "docs/specs")
		.option("--dry-run", "Preview generated files without writing", false)
		.option("--format <format>", "Output format: text|json", "text")
		.action(async (opts: BaselineCommandOptions) => {
			try {
				await baselineAction(opts);
			} catch (error) {
				console.error(`baseline error: ${error instanceof Error ? error.message : String(error)}`);
				process.exitCode = 1;
			}
		});
}

export async function baselineAction(
	opts: BaselineCommandOptions,
	dependencies: BaselineDependencies = {},
): Promise<BaselineResult> {
	const cwd = dependencies.cwd ?? process.cwd();
	const sourcePath = resolvePath(cwd, opts.src);
	const outputPath = resolvePath(cwd, opts.out);

	const targetDetector = dependencies.targetDetector ?? new TargetDetector();
	const sectionGenerator = dependencies.sectionGenerator ?? new SectionGenerator();
	const corpusWriter = dependencies.corpusWriter ?? new CorpusWriter();

	const targets = targetDetector.detect(sourcePath);
	const sections = sectionGenerator.generate({ sourcePath, targets });
	const writeResult = corpusWriter.write({
		outputPath,
		sections,
		targets,
		dryRun: opts.dryRun,
	});

	const result: BaselineResult = {
		sourcePath,
		outputPath,
		targets,
		sections,
		writeResult,
	};

	emitBaselineResult(result, opts.format, dependencies);
	return result;
}

function emitBaselineResult(
	result: BaselineResult,
	format: BaselineCommandOptions["format"],
	dependencies: BaselineDependencies,
): void {
	const output =
		format === "json"
			? `${JSON.stringify(
				{
					sourcePath: result.sourcePath,
					outputPath: result.outputPath,
					targets: result.targets.map((target) => target.name),
					sectionCount: result.sections.length,
					writtenFiles: result.writeResult.writtenFiles,
					dryRun: result.writeResult.dryRun,
				},
				null,
				2,
			)}\n`
			: renderText(result);

	if (dependencies.emitOutput) {
		dependencies.emitOutput(output);
		return;
	}

	process.stdout.write(output);
}

function renderText(result: BaselineResult): string {
	const lines: string[] = [];
	lines.push("Baseline generation complete");
	lines.push("");
	lines.push(`Source: ${result.sourcePath}`);
	lines.push(`Output: ${result.outputPath}`);
	lines.push(`Detected targets: ${result.targets.map((target) => target.name).join(", ")}`);
	lines.push(`Generated sections: ${result.sections.length}`);
	lines.push(`Mode: ${result.writeResult.dryRun ? "dry-run" : "write"}`);
	lines.push("");
	lines.push("Files:");

	for (const path of result.writeResult.writtenFiles) {
		lines.push(`- ${path}`);
	}

	lines.push("");
	return `${lines.join("\n")}\n`;
}

function resolvePath(cwd: string, path: string): string {
	if (path.startsWith("/") || /^[A-Za-z]:\\/.test(path)) {
		return path;
	}

	return `${cwd.replace(/\\/g, "/")}/${path}`;
}
