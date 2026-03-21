# Anchor — Definitive Project Structure

## Design Philosophy

This document resolves three competing structural proposals against the Anchor specification v3.0 and produces a single, authoritative project structure. Every decision is explained.

---

## Structural Decision: Two-Package Workspace

Three approaches were evaluated:

**Full monorepo (8+ packages)** — pnpm workspaces, Turborepo, Changesets across `core`, `git`, `images`, `llm`, `baseline`, `mcp`, `config`, `templates`. Rejected for Phase 1: too many packages for zero users. The coordination cost of cross-package builds, versioning, and contributor onboarding is unjustified when there is one binary and no external consumers of individual subsystems.

**Single package with path aliases** — One `package.json`, internal modules connected via TypeScript path aliases (`@anchor/llm`, `@anchor/diff`). Rejected: while pragmatic, it prevents third parties from consuming the engine programmatically without pulling in CLI dependencies, chokidar, commander, and MCP server code. The core engine has genuine standalone value.

**Two-package workspace (core + cli)** — Selected. This is the right granularity for a project at Anchor's stage. It provides one meaningful architectural boundary — engine vs. application — without the overhead of managing eight package release cycles.

The separation is real, not cosmetic: `@anchor-ai/core` has zero CLI, MCP, or file-watching dependencies. A third party can `npm install @anchor-ai/core` and run diffs programmatically. The CLI package depends on core and adds the binary, MCP server, file watcher, and host integration templates.

**Future extraction is built in.** Within `@anchor-ai/core`, TypeScript path aliases simulate future package names (`@anchor/llm`, `@anchor/diff`, etc.). When a subsystem needs independent release cadence — most likely `@anchor/llm` first — the path alias is deleted, a real `package.json` is added, and import statements require zero changes.

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
│   │   └── anchor-self-check.yml   # Dogfood: Anchor checks its own spec corpus
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
│
├── packages/
│   │
│   ├── core/                       # @anchor-ai/core — pure engine, no CLI/MCP deps
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
│   │   │   │   └── FileCache.ts           # File-system implementation
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
│   │   │   │   │   ├── PerceptualHasher.ts    # pHash via sharp
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
│   │   │   └── severity/
│   │   │       └── SeverityClassifier.ts  # Rules-based pre-filter before LLM
│   │   │
│   │   └── tests/
│   │       └── unit/
│   │           ├── diff/
│   │           ├── baseline/
│   │           ├── routing/
│   │           ├── config/
│   │           ├── llm/
│   │           └── git/
│   │
│   └── cli/                               # @anchor-ai/anchor — the binary + MCP server
│       ├── package.json                   # bin: { "anchor": "./dist/index.js" }
│       ├── tsconfig.json
│       ├── README.md
│       │
│       ├── src/
│       │   ├── index.ts                   # Commander.js root, #!/usr/bin/env node
│       │   │
│       │   ├── commands/
│       │   │   ├── baseline.ts            # anchor baseline
│       │   │   ├── compare.ts             # anchor compare
│       │   │   ├── watch.ts               # anchor watch (chokidar daemon)
│       │   │   ├── init.ts                # anchor init --host [claude|copilot|cursor|windsurf|openclaw]
│       │   │   ├── targets.ts             # anchor targets (list configured targets)
│       │   │   └── mcp.ts                 # anchor mcp (starts MCP server, stdio or SSE)
│       │   │
│       │   ├── output/
│       │   │   ├── FormatterRegistry.ts   # Pluggable output formatters (IOutputFormatter)
│       │   │   ├── json.ts
│       │   │   ├── markdown.ts
│       │   │   └── instructions.ts        # .anchor/instructions/{target}.md writer
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
│   │   │   └── baseline-engine.test.ts
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
│       └── 004-llm-cache-strategy.md
│
├── spec/                                  # Anchor's own spec corpus (dogfood)
│   ├── .anchor.yaml
│   ├── architecture/
│   │   └── overview.md
│   └── api/
│       └── mcp-tools.md
│
├── turbo.json                             # Task pipeline: build, test, lint, typecheck
├── pnpm-workspace.yaml                    # packages/*, tests (for fixtures access)
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
@anchor-ai/anchor (packages/cli)
  └── @anchor-ai/core

@anchor-ai/core (packages/core)
  └── (no internal dependencies — pure engine)
```

Within `@anchor-ai/core`, internal module dependency direction is enforced via ESLint:

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
severity   ← models
```

Violations are caught by `eslint-plugin-import` no-cycle rules in CI. `diff` must not import `baseline`. `llm` must not import `diff`. The CLI is the only layer allowed to import everything.

---

## Key Design Decisions

### Plugin interfaces from day one

All extension points — document parsers, baseline extractors, LLM providers, output formatters — are defined as interfaces in `core/src/plugins/types.ts`. Built-in implementations are first-class plugins registered through `PluginRegistry`. This means:

