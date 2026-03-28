#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Command } from "commander";
import { AnchorError } from "./core/index.js";
import { registerBaselineCommand } from "./commands/baseline.js";
import { registerCompareCommand } from "./commands/compare.js";
import { registerWatchCommand } from "./commands/watch.js";
import { registerInitCommand } from "./commands/init.js";
import { registerTargetsCommand } from "./commands/targets.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerValidateCommand } from "./commands/validate.js";

const cliVersion = resolveCliVersion();

async function main(): Promise<void> {
	const program = new Command();

	program
		.name("anchor")
		.description("Anchor requirements delta agent CLI")
		.version(cliVersion);

	registerCompareCommand(program);
	registerBaselineCommand(program);
	registerWatchCommand(program);
	registerInitCommand(program);
	registerTargetsCommand(program);
	registerMcpCommand(program);
	registerDoctorCommand(program);
	registerValidateCommand(program);

	await program.parseAsync(process.argv);
}

void main().catch((error: unknown) => {
	if (error instanceof AnchorError) {
		console.error(`anchor error [${error.code}]: ${error.message}`);
		process.exitCode = 1;
		return;
	}

	console.error("anchor unexpected error", error);
	process.exitCode = 1;
});

function resolveCliVersion(): string {
	const entryPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
	const searchRoots = new Set<string>();

	if (entryPath) {
		searchRoots.add(dirname(entryPath));
	}

	searchRoots.add(process.cwd());

	for (const root of searchRoots) {
		const version = findVersionInParentPackageJson(root);
		if (version) {
			return version;
		}
	}

	return "0.0.0";
}

function findVersionInParentPackageJson(startDir: string): string | undefined {
	let currentDir = startDir;

	while (true) {
		const packageJsonPath = join(currentDir, "package.json");
		if (existsSync(packageJsonPath)) {
			try {
				const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
					name?: string;
					version?: string;
				};
				if (parsed.name === "@anchorspec/cli" && parsed.version) {
					return parsed.version;
				}
			} catch {
				// Ignore unreadable package metadata and continue searching upward.
			}
		}

		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) {
			return undefined;
		}

		currentDir = parentDir;
	}
}

