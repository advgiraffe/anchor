# Anchor — Claude Agent Context

This file provides context for AI agents (Claude Code, etc.) working in this repository.

## Repository overview

Anchor is a requirements delta agent. It compares versions of spec/doc content between git refs, detects section-level changes, and classifies impact severity so teams know what matters before a release.

Two packages:
- `@anchor_app/core` — diff engine, git extraction, LLM classification, models
- `@anchor_app/anchor` — CLI (`compare`, `baseline`, `doctor`, `validate`, `mcp`, …)

## Build & test

```bash
# Build all packages
pnpm build

# Unit + integration tests for a single package
pnpm --filter @anchor_app/anchor test

# Integration tests only
pnpm --filter @anchor_app/anchor test:integration

# Typecheck
pnpm --filter @anchor_app/core typecheck
pnpm --filter @anchor_app/anchor typecheck
```

### Stale package export gotcha

`@anchor_app/core` resolves from its **compiled `dist/`**, not source. When you add a new export to `packages/core/src/`, the CLI package will not see it until core is rebuilt:

```bash
pnpm --filter @anchor_app/core build
```

The CLI `test` and `test:integration` scripts already do this automatically. If you add exports to core and run core tests directly (`pnpm --filter @anchor_app/core test`), those tests import from source via Vitest and work without a build. But cross-package consumers always need the build step first.

### Git sync before push

This repo uses `@semantic-release/git` in CI, which can create release commits on `main` after GitHub workflows run. That means remote `main` can advance even if your local branch was up-to-date when you started.

Before pushing local commits, always sync first:

```bash
git fetch origin
git rebase origin/main
```

Then push. This avoids non-fast-forward push failures and keeps local commits cleanly on top of release-generated commits.

## Architecture

```
compare --file    →  GitExtractor → MarkdownParser → SectionDiffer → SectionClassifier → AnchorResult
compare --corpus  →  GitTreeDiffer → CorpusTreeDiffer (per-file: GitExtractor + MarkdownParser + SectionDiffer) → SectionClassifier → AnchorResult
```

Key source locations:
- `packages/core/src/models/index.ts` — shared types (`AnchorResult`, `FileDelta`, `SectionDelta`, `Severity`, `ChangeType`)
- `packages/core/src/diff/CorpusTreeDiffer.ts` — multi-file corpus diff
- `packages/core/src/git/GitTreeDiffer.ts` — git file-tree diffing (add/remove/modify/rename)
- `packages/core/src/git/GitExtractor.ts` — extract file content at a git ref
- `packages/core/src/diff/text/SectionDiffer.ts` — section-level markdown diff
- `packages/cli/src/commands/compare.ts` — compare command; accepts `--file` or `--corpus`

## Test strategy

- **No real LLM calls in tests.** Inject a deterministic `classifier` via `CompareDependencies`.
- **Temp git repos via `createTempGitRepo()`** (`tests/helpers/tempGitRepo.ts`) — creates an isolated repo with `git init`, `git config`, and `commitFile()`. Always call `repo.cleanup()` in `finally`.
- **Unchanged-file test setup**: git won't commit if the file content is identical. Commit a different file to advance `HEAD` when you need a new ref but want the target file unchanged.

## Development roadmap (current status)

Completed:
- [x] Single-file compare with section-level diff and LLM classification
- [x] Integration tests for single-file compare
- [x] Corpus-level compare (`--corpus`) with file add/remove/modify/rename
- [x] Integration tests for corpus compare

Next up (in order):
- [ ] Output formatters: JSON, Markdown, SARIF (`packages/cli/src/output/`)
- [ ] Target routing + instruction generation (`packages/core/src/routing/`, `packages/core/src/llm/InstructionGenerator.ts`)
- [ ] Baseline command end-to-end (`packages/cli/src/commands/baseline.ts`)
- [ ] MCP command + tools (`packages/cli/src/mcp/`)
- [ ] Image diff pipeline (`packages/core/src/diff/images/`)
- [ ] Extractor implementations: routes, schemas, screens (`packages/core/src/baseline/extractors/`)
