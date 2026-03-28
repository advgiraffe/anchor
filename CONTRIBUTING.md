# Contributing

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

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

---

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

---

## Commit conventions

Anchor uses [Conventional Commits](https://www.conventionalcommits.org/) and
[semantic-release](https://semantic-release.gitbook.io/) for fully automated
versioning and NPM publishing. **Never manually bump the version in
`package.json`** — the CI pipeline owns that.

Every commit that merges to `main` is evaluated against this table:

| Prefix | Effect | Example |
|---|---|---|
| `fix:` | Patch release → `1.0.x` | `fix: handle null ref in diff parser` |
| `feat:` | Minor release → `1.x.0` | `feat: add --watch mode to CLI` |
| `feat!:` or `BREAKING CHANGE:` in body | Major release → `x.0.0` | `feat!: remove legacy config format` |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:` | No release | `chore: update vitest to 2.x` |

A commit with no recognized prefix also produces no release.

### Scope (optional but encouraged)

Add a scope to give context: `fix(core): ...`, `feat(cli): ...`, `docs(readme): ...`.

### Breaking changes

If a commit introduces a breaking change, add `BREAKING CHANGE: <description>`
as a line in the commit body (not the subject line):

```
feat: redesign config resolution

BREAKING CHANGE: the `anchorConfig` key is no longer supported; use `anchor` instead
```

### Tips for agent developers

If you are using an AI coding agent (Claude Code or similar), instruct it to
use conventional commit prefixes in all commits. Agents are generally reliable
at this with a single prompt instruction. The release pipeline will handle
everything else.

---

## Release process

Releases are fully automated via GitHub Actions (when `NPM_TOKEN` is configured). When a commit lands on `main`:

1. `semantic-release` analyzes commit messages since the last release tag
2. If any releasable commits exist (`fix:`, `feat:`, breaking), it bumps the
   version, updates `CHANGELOG.md`, publishes to NPM, and creates a GitHub Release
3. If only non-releasable commits exist (`chore:`, `docs:`, etc.), nothing is published

### Scoped package visibility

Anchor publishes scoped packages (`@anchor_app/core`, `@anchor_app/anchor`) and they must remain public.

- Each package manifest must include `publishConfig.access: public`
- Release publishing uses `--access public`
- CI and release workflows enforce this via `node scripts/verify-public-packages.mjs`

If this check fails, fix the package manifest(s) before merging.

You do not need to do anything. The only lever you control is the commit prefix.

If `NPM_TOKEN` is missing in repository secrets, the release workflow will skip publishing and log a warning.

### Branching

- Work on feature branches, merge to `main` via PR
- Squash-merge PRs to keep `main` history clean and releases predictable
- Direct pushes to `main` are reserved for the maintainer

---

## Testing strategy

Do not create throwaway test commits in the main repository history to exercise git diffs.

Use three layers instead:

1. **Unit tests**: plain in-memory fixture strings for parser and differ logic
2. **Integration tests**: create a temporary local git repository inside the test, write files, commit versions, and run Anchor against those refs
3. **Dogfooding**: run Anchor manually against real `docs/` changes in this repository once the integration path is stable

Integration tests should generate their own local git repo with `git init` in a
temp directory. That keeps tests hermetic, repeatable, and free of noisy history
in `main`.