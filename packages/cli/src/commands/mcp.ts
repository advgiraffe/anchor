import type { Command } from "commander";
import { AnchorMcpServer } from "../mcp/McpServer.js";

export interface McpCommandOptions {
	verbose?: boolean;
	transport?: "stdio" | "sse";
	port?: number;
}

export function registerMcpCommand(program: Command): void {
	program
		.command("mcp")
		.description("Start Anchor MCP server for integration with agent hosts")
		.option("-v, --verbose", "Enable verbose logging")
		.option(
			"--transport <type>",
			"MCP transport: stdio (default) or sse",
			"stdio",
		)
		.option(
			"--port <number>",
			"Port for SSE transport (default 3456)",
			"3456",
		)
		.action(async (opts: McpCommandOptions) => {
			try {
				await mcpAction(opts);
			} catch (error) {
				console.error(
					`mcp error: ${error instanceof Error ? error.message : String(error)}`,
				);
				process.exitCode = 1;
			}
		});
}

export async function mcpAction(opts: McpCommandOptions = {}): Promise<void> {
	const server = new AnchorMcpServer({
		cwd: process.cwd(),
		verbose: opts.verbose ?? false,
	});

	await server.start();

	// Handle graceful shutdown
	process.on("SIGTERM", () => {
		process.exit(0);
	});
	process.on("SIGINT", () => {
		process.exit(0);
	});
}
