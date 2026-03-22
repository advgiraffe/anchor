# @anchor_app/anchor

CLI package for Anchor.

## Development usage

Build the workspace, then run the CLI from the CommonJS build:

```bash
pnpm build
node packages/cli/dist/index.cjs --help
node packages/cli/dist/index.cjs doctor
```

The package `bin` points at `dist/index.cjs` so local and published execution both use the runtime-safe CommonJS entrypoint.
