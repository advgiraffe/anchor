# @anchor-ai/core

Core engine package for Anchor.

## Provider notes

Anthropic is the first implemented provider.

Default model:

- `claude-haiku-4-5`

Credentials resolve in this order:

1. Explicit key passed by code
2. Env var named in `ANCHOR_ANTHROPIC_KEY_ENV_VAR`
3. `ANCHOR_ANTHROPIC_KEY`
4. `ANTHROPIC_API_KEY`

See `docs/models.md` for provider model references.
