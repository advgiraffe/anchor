# Architecture

## Current runtime decisions

### CLI runtime entrypoint

The CLI executes from the CommonJS build (`dist/index.cjs`). This avoids runtime issues from dependencies that still expect CommonJS module loading semantics.

### Anthropic credential resolution

Anthropic credentials resolve in this order:

1. Explicit api key parameter
2. Env var named by `ANCHOR_ANTHROPIC_KEY_ENV_VAR`
3. `ANCHOR_ANTHROPIC_KEY`
4. `ANTHROPIC_API_KEY`

This allows users to isolate Anchor API usage under a dedicated credential name while still supporting the provider default.

### Testing approach

Git-based integration tests should use a temporary local git repository created during the test run. We do not use throwaway commits in the main repository as the test fixture mechanism.
