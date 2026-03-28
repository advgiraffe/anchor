# Anchor — Definitive Project Structure (v2)

## Design Philosophy

This document resolves three competing structural proposals against the Anchor specification v3.0, incorporates external architectural review feedback, and produces a single, authoritative project structure. Every decision is explained.

---

## Architectural Review: Point-by-Point Evaluation

The following feedback was received from an external architect. Each point is accepted, modified, or rejected with rationale.

### Accepted — Incorporated into this document

**1. Strategy-based extractors with framework adapters.** Baseline extraction must not rely on fragile naming conventions (for example controller class names) as primary signals. Instead, extractors are organized as strategies that detect framework-declared behavior (route builder APIs, routing directives, schema artifacts). Node/TypeScript support remains first-class, and ASP.NET Core endpoint routing + Razor Pages are explicitly included as built-in strategies. Additional non-Node ecosystems beyond these built-ins still use the deferred subprocess JSON-over-stdin protocol in Phase 3. This avoids a monolithic extractor class and keeps framework logic modular while preserving a clear migration path for community plugins.

**2. `promptfoo` integration for LLM regression testing.** Mocking all LLM calls in CI means that if Anthropic alters Haiku's classification behavior, tests still pass while production breaks. This is a real risk. A dedicated `prompt-eval.yml` GitHub Actions workflow running on weekly cron (and manual dispatch) uses `promptfoo` against live APIs with curated "golden" fixture diffs. This catches severity classification drift (`BEHAVIORAL` vs `INFORMATIONAL`) before it reaches users. Prompt PRs can prove their changes don't degrade evaluation metrics.

**3. Atomic cache writes for crash safety.** Cache writes use `fs.writeFileSync` to a `.tmp` file followed by `fs.renameSync`. Interrupted runs (Ctrl+C mid-analysis) discard incomplete entries. A partial LLM response is never permanently cached as a valid result. If disk I/O becomes a bottleneck on very large repos (thousands of small section diffs), this can be hybridized with an in-memory buffer that flushes periodically — but atomic writes are the correct default.

**4. SARIF format generation in core, SARIF file writing + webhook execution in CLI.** The `@anchor_app/core` engine exposes an `IOutputFormatter` interface. A SARIF formatter that transforms `AnchorResult` objects into SARIF JSON strings is a pure data transformation — it belongs in core. The CLI owns the actual I/O: writing `anchor-results.sarif` to disk, performing HTTP POST for webhooks, managing secrets (Slack URLs, etc.). This preserves core as a zero-network-I/O, embeddable engine. Programmatic consumers who want webhooks write their own HTTP layer — slight friction, correct boundary.

**5. `TokenEstimator` added to LLM module.** Supports `--dry-run` mode on `anchor compare` by estimating token cost before making any LLM calls. Engineering managers need cost predictability to approve AI tools in CI budgets.

**6. `anchor doctor` command added.** Checks environment: sharp installed? API key configured? LLM provider reachable? Git available? Repo initialized? Reports what works, what's missing, and what to fix. Critical for onboarding — the first thing a frustrated user should run.

**7. `anchor validate` command added.** Validates corpus structure without running diffs: `.anchor.yaml` well-formed? File globs match actual files? Target names consistent? Image references in markdown point to existing files? Zero LLM cost. Useful as a pre-commit hook.

**8. Configurable severity rules in `.anchor.yaml`.** The rules-based `SeverityClassifier` now supports user-defined overrides: "any change to `auth/` is automatically BREAKING," "changes to `drafts/**` are always COSMETIC." This reduces LLM calls for predictable classifications and makes behavior deterministic where teams want it.

**9. `sharp` degradation cost warning.** The optional peer dependency approach is correct, but when sharp is absent and images skip pHash gating to go directly to the vision LLM, token costs spike silently. Added: `anchor doctor` warns about missing sharp and estimates the cost difference. The `--dry-run` token estimator accounts for pHash availability when projecting costs.

**10. Git binary requirement documented.** `simple-git` requires a globally installed git binary. Some automated CI environments (slim Docker containers, certain OpenClaw runners) may not have git. Added to `anchor doctor` checks and documented in CONTRIBUTING.md prerequisites.

### Rejected — With rationale

