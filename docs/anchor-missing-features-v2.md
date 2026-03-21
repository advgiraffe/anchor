# Anchor — Missing Features & Gaps to Consider (v2)

Items identified during reconciliation of the spec, three structural proposals, and external architectural review. Organized by status.

---

## Promoted to Project Structure (No Longer Missing)

These items were identified as gaps and have been incorporated into the definitive project structure v2:

- **`ConfigExtractor`** — Added. Was in spec §6.2 table but absent from §13 tree.
- **`AsyncApiParser`** — Added. §2 use cases cite AsyncAPI but only OpenAPI was listed.
- **`targets` CLI command** — Added. MCP tool existed in §10 with no CLI equivalent.
- **Windsurf template** — Added. §8.5 names Windsurf but no template directory existed.
- **Typed error hierarchy** — Added. `AnchorError` base with `GitError`, `LlmApiError`, `ConfigError`, `ParseError`.
- **Structured logging** — Added. `Logger.ts` with swappable backend, level-aware.
- **`anchor doctor`** — Added. Environment diagnostics command.
- **`anchor validate`** — Added. Corpus structure validator, zero LLM cost.
- **`TokenEstimator` / `--dry-run` for compare** — Added. Cost estimation before LLM calls.
- **SARIF output format** — Added. Core provides `SarifFormatter` (pure transform), CLI writes file.
- **Configurable severity rules** — Added. User-defined overrides in `.anchor.yaml`.
- **`promptfoo` LLM regression testing** — Added. `evals/` directory with golden fixtures, weekly CI workflow.
- **Atomic cache writes** — Added. `.tmp` + `fs.renameSync` for crash safety.
- **Architecture Decision Records** — Added. `docs/adr/` directory.
- **Git binary requirement** — Documented. `anchor doctor` checks, CONTRIBUTING.md prerequisite.
- **`sharp` cost degradation warning** — Documented. `anchor doctor` reports, `--dry-run` accounts for it.

---

## Features Still Worth Adding (Future Phases)

### `anchor diff` as alias for `anchor compare`

"Compare" is technically correct but "diff" is what developers think first. Aliasing `anchor diff` to `anchor compare` costs nothing and reduces friction. Trivial to add in any phase.

### `anchor status` — Quick implementation health check

Answers: "Is my implementation up to date with the spec?" Compares latest instruction files (if they exist) against current HEAD. Reports whether there are unaddressed spec changes. Useful as a git pre-push hook. Phase 2+.

### PR comment integration

A GitHub Actions workflow that posts Anchor results as PR comments. Requires solving: authentication (GitHub token scoping), comment deduplication (don't spam the same PR), and result formatting. Rejected for Phase 1 scope but valuable for Phase 4+ as a community-contributed template.

### Webhook delivery (community plugin)

Team-specific webhook payloads (Slack block kit, Discord embeds, Teams cards, custom JSON) create an unbounded maintenance surface. Rejected as a built-in. The `IOutputFormatter` plugin interface allows community-contributed formatters. If demand materializes, a `@anchor-ai/webhooks` add-on package is the right vehicle.

### Multi-language extractor protocol

Subprocess-based JSON-over-stdin protocol for Python/Go/Ruby extractors. Deferred to Phase 3 per architectural review. Introduces process lifecycle management, cross-platform piping, and zombie cleanup complexity. Phase 1 `IExtractor` is Node/TypeScript only.

### Incremental / resumable analysis

For large corpora, an interrupted `anchor compare` loses progress beyond cached individual section results. Full resumability (save pipeline state, resume from checkpoint) is a Phase 4+ concern. The atomic cache already provides partial protection — cached section classifications survive interruption.

### Spec coverage report

After `anchor baseline`, report how much of the codebase is covered: "87% of routes documented, 60% of models documented, 0% of middleware documented." Helps teams prioritize review. Phase 5 (ships with baseline engine).

### Token budget / `--max-cost` flag

Abort if estimated cost exceeds a threshold. The `TokenEstimator` and `--dry-run` flag provide the foundation. A `--max-cost` flag that estimates and aborts (or prompts for confirmation) is a natural extension. Phase 2+.

---

## Infrastructure Worth Adding (For OSS Health)

### Automated dependency updates (Renovate)

A monorepo with 15+ dependencies needs automated update PRs. Renovate is preferred for pnpm workspaces — it understands workspace protocols and can batch related updates. Add after initial scaffolding.

### Bundle size tracking

`@anchor-ai/core` should stay lean for programmatic consumers. A CI check that reports bundle size changes per PR prevents accidental bloat. `size-limit` or `bundlewatch`. Add in Phase 2 when the package stabilizes.

### API documentation generation

`@anchor-ai/core`'s public API surface should have auto-generated TypeScript docs. `typedoc` with a CI publish step to GitHub Pages. Add when the public API is stable enough to document (Phase 2+).

### Prompt eval golden dataset maintenance

The `promptfoo` evaluation suite requires ongoing curation. Stale fixtures that don't reflect real-world messy inputs provide false security. Process: after every production misclassification report, add the failing case to `evals/datasets/`. Review dataset freshness quarterly.

### Example repositories

A separate `examples/` directory or companion repo with complete working example projects: a React app with Anchor configured, an API project with spec tracking, a mobile app with multi-target instructions. Both documentation and integration test targets. Phase 3+.

---

## Things Explicitly Out of Scope (Confirmed)

- **Spec creation for new features** — Other tools (OpenSpec, Spec Kit, Kiro) handle this
- **PR approval workflow** — Anchor feeds into workflows but doesn't own them
- **Pixel-level image comparison** — Visual regression tools do this better
- **Multi-repo corpus support** — Out of scope for now; revisit if demanded
- **General document summarization** — Anchor diffs, it doesn't summarize
- **Built-in webhook formatters** — Community plugin territory, not core/CLI
- **Non-TypeScript extractors in Phase 1** — Deferred to Phase 3
