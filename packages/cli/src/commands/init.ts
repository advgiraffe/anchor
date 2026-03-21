import type { Command } from "commander";
import { registerNotImplemented } from "./_notImplemented.js";

export function registerInitCommand(program: Command): void {
	registerNotImplemented(program, "init", "Initialize host integration templates");
}