**11. PR comment integration as a GitHub Actions template in `templates/`.** Rejected for Phase 1 scope. Writing a GitHub Actions workflow that posts Anchor results as PR comments requires solving authentication (GitHub token scoping), comment deduplication (don't spam the same PR), and result formatting that works across different repo structures. This is a meaningful feature but it's a Phase 4+ concern. The `anchor.yml.template` in `templates/github-actions/` already provides the CI foundation. PR commenting can be a community-contributed template later.

**12. `webhooks.ts` as a built-in output module.** Rejected as a built-in. Webhook payloads are highly team-specific (Slack block kit format vs. Discord embeds vs. Teams cards vs. custom JSON). Building and maintaining formatters for each platform creates an unbounded maintenance surface. Instead, `anchor compare` supports `--format json` piped to any HTTP client (`curl`, custom scripts). The `IOutputFormatter` plugin interface allows community-contributed webhook formatters without burdening core or CLI maintenance. If demand materializes, a `@anchor_app/webhooks` add-on package is the right vehicle.

---

## Structural Decision: Two-Package Workspace

Three approaches were evaluated:

**Full monorepo (8+ packages)** — pnpm workspaces, Turborepo, Changesets across `core`, `git`, `images`, `llm`, `baseline`, `mcp`, `config`, `templates`. Rejected for Phase 1: too many packages for zero users. The coordination cost of cross-package builds, versioning, and contributor onboarding is unjustified when there is one binary and no external consumers of individual subsystems.

**Single package with path aliases** — One `package.json`, internal modules connected via TypeScript path aliases (`@anchor/llm`, `@anchor/diff`). Rejected: while pragmatic, it prevents third parties from consuming the engine programmatically without pulling in CLI dependencies, chokidar, commander, and MCP server code. The core engine has genuine standalone value.

**Two-package workspace (core + cli)** — Selected. This is the right granularity for a project at Anchor's stage. It provides one meaningful architectural boundary — engine vs. application — without the overhead of managing eight package release cycles.

The separation is real, not cosmetic: `@anchor_app/core` has zero CLI, MCP, or file-watching dependencies. A third party can `npm install @anchor_app/core` and run diffs programmatically. The CLI package depends on core and adds the binary, MCP server, file watcher, and host integration templates.

**Future extraction is built in.** Within `@anchor_app/core`, TypeScript path aliases simulate future package names (`@anchor/llm`, `@anchor/diff`, etc.). When a subsystem needs independent release cadence — most likely `@anchor/llm` first — the path alias is deleted, a real `package.json` is added, and import statements require zero changes.

**Workspace tooling:**

- **pnpm workspaces** over npm or Yarn. pnpm's strict hoisting prevents phantom dependency bugs, its `workspace:*` protocol makes internal linking explicit, and its CI performance is measurably better. This is the industry standard for serious TypeScript monorepos.
- **Turborepo** for task orchestration. Even with two packages, the build caching and dependency-aware task graph (`build → test → lint`) pay for themselves immediately. The configuration is minimal.
- **Changesets** for release management. Each PR that changes a published package includes a changeset file describing the change. This makes versioning, changelogs, and coordinated releases self-documenting. Critical for open source trust.

---

## Directory Tree

```
anchor/
│
├── .changeset/                     # Changeset config + pending release notes
│   └── config.json
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # Lint, typecheck, test on every PR
│   │   ├── release.yml             # Publish packages on merge to main
│   │   ├── anchor-self-check.yml   # Dogfood: Anchor checks its own spec corpus
│   │   └── prompt-eval.yml         # Weekly + manual: promptfoo LLM regression tests
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
│
├── packages/
│   │
│   ├── core/                       # @anchor_app/core — pure engine, no CLI/MCP deps
│   │   ├── package.json
│   │   ├── tsconfig.json           # Extends ../../tsconfig.base.json, includes path aliases
│   │   ├── README.md
│   │   │
│   │   ├── src/
│   │   │   ├── index.ts            # Public API surface — explicit exports only
│   │   │   │
│   │   │   ├── models/             # Pure TypeScript interfaces (spec §11) — no runtime deps
│   │   │   │   └── index.ts        # AnchorResult, FileDelta, SectionDelta, ImageDelta, etc.
│   │   │   │
│   │   │   ├── errors/             # Typed error hierarchy
│   │   │   │   ├── AnchorError.ts  # Base class — structured code + message
│   │   │   │   ├── GitError.ts
│   │   │   │   ├── LlmApiError.ts
│   │   │   │   ├── ConfigError.ts
│   │   │   │   └── ParseError.ts
│   │   │   │
│   │   │   ├── logger/             # Structured logging interface (swappable backend)
│   │   │   │   └── Logger.ts
│   │   │   │
│   │   │   ├── plugins/            # Plugin architecture — extension point contracts
│   │   │   │   ├── PluginRegistry.ts
│   │   │   │   └── types.ts        # IDocumentParser, IExtractor, ILlmProvider, IOutputFormatter
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── AnchorConfig.ts # Zod schema mirroring .anchor.yaml (spec §12)
│   │   │   │   └── ConfigLoader.ts # js-yaml loader + schema validation
│   │   │   │
│   │   │   ├── git/
│   │   │   │   ├── GitExtractor.ts # simple-git wrapper: blob extraction, history
│   │   │   │   ├── GitTreeDiffer.ts# File-level add/remove/rename detection
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── llm/
│   │   │   │   ├── LlmClient.ts           # Interface (implements ILlmProvider)
│   │   │   │   ├── LlmClientFactory.ts    # Config-driven provider → concrete client
│   │   │   │   ├── providers/
│   │   │   │   │   ├── AnthropicClient.ts # @anthropic-ai/sdk + prompt caching
│   │   │   │   │   ├── OpenAiClient.ts
│   │   │   │   │   ├── AzureOpenAiClient.ts
│   │   │   │   │   └── OllamaClient.ts    # Local/self-hosted model support
│   │   │   │   ├── RateLimiter.ts         # Token-bucket + retry logic
│   │   │   │   ├── TokenEstimator.ts      # Pre-call cost estimation for --dry-run
│   │   │   │   ├── SectionClassifier.ts   # Batched text severity classification
│   │   │   │   ├── ImageDiffDescriber.ts  # Role-aware vision prompts
│   │   │   │   ├── InstructionGenerator.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── prompts/                   # Version-controlled prompt templates
│   │   │   │   ├── classify-section.md
│   │   │   │   ├── describe-image-diff.md
│   │   │   │   ├── generate-instructions.md
│   │   │   │   └── baseline-section.md
│   │   │   │
│   │   │   ├── cache/                     # Disk-based LLM response cache (toggleable)
│   │   │   │   ├── LlmCache.ts            # Interface
│   │   │   │   └── FileCache.ts           # Atomic writes: .tmp → rename. Crash-safe.
│   │   │   │
│   │   │   ├── diff/
│   │   │   │   ├── CorpusTreeDiffer.ts    # Corpus-level file tree diff
│   │   │   │   ├── CrossAssetCorrelator.ts# Text + image grouping
│   │   │   │   ├── text/
│   │   │   │   │   ├── DocumentParser.ts  # IDocumentParser interface
│   │   │   │   │   ├── SectionDiffer.ts   # Fuzzy heading match (Levenshtein ~80%)
│   │   │   │   │   └── parsers/           # Built-in parser plugins
│   │   │   │   │       ├── MarkdownParser.ts
│   │   │   │   │       ├── OpenApiParser.ts
│   │   │   │   │       ├── AsyncApiParser.ts  # §2 use case: AsyncAPI spec updated
│   │   │   │   │       ├── PlainTextParser.ts
│   │   │   │   │       └── PdfParser.ts       # Text extraction for PDF pipeline (§7.1)
│   │   │   │   ├── images/
│   │   │   │   │   ├── PerceptualHasher.ts    # pHash via sharp (optional peer dep)
│   │   │   │   │   ├── ImageRoleClassifier.ts
│   │   │   │   │   ├── ImageChangeDetector.ts
│   │   │   │   │   └── PdfPageRenderer.ts     # PDF pages → images for vision pipeline
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── routing/
│   │   │   │   ├── TargetRouter.ts
│   │   │   │   ├── GlobMatcher.ts         # minimatch
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── baseline/
│   │   │   │   ├── extractors/
│   │   │   │   │   ├── BaseExtractor.ts   # Abstract base + IExtractor plugin interface
│   │   │   │   │   ├── RouteExtractor.ts  # Express, Fastify, Hono, Next.js, tRPC
│   │   │   │   │   ├── SchemaExtractor.ts # Prisma, Drizzle, Zod, TypeORM, Mongoose
│   │   │   │   │   ├── ScreenExtractor.ts # React/RN component tree, Next.js pages
│   │   │   │   │   ├── OpenApiExtractor.ts# Passthrough existing OpenAPI specs
│   │   │   │   │   ├── AssetExtractor.ts  # Images, diagrams in component dirs
│   │   │   │   │   ├── PackageExtractor.ts# Dependencies, framework detection
│   │   │   │   │   └── ConfigExtractor.ts # Env vars, feature flags, build config (spec §6.2)
│   │   │   │   ├── SectionGenerator.ts    # Haiku pass: code → spec prose, batched
│   │   │   │   ├── CorpusWriter.ts        # Assemble folder structure
│   │   │   │   ├── TargetDetector.ts      # Auto-detect targets from codebase signals
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── severity/
│   │   │   │   └── SeverityClassifier.ts  # Rules-based pre-filter + configurable overrides
│   │   │   │
│   │   │   └── output/                    # Pure data formatters (no I/O)
│   │   │       ├── IOutputFormatter.ts    # Interface
│   │   │       ├── JsonFormatter.ts       # AnchorResult → JSON string
│   │   │       └── SarifFormatter.ts      # AnchorResult → SARIF JSON string
│   │   │
│   │   └── tests/
│   │       └── unit/
│   │           ├── diff/
│   │           ├── baseline/
│   │           ├── routing/
│   │           ├── config/
│   │           ├── llm/
│   │           ├── severity/
│   │           ├── cache/
│   │           ├── output/
│   │           └── git/
│   │
│   └── cli/                               # @anchor_app/anchor — the binary + MCP server
│       ├── package.json                   # bin: { "anchor": "./dist/index.js" }
│       ├── tsconfig.json
│       ├── README.md
│       │
│       ├── src/
│       │   ├── index.ts                   # Commander.js root, #!/usr/bin/env node
│       │   │
│       │   ├── commands/
│       │   │   ├── baseline.ts            # anchor baseline [--dry-run|--no-llm|--update|--report]
│       │   │   ├── compare.ts             # anchor compare [--dry-run estimates tokens/cost]
│       │   │   ├── watch.ts               # anchor watch (chokidar daemon)
│       │   │   ├── init.ts                # anchor init --host [claude|copilot|cursor|windsurf|openclaw]
│       │   │   ├── targets.ts             # anchor targets (list configured targets)
│       │   │   ├── doctor.ts              # anchor doctor (environment diagnostics)
│       │   │   ├── validate.ts            # anchor validate (corpus structure check, zero LLM)
│       │   │   └── mcp.ts                 # anchor mcp (starts MCP server, stdio or SSE)
│       │   │
│       │   ├── output/
│       │   │   ├── FormatterRegistry.ts   # Pluggable output formatters (IOutputFormatter)
│       │   │   ├── json.ts                # Write JSON to file/stdout
│       │   │   ├── markdown.ts            # Write markdown to file/stdout
│       │   │   ├── instructions.ts        # .anchor/instructions/{target}.md writer
│       │   │   └── sarif.ts               # Write SARIF file (uses core SarifFormatter)
│       │   │
│       │   └── mcp/
│       │       ├── McpServer.ts           # @modelcontextprotocol/sdk, stdio + SSE
│       │       └── tools/
│       │           ├── CompareCorpusTool.ts
│       │           ├── CompareFileTool.ts
│       │           ├── ManifestTool.ts
│       │           ├── HistoryTool.ts
│       │           ├── TargetsTool.ts
│       │           └── BaselineStatusTool.ts
│       │
│       └── tests/
│           └── unit/
│               ├── commands/
│               ├── output/
│               └── mcp/
│
├── evals/                                 # promptfoo evaluation suite
│   ├── promptfooconfig.yaml               # Test definitions, model targets, thresholds
│   ├── datasets/
│   │   ├── classification-golden.yaml     # Known section diffs → expected severity
│   │   ├── instruction-golden.yaml        # Known deltas → expected instruction quality
│   │   └── image-diff-golden.yaml         # Known image pairs → expected descriptions
│   └── README.md                          # How to run evals, how to add fixtures
│
├── templates/                             # Host integration templates (shipped with CLI)
│   ├── claude/
│   │   ├── CLAUDE.md.template
│   │   └── anchor-check.md.template       # Slash command
│   ├── copilot/
│   │   ├── copilot-instructions.md.template
│   │   └── anchor-skill.md.template       # Fallback for non-MCP contexts
│   ├── cursor/
│   │   └── anchor.mdc.template
│   ├── windsurf/
│   │   └── anchor.windsurfrules.template  # §8.5 — was missing from spec source tree
│   ├── openclaw/
│   │   └── openclaw-workflow.yaml.template
│   └── github-actions/
│       └── anchor.yml.template
│
├── tests/                                 # Cross-package integration tests + shared fixtures
│   ├── integration/
│   │   ├── cli/                           # CLI invocation end-to-end
│   │   │   ├── compare-single-file.test.ts
│   │   │   ├── compare-corpus.test.ts
│   │   │   ├── baseline-engine.test.ts
│   │   │   └── doctor.test.ts
│   │   └── mcp/                           # MCP protocol conformance
│   │       └── mcp-tools.test.ts
│   └── fixtures/
│       ├── repos/                         # Programmatically constructed bare git repos
│       │   ├── simple-spec/               # Single-file spec with known diff
│       │   ├── corpus-spec/               # Multi-file corpus with adds/removes/renames
│       │   └── image-changes/             # Repos with image diffs at known pHash distances
│       ├── codebases/                     # Sample apps for baseline testing
│       │   ├── express-app/
│       │   ├── nextjs-app/
│       │   └── react-native-app/
│       └── specs/                         # Static spec fixture files
│
├── scripts/
│   └── create-fixture-repos.ts            # Seeder: builds deterministic git fixtures
│
├── docs/
│   ├── anchor-spec.md                     # Source of truth specification
│   ├── architecture.md                    # Implementation decisions and rationale
│   └── adr/                               # Architecture Decision Records
│       ├── 001-two-package-workspace.md
│       ├── 002-plugin-registry.md
│       ├── 003-prompts-as-files.md
│       ├── 004-llm-cache-strategy.md
│       ├── 005-atomic-cache-writes.md
│       └── 006-sarif-webhook-boundary.md
│
├── spec/                                  # Anchor's own spec corpus (dogfood)
│   ├── .anchor.yaml
│   ├── architecture/
│   │   └── overview.md
│   └── api/
│       └── mcp-tools.md
│
├── turbo.json                             # Task pipeline: build, test, lint, typecheck
├── pnpm-workspace.yaml                    # packages/*
├── package.json                           # Root: scripts, shared devDependencies
├── tsconfig.base.json                     # Base TS config extended by both packages
├── .eslintrc.js                           # Shared ESLint config + dependency direction rules
├── vitest.workspace.ts                    # Vitest project references for both packages
├── .anchor.yaml                           # Anchor dogfoods itself on spec/
│
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE                                # MIT
```

---

## Package Dependency Graph

```
@anchor_app/anchor (packages/cli)
  └── @anchor_app/core

@anchor_app/core (packages/core)
  └── (no internal dependencies — pure engine)
```

Within `@anchor_app/core`, internal module dependency direction is enforced via ESLint:

```
models     ← no outbound imports (pure interfaces)
errors     ← models
logger     ← (standalone)
plugins    ← models
config     ← models, errors
git        ← models, config, errors
llm        ← models, config, errors, plugins
cache      ← models, config
diff       ← models, config, git, llm, cache, plugins
routing    ← models, config
baseline   ← models, config, git, llm, plugins
severity   ← models, config
output     ← models (pure data transformation, no I/O)
```

Violations are caught by `eslint-plugin-import` no-cycle rules in CI. `diff` must not import `baseline`. `llm` must not import `diff`. `output` must not import anything with I/O. The CLI is the only layer allowed to import everything.

---

## Key Design Decisions

### Plugin interfaces from day one

All extension points — document parsers, baseline extractors, LLM providers, output formatters — are defined as interfaces in `core/src/plugins/types.ts`. Built-in implementations are first-class plugins registered through `PluginRegistry`. This means:

- Tests can swap LLM providers with mocks trivially
- Community contributors can add a new extractor by implementing `IExtractor` without understanding the diff engine
- Future third-party plugins don't require forking

**Phase 1 scope:** `IExtractor` targets Node/TypeScript ecosystems only. The subprocess-based JSON-over-stdin protocol for Python/Go/Ruby extractors is deferred to Phase 3. This is a deliberate tradeoff — shipping Phase 1 fast matters more than language-agnostic extractors with zero users.

### Prompts as versioned `.md` files

LLM prompts live in `core/src/prompts/` as markdown files, not inline template strings. Three benefits: prompt changes are reviewable in PRs as first-class diffs, prompts can be regression-tested via `promptfoo` against known inputs, and contributors can improve prompts without touching TypeScript. The `evals/` directory contains golden fixture datasets that validate prompt behavior against live APIs.

### Typed error hierarchy

MCP tools need structured error codes. CLI needs human-friendly messages. A single `AnchorError` base class with typed subclasses (`GitError`, `LlmApiError`, `ConfigError`, `ParseError`) serves both consumers. Each error carries a machine-readable code and a user-facing message.

### LLM response cache with atomic writes

The `cache/` module prevents re-spending tokens on identical sections during development iterations. Keyed on `{model, prompt-hash, content-hash}`. Toggleable via `.anchor.yaml` (`cache: enabled | disabled`). Stored at `.anchor/cache/` on disk.

Cache writes use atomic file operations: write to a `.tmp` file, then `fs.renameSync` to the final path. If a run is interrupted mid-analysis (Ctrl+C, crash, OOM), incomplete cache entries are discarded on next run. A partial LLM response is never permanently cached as valid. If disk I/O becomes a bottleneck on very large repos with thousands of small diffs, the implementation can be hybridized with an in-memory buffer that flushes periodically.

### Token estimation and cost transparency

`TokenEstimator` in the LLM module provides pre-call cost estimates. `anchor compare --dry-run` shows what would be analyzed (file list, section count, estimated token cost, estimated dollar cost) without making any LLM calls. The estimator accounts for pHash availability — when `sharp` is absent and images skip perceptual hashing, the cost estimate reflects the additional vision LLM calls.

### Configurable severity rules

The `SeverityClassifier` supports user-defined overrides in `.anchor.yaml`:

```yaml
severity:
  rules:
    - glob: "auth/**"
      override: BREAKING        # Any change to auth/ is automatically BREAKING
    - glob: "drafts/**"
      override: COSMETIC        # Changes to drafts are always COSMETIC
    - sections: ["Rate Limiting", "Deprecation"]
      override: BREAKING        # These sections are always high-severity
```

Rules-based pre-classification runs before LLM analysis. Matched sections skip the LLM classification call entirely — deterministic, zero cost. Unmatched sections proceed to Haiku classification as before. This addresses the severity drift concern: teams can make critical classifications deterministic rather than relying on LLM judgment.

### Output formatter architecture

`@anchor_app/core` owns pure data transformation: `IOutputFormatter` interface with `JsonFormatter` and `SarifFormatter` implementations that convert `AnchorResult` into strings. Zero I/O, zero network dependencies.

`@anchor_app/anchor` (CLI) owns execution: writing files to disk, piping to stdout. The SARIF output writes `anchor-results.sarif` which GitHub Code Scanning consumes. Teams wanting webhook delivery pipe `anchor compare --format json` to their own HTTP client or build a custom `IOutputFormatter` plugin.

This boundary prevents `core` from requiring networking dependencies or managing environmental secrets, preserving its value as an embeddable engine.

### Structured logging

`Logger.ts` defines a logging interface with structured fields (not `console.log` calls). The CLI wires it to console output. Programmatic consumers can wire it to their own logging infrastructure. Log levels: `debug`, `info`, `warn`, `error`.

---

## Key Configuration Files

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": true
    },
    "test:integration": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### `packages/core/tsconfig.json` — path aliases for future extraction

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "@anchor/models": ["./src/models/index.ts"],
      "@anchor/config": ["./src/config/index.ts"],
      "@anchor/git": ["./src/git/index.ts"],
      "@anchor/llm": ["./src/llm/index.ts"],
      "@anchor/diff": ["./src/diff/index.ts"],
      "@anchor/routing": ["./src/routing/index.ts"],
      "@anchor/baseline": ["./src/baseline/index.ts"],
      "@anchor/cache": ["./src/cache/index.ts"],
      "@anchor/output": ["./src/output/index.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["tests"]
}
```

When `@anchor/llm` is eventually extracted to a real npm package, the path alias is deleted and a `package.json` dependency is added. Import statements remain unchanged.

### Root `package.json`

```json
{
  "private": true,
  "scripts": {
    "build":             "turbo run build",
    "test":              "turbo run test",
    "test:integration":  "turbo run test:integration",
    "lint":              "turbo run lint",
    "typecheck":         "turbo run typecheck",
    "eval:prompts":      "cd evals && npx promptfoo eval",
    "changeset":         "changeset",
    "version":           "changeset version",
    "release":           "turbo run build && changeset publish"
  },
  "devDependencies": {
    "turbo": "latest",
    "@changesets/cli": "latest",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "latest",
    "eslint-plugin-import": "latest",
    "tsup": "latest",
    "prettier": "^3.0.0",
    "promptfoo": "latest"
  }
}
```

### `.anchor.yaml` — configurable severity rules

```yaml
version: 3

