import type { Command } from "commander";

export function registerCompareCommand(program: Command): void {
	program
		.command("compare")
		.description("Compare requirements/spec changes between refs")
		.option("--from <ref>", "Start git ref", "HEAD~1")
		.option("--to <ref>", "End git ref", "HEAD")
		.option("--file <path>", "Single file path to compare")
		.option("--corpus <path>", "Corpus path to compare")
		.action(() => {
			console.error("command 'compare' is not implemented yet");
			process.exitCode = 1;
		});
}
