import type { Command } from "commander";
import { registerNotImplemented } from "./_notImplemented.js";

export function registerBaselineCommand(program: Command): void {
	registerNotImplemented(program, "baseline", "Bootstrap a baseline spec corpus from code");
}
