import type { Command } from "commander";
import { registerNotImplemented } from "./_notImplemented.js";

export function registerMcpCommand(program: Command): void {
	registerNotImplemented(program, "mcp", "Start Anchor MCP server");
}
