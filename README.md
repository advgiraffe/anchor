# Anchor

Anchor is a requirements delta agent that compares versions of spec and doc content between git refs, detects section-level changes, and classifies impact severity so teams know what matters before a release.

## Install

```bash
npm install -g @anchorspec/cli
```

## Quick start

```bash
# Verify your environment
anchor doctor

# Initialize Anchor in your project
anchor init

# Compare specs between git refs
anchor compare --file docs/spec.md --from main --to HEAD

# Compare an entire spec corpus
anchor compare --corpus docs/specs --from main --to HEAD
```

## MCP integration

Anchor includes a built-in MCP server for use with Claude Code, Claude Desktop, and other agent hosts.

Add to your MCP settings:

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

The MCP server exposes these tools: `anchor_compare`, `anchor_compare_corpus`, `anchor_targets`, and `anchor_baseline_status`.

## Commands

| Command    | Description                                          |
|------------|------------------------------------------------------|
| `compare`  | Compare a file or corpus between git refs            |
| `baseline` | Bootstrap a spec corpus from code                    |
| `init`     | Initialize Anchor config (`.anchor.yaml`)            |
| `targets`  | List configured targets                              |
| `validate` | Validate Anchor configuration                        |
| `doctor`   | Check environment (Node, git, API key)               |
| `mcp`      | Start MCP server for agent host integration          |
| `watch`    | Watch for spec changes                               |

## Configuration

Anchor reads `.anchor.yaml` in your project root. Run `anchor init` to generate one, or create it manually:

```yaml
version: 3
corpus: docs/specs
targets:
  - name: api
    globs: ["src/api/**"]
  - name: frontend
    globs: ["src/components/**"]
```

## License

MIT
