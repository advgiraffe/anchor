# Contributing

## Local development

Install dependencies with pnpm:

```bash
pnpm install
pnpm build
pnpm typecheck
```

Run tests:

```bash
# All tests (builds core first automatically)
pnpm --filter @anchor_app/anchor test

# Integration tests only
pnpm --filter @anchor_app/anchor test:integration

# Core package tests
pnpm --filter @anchor_app/core test
```

Run the CLI directly from the built CommonJS binary:

```bash
node packages/cli/dist/index.cjs --help
node packages/cli/dist/index.cjs doctor
```

The CLI package points its `bin` entry at the CommonJS build intentionally. Some current dependencies still rely on CommonJS runtime behavior, so the CJS entrypoint is the stable local execution path.

### Stale package exports

`@anchor_app/core` resolves from its compiled `dist/`, not source. When you add a new export to `packages/core/src/`, the CLI package won't see it until core is rebuilt:

```bash
pnpm --filter @anchor_app/core build
```

The CLI `test` and `test:integration` scripts do this automatically. Core tests import from source via Vitest and don't need the build step, but all cross-package consumers do.

## Anthropic credentials

Anchor resolves Anthropic credentials in this order:

1. An explicit api key passed by code
2. The env var named by `ANCHOR_ANTHROPIC_KEY_ENV_VAR`
3. `ANCHOR_ANTHROPIC_KEY`
4. `ANTHROPIC_API_KEY`

Recommended for local development:

```bash
export ANCHOR_ANTHROPIC_KEY=your-key-here
```

Use `ANCHOR_ANTHROPIC_KEY` when you want Anchor usage isolated from other Anthropic tooling on your machine.

## Testing strategy

Do not create throwaway test commits in the main repository history to exercise git diffs.

Use three layers instead:

1. Unit tests: plain in-memory fixture strings for parser and differ logic
2. Integration tests: create a temporary local git repository inside the test, write files, commit versions, and run Anchor against those refs
3. Dogfooding: run Anchor manually against real `docs/` changes in this repository once the integration path is stable

Integration tests should generate their own local git repo with `git init` in a temp directory. That keeps tests hermetic, repeatable, and free of noisy history in `main`.
