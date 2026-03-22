#!/usr/bin/env node

import { Command } from "commander";
import { AnchorError } from "@anchor_app/core";
import { registerBaselineCommand } from "./commands/baseline.js";
import { registerCompareCommand } from "./commands/compare.js";
import { registerWatchCommand } from "./commands/watch.js";
import { registerInitCommand } from "./commands/init.js";
import { registerTargetsCommand } from "./commands/targets.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerValidateCommand } from "./commands/validate.js";

async function main(): Promise<void> {
	const program = new Command();

	program
		.name("anchor")
		.description("Anchor requirements delta agent CLI")
		.version("0.0.0");

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