severity:
  rules:
    - glob: "auth/**"
      override: BREAKING
    - glob: "drafts/**"
      override: COSMETIC
    - sections: ["Rate Limiting", "Deprecation"]
      override: BREAKING

# ... rest of config per spec §12
```

---

## npm Dependency Map

| Package | Location | Purpose |
|---|---|---|
| `@anthropic-ai/sdk` | core | Anthropic API + vision + prompt caching |
| `openai` | core | OpenAI / Azure provider swap |
| `simple-git` | core | Git blob extraction and history |
| `sharp` | core (peer, optional) | Image processing + pHash computation |
| `remark` + `remark-parse` | core | Markdown AST parsing |
| `js-yaml` | core | YAML config + OpenAPI parsing |
| `zod` | core | Config schema validation |
| `minimatch` | core | Glob pattern matching |
| `@ts-morph/common` | core | TypeScript AST for ScreenExtractor |
| `@modelcontextprotocol/sdk` | cli | MCP server hosting (stdio + SSE) |
| `commander` | cli | CLI argument parsing |
| `chokidar` | cli | File watching (`anchor watch`) |
| `vitest` | dev (root) | Test framework |
| `tsup` | dev (root) | Build/bundle (fast esbuild-based) |
| `promptfoo` | dev (root) | LLM prompt regression testing |

`sharp` is a peer dependency of `@anchor_app/core` (optional). Image pipeline features degrade gracefully when sharp is not installed — pHash gating is skipped, and images go directly to vision LLM. **Warning:** this degradation path increases token costs. `anchor doctor` reports whether sharp is installed and `--dry-run` accounts for its absence in cost estimates.

`simple-git` requires a globally installed `git` binary. `anchor doctor` checks for git availability. Documented as a prerequisite in CONTRIBUTING.md and README.

---

## What Gets Published

| Package | npm Name | Published | Reason |
|---|---|---|---|
| `packages/core` | `@anchor_app/core` | Yes | Embeddable engine for third-party tools |
| `packages/cli` | `@anchor_app/anchor` | Yes | The `anchor` binary users install |

The docs site and playground (if added later) are deployed, not published.

---

## Testing Strategy

**Unit tests** live co-located in each package (`packages/core/tests/unit/`, `packages/cli/tests/unit/`). Mocked LLM, mocked git, test one class at a time.

**Integration tests** live in `tests/integration/`. They use real git repos built programmatically by `scripts/create-fixture-repos.ts` in `beforeAll`. LLM calls are mocked. Full pipeline from CLI invocation to output file.

**No real LLM calls in standard CI.** The `ci.yml` workflow uses mocked providers exclusively. Fast, deterministic, no API key management.

**LLM regression tests** run via `promptfoo` in a separate `prompt-eval.yml` workflow:

```yaml
name: Prompt Evaluation
on:
  schedule:
    - cron: '0 6 * * 1'          # Weekly Monday 6am UTC
  workflow_dispatch: {}           # Manual trigger for prompt PRs

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: cd evals && npx promptfoo eval
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: prompt-eval-results
          path: evals/output/