- Tests can swap LLM providers with mocks trivially
- Community contributors can add a new extractor by implementing `IExtractor` without understanding the diff engine
- Future third-party plugins don't require forking

The plugin API is internal during Phase 1 but the contracts are stable from day one.

### Prompts as versioned `.md` files

LLM prompts live in `core/src/prompts/` as markdown files, not inline template strings. This has three benefits: prompt changes are reviewable in PRs as first-class diffs, prompts can be regression-tested against known inputs, and contributors can improve prompts without touching TypeScript.

### Typed error hierarchy

MCP tools need structured error codes. CLI needs human-friendly messages. A single `AnchorError` base class with typed subclasses (`GitError`, `LlmApiError`, `ConfigError`, `ParseError`) serves both consumers. Each error carries a machine-readable code and a user-facing message.

### LLM response cache

The `cache/` module prevents re-spending tokens on identical sections during development iterations. Keyed on `{model, prompt-hash, content-hash}`. Toggleable via `.anchor.yaml` (`cache: enabled | disabled`). Stored at `.anchor/cache/` on disk. This is a developer productivity feature, not a production optimization.

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
      "@anchor/cache": ["./src/cache/index.ts"]
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
    "prettier": "^3.0.0"
  }
}
```

---

## npm Dependency Map

| Package | Location | Purpose |
|---|---|---|
| `@anthropic-ai/sdk` | core | Anthropic API + vision + prompt caching |
| `openai` | core | OpenAI / Azure provider swap |
| `simple-git` | core | Git blob extraction and history |
| `sharp` | core (peer) | Image processing + pHash computation |
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

`sharp` is a peer dependency of `@anchor-ai/core` (optional). Image pipeline features degrade gracefully when sharp is not installed — pHash gating is skipped, and images go directly to vision LLM.

---

## What Gets Published

| Package | npm Name | Published | Reason |
|---|---|---|---|
| `packages/core` | `@anchor-ai/core` | Yes | Embeddable engine for third-party tools |
| `packages/cli` | `@anchor-ai/anchor` | Yes | The `anchor` binary users install |

The docs site and playground (if added later) are deployed, not published.

---

## Testing Strategy

**Unit tests** live co-located in each package (`packages/core/tests/unit/`, `packages/cli/tests/unit/`). Mocked LLM, mocked git, test one class at a time.

**Integration tests** live in `tests/integration/`. They use real git repos built programmatically by `scripts/create-fixture-repos.ts` in `beforeAll`. LLM calls are mocked. Full pipeline from CLI invocation to output file.

**No real LLM calls in CI.** A separate `test:llm` script exists for manual or secrets-gated runs that hit real APIs. This keeps CI fast and free of API key management.

**Fixture repos** are created via `simple-git` init + scripted commits. No `.git` directories are checked into the repository. The seeder script is deterministic — same output every run. This approach is more portable than git bundle files and more maintainable than checked-in repos.

---

## CI Pipeline

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

      # Changeset check — PRs that change published packages must include a changeset
      - name: Check changeset
        run: npx changeset status --since=origin/main
```

The `--filter=...[HEAD^1]` flag limits task execution to packages affected by the PR. A change to `packages/core` runs core tests; a change to docs runs nothing.

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

Anchor dogfoods itself. Every push to `main` that touches the spec corpus runs Anchor on its own spec. This validates correctness and produces instruction files that maintainers review.

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

No API key. No native dependencies (sharp is optional). `@anchor-ai/core` unit tests run entirely in-process with zero external service calls.

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
pnpm changeset      # minor bump on @anchor-ai/core
```

The `IExtractor` interface is the contribution surface. All extractors implement the same contract. The contributor never needs to understand the diff engine, MCP layer, or LLM clients.

### For a contributor adding a host template

```bash
# Add: templates/windsurf/anchor.windsurfrules.template
# Update: packages/cli/src/commands/init.ts (add --host windsurf)
pnpm test
pnpm changeset      # patch on @anchor-ai/anchor
```

### CODEOWNERS

```
# Core engine — high review bar
/packages/core/                     @anchor-ai/core-team

# LLM prompts — cost implications, requires benchmark regression
/packages/core/src/prompts/         @anchor-ai/core-team

# Plugin interfaces — API contract, high review bar
/packages/core/src/plugins/         @anchor-ai/core-team

# CLI and MCP layer
/packages/cli/                      @anchor-ai/maintainers

# Templates — community-friendly, lighter review
/templates/                         @anchor-ai/contributors

