# Anchor — Missing Features & Gaps to Consider

Items identified during reconciliation of the spec and three structural proposals. Organized by priority and phase fit.

---

## Gaps Found in the Spec (Should Fix)

These are things the spec says Anchor does but that were missing from the §13 source tree or had inconsistencies.

**`ConfigExtractor`** — Listed in the §6.2 extractor table ("Environment variables, feature flags, build config") but absent from the §13 directory tree. Added to the unified structure.

**`AsyncApiParser`** — §2 use cases include "AsyncAPI spec updated" as a trigger scenario, but only `OpenApiParser` appears in §13. Added to the unified structure.

**`targets` CLI command** — `anchor_targets` is defined as an MCP tool in §10, but no corresponding CLI command exists in §13. Users should be able to run `anchor targets` from the command line. Added to the unified structure.

**Windsurf template** — §8.5 explicitly names Windsurf as a supported host with `.windsurfrules`, but no template directory exists in §13. Added to the unified structure.

**Error handling strategy** — The spec defines six MCP tools and a CLI with multiple commands but has no error model. What does the MCP tool return when the git ref doesn't exist? When the LLM API is down? When the config file is malformed? A typed error hierarchy is essential and was added.

**Structured logging** — No logging strategy in the spec. A CLI tool that makes LLM calls, processes git repos, and writes files needs structured, level-aware logging. Added.

---

## Features Worth Adding (Should Consider)

### `anchor validate` — Corpus structure validator

A command that validates a spec corpus without running any diffs. Checks that `.anchor.yaml` is well-formed, that referenced file globs match actual files, that target names are consistent, and that image references in markdown point to existing files. Zero LLM cost. Useful as a pre-commit hook.

### `anchor doctor` — Setup diagnostics

A command that checks the environment: is `sharp` installed? Is an API key configured? Can Anchor reach the LLM provider? Is git available? Is the repo initialized? Reports what works, what's missing, and what to do about it. Critical for onboarding experience — the first thing a frustrated user should run.

### `anchor diff` as alias for `anchor compare`

"Compare" is technically correct but "diff" is what developers think of first. Aliasing `anchor diff` to `anchor compare` costs nothing and reduces friction.

### SARIF output format

SARIF (Static Analysis Results Interchange Format) is the standard format for static analysis results consumed by GitHub Code Scanning, VS Code, and other IDEs. If Anchor can output SARIF, its results show up as inline annotations in PRs and editors. This is a significant distribution channel — spec change warnings appear right next to the code, not in a separate tool.

### Webhook / notification hooks

The `--write-instructions` flag writes files, but there's no mechanism to notify external systems. A `--webhook` flag or configurable hook in `.anchor.yaml` could POST results to Slack, Discord, Teams, or custom endpoints. Important for teams that don't use git hooks or GitHub Actions.

### PR comment integration

A GitHub Actions output format that posts Anchor results as PR comments. When a spec change lands and downstream code PRs are opened, Anchor could annotate those PRs with "this PR should address the following spec changes." This closes the loop between spec change and code review.

### `anchor status` — Quick health check

A command that answers: "Is my implementation up to date with the spec?" Compares the latest instruction files (if they exist) against the current HEAD. Reports whether there are unaddressed spec changes. Useful as a git pre-push hook.

### Multi-language extractor support

The `BaseExtractor` interface is TypeScript-native. For broad adoption, the baseline engine should support extractors written in other languages (Python for Django/Flask, Go for Go projects). A subprocess-based extractor protocol (JSON over stdin/stdout) would allow community-contributed extractors in any language without requiring them to be TypeScript.

### Configurable severity rules

The spec has four severity levels (BREAKING, BEHAVIORAL, INFORMATIONAL, COSMETIC) but the classification rules are baked into the LLM prompt. Teams should be able to define custom severity rules in `.anchor.yaml` — for example, "any change to the `auth/` section is automatically BREAKING" or "changes to `drafts/**` are always COSMETIC." Rules-based pre-classification reduces LLM calls and makes behavior predictable.

### Dry-run mode for `anchor compare`

`anchor baseline --dry-run` exists in the spec, but `anchor compare` has no equivalent. A `--dry-run` flag that shows what would be analyzed (file list, section count, estimated token cost) without making any LLM calls would help teams understand cost before committing.

### Token budget / cost estimation

Before running LLM analysis, Anchor could estimate the token cost and display it. A `--max-cost` flag could abort if the estimated cost exceeds a threshold. Important for teams with tight LLM budgets, especially during early adoption when they're still learning what Anchor does.

### Incremental / resumable analysis

For large corpora, an interrupted `anchor compare` loses all progress. Saving intermediate results to `.anchor/cache/` and resuming from where it left off would make large analyses more robust. The cache module in the unified structure enables this but the spec doesn't describe the resumption logic.

### Spec coverage report

After running `anchor baseline`, how much of the codebase is covered by the generated spec? A coverage report showing "87% of routes documented, 60% of models documented, 0% of middleware documented" would help teams prioritize what to review and flesh out.

---

## Infrastructure Worth Adding (For OSS Health)

### Automated dependency updates (Renovate or Dependabot)

A monorepo with 15+ dependencies needs automated update PRs. Renovate is preferred for monorepos — it understands workspace protocols and can batch related updates.

### Bundle size tracking

`@anchor-ai/core` should stay lean for programmatic consumers. A CI check that reports bundle size changes per PR prevents accidental bloat. `size-limit` or `bundlewatch` are good options.

### API documentation generation

`@anchor-ai/core`'s public API surface should have auto-generated TypeScript docs. `typedoc` with a CI publish step to GitHub Pages gives programmatic consumers a reference without requiring manual documentation maintenance.

### Benchmarking / cost regression

LLM prompt changes can silently increase token spend. A benchmark suite that runs known inputs through the pipeline and reports token counts would catch cost regressions before they ship. This should be part of the PR review process for any change to `core/src/prompts/`.

### Example repositories

A separate `examples/` directory or a companion repo with complete, working example projects: a React app with Anchor configured, an API project with spec tracking, a mobile app with multi-target instructions. These serve as both documentation and integration test targets.

---

## Things Explicitly Out of Scope for MVP 

These were considered and deliberately excluded, per the spec's non-goals:

- **Spec creation for new features** — Other tools (OpenSpec, Spec Kit, Kiro) handle this
- **PR approval workflow** — Anchor feeds into workflows but doesn't own them
- **Pixel-level image comparison** — Visual regression tools do this better
- **Multi-repo corpus support** — Out of scope for now; revisit if demanded
- **General document summarization** — Anchor diffs, it doesn't summarize
