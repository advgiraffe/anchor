# @anchorspec/cli

CLI and MCP server for [Anchor](https://github.com/advgiraffe/anchor) — a requirements delta agent that detects and classifies meaningful changes in specs and docs between git refs.

## Installation

```bash
# Global install
npm install -g @anchorspec/cli

# Or run directly with npx
npx @anchorspec/cli doctor
```

## Usage

```bash
# Check environment setup
anchor doctor

# Initialize Anchor in your project
anchor init

# Compare a single file between git refs
anchor compare --file docs/spec.md --from main --to HEAD

# Compare all specs in a folder
anchor compare --corpus docs/specs --from main --to HEAD

# List configured targets
anchor targets

# Validate your .anchor.yaml config
anchor validate
```

## MCP server

Anchor includes a built-in MCP server for Claude Code, Claude Desktop, and other agent hosts.

```bash
# Start MCP server (stdio transport)
anchor mcp

# Specify a working directory
anchor mcp --cwd /path/to/repo

# Use SSE transport
anchor mcp --transport sse --port 3456
```

### Claude Code / Claude Desktop configuration

```json
{
  "mcpServers": {
    "anchor": {
      "command": "anchor",
      "args": ["mcp"]
    }
  }
}
```

Or without a global install:

```json
{
  "mcpServers": {
    "anchor": {
      "command": "npx",
      "args": ["@anchorspec/cli", "mcp"]
    }
  }
}
```

### MCP tools

| Tool                     | Description                                    |
|--------------------------|------------------------------------------------|
| `anchor_compare`         | Compare a single file between git refs         |
| `anchor_compare_corpus`  | Compare a folder of specs between git refs     |
| `anchor_targets`         | List configured targets from `.anchor.yaml`    |
| `anchor_baseline_status` | Check baseline corpus status                   |

## Configuration

Anchor reads `.anchor.yaml` in your project root. Run `anchor init` to generate one.

## Contributing

```bash
# Build
pnpm build

# Run tests
pnpm test

# Run integration tests
pnpm test:integration

# Typecheck
pnpm typecheck
```