# Docs
/docs/                              @anchor-ai/docs-team
```

### CONTRIBUTING.md structure

1. **Where to start** — points to `packages/core` as the simplest entry point, lists "good first issue" label
2. **Package map** — one-paragraph description of each package and what it does
3. **Local development** — `pnpm install`, how to run tests, how to test CLI locally with `pnpm link`
4. **Adding an extractor** — step-by-step guide (most common contribution type)
5. **Adding a document parser** — step-by-step guide implementing `IDocumentParser`
6. **Adding a host template** — step-by-step guide
7. **LLM prompt changes** — notes that prompt changes need cost regression testing
8. **Changeset requirement** — every PR that changes a published package needs a changeset
9. **Fixtures** — how to add git fixture repos for integration tests
10. **Architecture Decision Records** — how to propose structural changes via ADRs

---

## Internal Module Dependency Enforcement

The ESLint configuration enforces the dependency direction graph within `@anchor-ai/core`. This prevents architectural erosion as the codebase grows:

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
      ]
    }]
  }
};
```

---

## Phase-by-Phase Activation

Not all modules need implementation on day one. The structure supports incremental activation:

| Phase | What gets built | Key deliverables |
|---|---|---|
| **Phase 1** — Core Diff (MVP) | `models`, `config`, `git`, `llm` (Anthropic only), `diff/text` (Markdown only), `severity`, `errors`, `logger` | `anchor compare` (single file), `anchor mcp`, MCP tools: `compare`, `history` |
| **Phase 2** — Corpus + Targets | `diff/CorpusTreeDiffer`, `routing`, CLI `init`/`targets` commands, output formatters | `anchor compare --corpus`, `anchor init --host`, `--write-instructions`, `.anchor.yaml` loading |
| **Phase 3** — Image Pipeline | `diff/images`, `prompts/describe-image-diff.md` | Image pHash gating, vision LLM diff, image role classification |
| **Phase 4** — Correlation + Agentic | `CrossAssetCorrelator`, `cache`, CLI `watch` command | Correlated deltas, `anchor watch`, GitHub Actions template |
| **Phase 5** — Baseline Engine | `baseline/*` extractors, `SectionGenerator`, `TargetDetector` | `anchor baseline`, `anchor baseline --update`, `baseline_status` MCP tool |
| **Phase 6** — Parser Coverage + Hardening | `OpenApiParser`, `AsyncApiParser`, `PlainTextParser`, `PdfParser`, `OpenAiClient` | Multi-format support, provider swap, parallel LLM, result caching |

In Phase 1, the CLI directly imports core modules. The two-package boundary exists from the start but both packages are published together. Independent release cadence comes when external consumers appear.

---

## When to Extract Sub-Packages

The signal to extract a core subsystem to a standalone npm package:

1. A second project wants to depend on it independently, **and**
2. It needs an independent release cadence from the main CLI

Most likely extraction order: `@anchor-ai/llm` first (reusable LLM abstraction with rate limiting, caching, multi-provider support), then `@anchor-ai/models` (shared TypeScript interfaces). The diff and baseline engines are implementation details — unlikely to be extracted.

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
| Prompt storage | Inline strings | Inline strings | `.md` files | **`.md` files.** Reviewable, testable, versionable. |
| Error handling | Not specified | Not specified | Typed hierarchy | **Typed hierarchy.** MCP + CLI both need structured errors. |
| LLM caching | Not specified | Not specified | Cache module | **Cache module.** Dev productivity, toggleable. |
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
- [ ] `pnpm test` runs with 0 tests (vitest config wired correctly)
- [ ] ESLint import cycle rule catches a manually introduced violation
- [ ] `pnpm changeset` produces a changeset file interactively
- [ ] `@anchor-ai/core` builds independently with no CLI dependencies in its bundle
- [ ] Path aliases resolve correctly in core's test suite

---

## Open Questions Requiring Decisions Before Phase 1

| Question | Options | Recommendation |
|---|---|---|
| **PDF dependency weight** | `pdf-parse` + `canvas`/`puppeteer` (heavy native), lazy `require()`, optional peer dep | Optional peer dep with graceful degradation. Defer to Phase 6. |
| **LLM cache key strategy** | `{model, prompt-hash, content-hash}` vs simpler | Full triple key. Cache hit rate matters for dev experience. |
| **Fixture repo approach** | Git bundles checked in vs. programmatic seeder | Programmatic seeder (`scripts/create-fixture-repos.ts`). More portable, deterministic, and readable. |
| **`sharp` installation** | Required dep, optional peer, or bundled WASM | Optional peer dep. Image pipeline degrades gracefully — skips pHash, sends directly to vision LLM. |
| **`core` public API surface** | Export everything vs. curated `index.ts` | Curated `index.ts` with explicit exports. Internal modules are implementation details. |
| **Build tool** | `tsc` only vs. `tsup` (esbuild) | `tsup` for both packages. Faster builds, tree-shaking, simpler config. Add `tsc` for declaration files. |
