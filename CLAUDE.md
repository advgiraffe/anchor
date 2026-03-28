# Anchor — Claude Agent Context

This file provides context for AI agents (Claude Code, etc.) working in this repository.

## Repository overview

Anchor is a requirements delta agent. It compares versions of spec/doc content between git refs, detects section-level changes, and classifies impact severity so teams know what matters before a release.

Single published package: `@anchorspec/cli` — CLI + MCP server (binary name: `anchor`)

Source layout within `packages/cli/`:
- `src/core/` — diff engine, git extraction, LLM classification, models
- `src/commands/` — CLI commands (`compare`, `baseline`, `doctor`, `validate`, `mcp`, …)
- `src/mcp/` — MCP server and tool implementations
- `src/output/` — output formatters (JSON, Markdown, SARIF, instructions)

## Build & test

```bash
# Build
pnpm build

# Unit + integration tests
pnpm test

# Integration tests only
pnpm test:integration

# Typecheck
pnpm typecheck
```

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
- `packages/cli/src/core/models/index.ts` — shared types (`AnchorResult`, `FileDelta`, `SectionDelta`, `Severity`, `ChangeType`)
- `packages/cli/src/core/diff/CorpusTreeDiffer.ts` — multi-file corpus diff
- `packages/cli/src/core/git/GitTreeDiffer.ts` — git file-tree diffing (add/remove/modify/rename)
- `packages/cli/src/core/git/GitExtractor.ts` — extract file content at a git ref
- `packages/cli/src/core/diff/text/SectionDiffer.ts` — section-level markdown diff
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
- [x] Output formatters: JSON, Markdown, SARIF, instructions (`packages/cli/src/output/`)
- [x] Target routing + instruction generation (`packages/cli/src/core/routing/`, `packages/cli/src/core/llm/InstructionGenerator.ts`)
- [x] Baseline command end-to-end + `init`, `validate`, `targets` commands
- [x] MCP command + tools (`packages/cli/src/mcp/`) — 4 tools: `anchor_compare`, `anchor_compare_corpus`, `anchor_targets`, `anchor_baseline_status`
- [x] Integration tests for MCP tools (`packages/cli/tests/integration/mcp-tools.test.ts`)
- [x] Image diff pipeline (`packages/cli/src/core/diff/images/`)
- [x] Extractor implementations: routes, schemas, screens (`packages/cli/src/core/baseline/extractors/`)
