import type { Command } from "commander";
import { registerNotImplemented } from "./_notImplemented.js";

export function registerWatchCommand(program: Command): void {
	registerNotImplemented(program, "watch", "Watch corpus and generate instructions on change");
}
