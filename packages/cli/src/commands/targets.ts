import type { Command } from "commander";
import { ConfigLoader, type AnchorTargetConfig } from "@anchor_app/core";

export interface TargetsCommandOptions {
	config: string;
	format: "table" | "json";
}

export interface TargetsDependencies {
	configLoader?: ConfigLoader;
	emitOutput?: (output: string) => void;
	cwd?: string;
}

export function registerTargetsCommand(program: Command): void {
	program
		.command("targets")
		.description("List configured targets")
		.option("--config <path>", "Path to config file", ".anchor.yaml")
		.option("--format <format>", "Output format: table|json", "table")
		.action(async (opts: TargetsCommandOptions) => {
			try {
				await targetsAction(opts);
			} catch (error) {
				console.error(`targets error: ${error instanceof Error ? error.message : String(error)}`);
				process.exitCode = 1;
			}
		});
}

export async function targetsAction(
	opts: TargetsCommandOptions,
	dependencies: TargetsDependencies = {},
): Promise<AnchorTargetConfig[]> {
	const loader = dependencies.configLoader ?? new ConfigLoader();
	const cwd = dependencies.cwd ?? process.cwd();
	const config = loader.load(opts.config, cwd);

	const rendered = opts.format === "json" ? renderJson(config.targets) : renderTable(config.targets);

	if (dependencies.emitOutput) {
		dependencies.emitOutput(rendered);
	} else {
		process.stdout.write(rendered);
	}

	return config.targets;
}

function renderJson(targets: AnchorTargetConfig[]): string {
	return `${JSON.stringify(targets, null, 2)}\n`;
}

function renderTable(targets: AnchorTargetConfig[]): string {
	if (targets.length === 0) {
		return "No targets configured.\n";
	}

	const lines = ["Configured targets:", ""];
	for (const target of targets) {
		lines.push(`- ${target.name}`);
		if (target.description) {
			lines.push(`  description: ${target.description}`);
		}
		lines.push(`  fileGlobs: ${target.fileGlobs.join(", ")}`);
		if (target.minSeverity) {
			lines.push(`  minSeverity: ${target.minSeverity}`);
		}
	}
	lines.push("");

	return `${lines.join("\n")}\n`;
}
