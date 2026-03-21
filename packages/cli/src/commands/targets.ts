import type { Command } from "commander";
import { registerNotImplemented } from "./_notImplemented.js";

export function registerTargetsCommand(program: Command): void {
	registerNotImplemented(program, "targets", "List configured targets");
}