```

The `evals/datasets/` directory contains curated "golden" fixtures — known section diffs with expected severity classifications, known deltas with expected instruction quality. Contributors submitting prompt PRs run `pnpm eval:prompts` locally (with their own API key) to prove their changes don't degrade metrics. The weekly cron catches upstream model drift.

**Fixture repos** are created via `simple-git` init + scripted commits. No `.git` directories are checked into the repository. The seeder script is deterministic — same output every run.

---

## CI Pipelines

### `.github/workflows/ci.yml`

```yaml
name: CI
on: [pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - run: pnpm install --frozen-lockfile

      # Turborepo runs only tasks affected by changed files
      - run: pnpm turbo run build test lint typecheck --filter=...[HEAD^1]

      # Integration tests (real git fixtures, mocked LLM)
      - run: pnpm turbo run test:integration --filter=...[HEAD^1]

      # Changeset check
      - name: Check changeset
        run: npx changeset status --since=origin/main
```

### `.github/workflows/anchor-self-check.yml`

```yaml
name: Anchor self-check
on:
  push:
    branches: [main]
    paths: ['spec/**']

jobs:
  self-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: node packages/cli/dist/index.js compare --corpus spec/ --from HEAD~1 --to HEAD
               --write-instructions .anchor/instructions/
               --format json
      - uses: actions/upload-artifact@v4
        with:
          name: anchor-instructions
          path: .anchor/instructions/
```

---

## `anchor doctor` — Environment Diagnostics

`anchor doctor` is a first-class command that checks everything a user needs for Anchor to work correctly:

```
$ anchor doctor

Anchor Doctor v3.0

  ✓ Node.js          v20.11.0 (>=18 required)
  ✓ git              v2.43.0 (required for all operations)
  ✓ pnpm             v9.1.0 (optional, for development)
  ✓ .anchor.yaml     Found at ./docs/specs/.anchor.yaml
  ✓ Config valid     3 targets configured (ios, android, qa)

  ✓ sharp            Installed — pHash gating enabled
                     (Without sharp: images skip pHash, vision LLM cost increases ~3x)

  ✓ Anthropic API    Key found in ANTHROPIC_API_KEY
  ✓ API reachable    claude-haiku-4-5 responding (latency: 240ms)

  ⚠ Cache            .anchor/cache/ not found — first run will be slower
  ⚠ Windsurf rules   .windsurfrules not found — run `anchor init --host windsurf`

  0 errors, 2 warnings
```

This is the first thing a frustrated user should run. It catches the most common setup problems: missing git binary, missing API key, sharp not installed (with cost impact explanation), malformed config.

---

## Open Source Contribution Experience

### For a first-time contributor fixing a parser bug

```bash
git clone https://github.com/anchor-ai/anchor
cd anchor
pnpm install

cd packages/core
pnpm test

# Fix: packages/core/src/diff/text/parsers/MarkdownParser.ts
# Test: packages/core/tests/unit/diff/MarkdownParser.test.ts
pnpm test
pnpm run typecheck

cd ../..
pnpm changeset      # Guided prompt: which package? patch/minor/major?
git commit -m "fix(core): handle nested heading sections in MarkdownParser"
```

No API key. No native dependencies (sharp is optional). `@anchor_app/core` unit tests run entirely in-process with zero external service calls.

### For a contributor improving an LLM prompt

```bash
cd anchor

# Edit: packages/core/src/prompts/classify-section.md
# Run evals locally (requires ANTHROPIC_API_KEY):
pnpm eval:prompts

# Review results in evals/output/
# Confirm: no regression in classification accuracy
# Confirm: no increase in average token usage

pnpm changeset      # patch bump on @anchor_app/core
git commit -m "fix(core): improve BEHAVIORAL vs INFORMATIONAL classification prompt"
```

The `promptfoo` evaluation provides quantifiable evidence that the prompt change improves (or at minimum doesn't degrade) behavior. PR reviewers can see the eval results.

### For a contributor adding a new baseline extractor

```bash
cd packages/core
# Implement IExtractor interface:
#   src/baseline/extractors/DrizzleExtractor.ts
# Test:
#   tests/unit/baseline/DrizzleExtractor.test.ts
# Register:
#   src/baseline/extractors/index.ts
pnpm test
pnpm changeset      # minor bump on @anchor_app/core
```

**Phase 1 constraint:** Extractors must be Node/TypeScript compatible. The `IExtractor` interface uses TypeScript types and expects in-process execution. Non-TS extractors (Python Django, Go, Ruby Rails) are deferred to Phase 3 when the subprocess-based JSON protocol is implemented.

### CODEOWNERS

```
# Core engine — high review bar
/packages/core/                     @anchor_app/core-team

# LLM prompts — cost implications, requires eval run
/packages/core/src/prompts/         @anchor_app/core-team

# Plugin interfaces — API contract, high review bar
/packages/core/src/plugins/         @anchor_app/core-team

# Prompt evaluation fixtures — quality gates
/evals/                             @anchor_app/core-team

# CLI and MCP layer
/packages/cli/                      @anchor_app/maintainers

# Templates — community-friendly, lighter review
/templates/                         @anchor_app/contributors

# Docs
/docs/                              @anchor_app/docs-team
```

### CONTRIBUTING.md structure

1. **Prerequisites** — Node >=18, git, pnpm. Optional: sharp (with explanation of what you lose without it)
2. **Where to start** — points to `packages/core` as the simplest entry point, lists "good first issue" label
3. **Package map** — one-paragraph description of each package and what it does
4. **Local development** — `pnpm install`, how to run tests, how to test CLI locally with `pnpm link`
5. **Adding an extractor** — step-by-step guide (most common contribution type). Notes Phase 1 TS-only constraint.
6. **Adding a document parser** — step-by-step guide implementing `IDocumentParser`
7. **Adding a host template** — step-by-step guide
8. **LLM prompt changes** — must run `pnpm eval:prompts` and include results in PR description
9. **Changeset requirement** — every PR that changes a published package needs a changeset
10. **Fixtures** — how to add git fixture repos for integration tests
11. **Architecture Decision Records** — how to propose structural changes via ADRs

---

## Internal Module Dependency Enforcement

The ESLint configuration enforces the dependency direction graph within `@anchor_app/core`. This prevents architectural erosion as the codebase grows:

```javascript
// .eslintrc.js (simplified)
module.exports = {
  plugins: ['import'],
  rules: {
    'import/no-cycle': 'error',
    'no-restricted-imports': ['error', {
      patterns: [
        // models/ must not import anything internal
        { group: ['../diff/*', '../llm/*', '../git/*', '../baseline/*'],
          message: 'models/ must have zero internal dependencies' },
        // diff/ must not import baseline/
        { group: ['../baseline/*'],
          message: 'diff/ must not depend on baseline/' },
        // llm/ must not import diff/
        { group: ['../diff/*'],
          message: 'llm/ must not depend on diff/' },
        // output/ must not import anything with I/O
        { group: ['../git/*', '../cache/*'],
          message: 'output/ must be pure data transformation' },
      ]
    }]
  }
};
```

---

## Phase-by-Phase Activation

| Phase | What gets built | Key deliverables |
|---|---|---|
| **Phase 1** — Core Diff (MVP) | `models`, `config`, `git`, `llm` (Anthropic only + TokenEstimator), `diff/text` (Markdown only), `severity` (with configurable rules), `errors`, `logger`, `output` (JSON + SARIF formatters), `cache` (atomic writes) | `anchor compare` (single file, `--dry-run`), `anchor mcp`, `anchor doctor`, `anchor validate`, MCP tools: `compare`, `history` |
| **Phase 2** — Corpus + Targets | `diff/CorpusTreeDiffer`, `routing`, CLI `init`/`targets` commands, instructions output | `anchor compare --corpus`, `anchor init --host`, `--write-instructions`, `.anchor.yaml` loading |
| **Phase 3** — Image Pipeline + Non-TS Extractors | `diff/images`, `prompts/describe-image-diff.md`, subprocess-based extractor protocol | Image pHash gating, vision LLM diff, IExtractor v2 with JSON-over-stdin for Python/Go |
| **Phase 4** — Correlation + Agentic | `CrossAssetCorrelator`, CLI `watch` command | Correlated deltas, `anchor watch`, GitHub Actions template |
| **Phase 5** — Baseline Engine | `baseline/*` extractors (TS-only), `SectionGenerator`, `TargetDetector` | `anchor baseline`, `anchor baseline --update`, `baseline_status` MCP tool |
| **Phase 6** — Parser Coverage + Hardening | `OpenApiParser`, `AsyncApiParser`, `PlainTextParser`, `PdfParser`, `OpenAiClient` | Multi-format support, provider swap, parallel LLM, result caching |

In Phase 1, the CLI directly imports core modules. The two-package boundary exists from the start but both packages are published together. Independent release cadence comes when external consumers appear.

---

## When to Extract Sub-Packages

The signal to extract a core subsystem to a standalone npm package:

1. A second project wants to depend on it independently, **and**
2. It needs an independent release cadence from the main CLI

Most likely extraction order: `@anchor_app/llm` first (reusable LLM abstraction with rate limiting, caching, multi-provider support), then `@anchor_app/models` (shared TypeScript interfaces). The diff and baseline engines are implementation details — unlikely to be extracted.

When extraction happens: delete the path alias from `tsconfig.json`, create a new `packages/llm/` directory with its own `package.json`, and add it to `pnpm-workspace.yaml`. Import statements in consuming code require zero changes.

---

## Resolved Conflicts Between Proposals

| Topic | OG Monorepo | Single Package | Two-Package | Resolution |
|---|---|---|---|---|
| Package count | 8+ packages | 1 package | 2 packages | **2 packages.** One real boundary (engine vs. app). More is premature. |
| Workspace tool | pnpm | npm | npm | **pnpm.** Strict hoisting, better CI perf, industry standard. |
| Build orchestration | Turborepo | None (single pkg) | None specified | **Turborepo.** Caching pays off even with 2 packages. |
| Release management | Changesets | Manual | Not specified | **Changesets.** Self-documenting, contributor-friendly. |
| MCP server location | Separate package | In CLI | In CLI | **In CLI.** MCP is an application concern, not an engine concern. |
| Templates location | Separate package | In repo root | In repo root | **Repo root `templates/`.** Shipped with CLI, not a separate package. |
| Baseline location | Separate package | In src/ | In core | **In core.** Baseline is engine logic, not application logic. |
| Prompt storage | Inline strings | Inline strings | `.md` files | **`.md` files.** Reviewable, testable, versionable. Eval'd via promptfoo. |
| Error handling | Not specified | Not specified | Typed hierarchy | **Typed hierarchy.** MCP + CLI both need structured errors. |
| LLM caching | Not specified | Not specified | Cache module | **Cache module.** Atomic writes, crash-safe, toggleable. |
| `ConfigExtractor` | Not present | Not present | Present | **Include.** In spec §6.2 table but missing from §13 tree. |
| `AsyncApiParser` | Not present | Not present | Present | **Include.** §2 use cases cite AsyncAPI but only OpenAPI parser listed. |
| `targets` CLI command | Not present | Not present | Present | **Include.** `anchor_targets` in §10 MCP tools but no CLI command. |
| Windsurf template | Not present | Not present | Present | **Include.** §8.5 cites Windsurf but template missing from §13. |
| ADRs | Not present | Not present | Present | **Include.** Critical for recording architectural decisions in OSS. |
| Fixture approach | Shared `fixtures/` dir | In `tests/fixtures/` | Seeder script + `tests/` | **Both.** Seeder script builds repos; fixtures in `tests/fixtures/`. |
| Plugin architecture | Not explicit | `BaseExtractor` only | Full registry | **Full registry.** All extension points as interfaces from day one. |

---

## Verification Checklist

After scaffolding:

- [ ] `pnpm install` resolves without errors
- [ ] `pnpm run typecheck` passes in both packages
- [ ] `pnpm run build` produces `packages/cli/dist/index.js`
- [ ] `node packages/cli/dist/index.js --help` prints commander usage
- [ ] `anchor doctor` runs and reports environment status
- [ ] `anchor validate` runs against the dogfood `spec/` corpus
- [ ] `pnpm test` runs with 0 tests (vitest config wired correctly)
- [ ] ESLint import cycle rule catches a manually introduced violation
- [ ] `pnpm changeset` produces a changeset file interactively
- [ ] `@anchor_app/core` builds independently with no CLI dependencies in its bundle
- [ ] Path aliases resolve correctly in core's test suite
- [ ] `evals/promptfooconfig.yaml` parses without errors (eval suite wired)

---

## Open Questions Requiring Decisions Before Phase 1

| Question | Options | Recommendation |
|---|---|---|
| **PDF dependency weight** | `pdf-parse` + `canvas`/`puppeteer` (heavy native), lazy `require()`, optional peer dep | Optional peer dep with graceful degradation. Defer to Phase 6. |
| **LLM cache key strategy** | `{model, prompt-hash, content-hash}` vs simpler | Full triple key. Cache hit rate matters for dev experience. |
| **Fixture repo approach** | Git bundles checked in vs. programmatic seeder | Programmatic seeder (`scripts/create-fixture-repos.ts`). More portable, deterministic, and readable. |
| **`sharp` installation** | Required dep, optional peer, or bundled WASM | Optional peer dep. Image pipeline degrades gracefully — skips pHash, sends directly to vision LLM. `anchor doctor` warns about cost impact. |
| **`core` public API surface** | Export everything vs. curated `index.ts` | Curated `index.ts` with explicit exports. Internal modules are implementation details. |
| **Build tool** | `tsc` only vs. `tsup` (esbuild) | `tsup` for both packages. Faster builds, tree-shaking, simpler config. Add `tsc` for declaration files. |
| **Prompt eval golden dataset curation** | Start small and grow vs. comprehensive from day one | Start small: 10-15 high-quality classification fixtures, 5 instruction-quality fixtures. Grow as real-world edge cases surface. Stale fixtures provide false security. |
| **Cache I/O optimization** | Pure atomic file writes vs. in-memory buffer + periodic flush | Atomic file writes as default. Monitor performance. Add buffer only if thousands of small writes become measurable bottleneck. |
