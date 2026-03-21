# Anchor — Monorepo Project Structure

## Guiding Principles

Before the directory tree, the decisions that shaped it:

**pnpm workspaces over npm workspaces or Yarn.** pnpm's strict hoisting prevents phantom dependency bugs, its workspace protocol (`workspace:*`) makes internal linking explicit, and its performance on CI is meaningfully better than npm. Most serious TypeScript monorepos in the npm ecosystem (Vercel, Astro, etc.) have converged on pnpm.

**Packages are the unit of contribution.** Each `packages/*` directory is a publishable npm package with its own `package.json`, `README.md`, and test suite. Contributors can work on `@anchor-ai/core` without understanding the MCP layer. This is the single most important structural decision for open source health.

**Apps are not packages.** The `apps/*` directory contains things that are deployed or run, not published. The CLI binary, docs site, and playground live here. They consume packages but are never consumed as packages.

**Changesets for release management.** Changesets (`.changeset/`) handles versioning, changelogs, and coordinated releases across packages. Each PR that changes a package includes a changeset file. This makes the release process self-documenting and contributor-friendly.

**Turborepo for task orchestration.** `turbo.json` defines the task graph (build → test → lint, with caching). A contributor running `pnpm run test` in the root runs only the tests affected by their changes. CI runs the same graph.

---

## Directory Tree

```
anchor/
│
├── .changeset/                     # changeset config + pending release notes
│   └── config.json
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # lint, test, build on every PR
│   │   ├── release.yml             # publish packages on merge to main
│   │   └── anchor-self-check.yml   # dogfood: Anchor checks its own spec corpus
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS                  # package-level ownership
│
├── apps/
│   ├── cli/                        # the `anchor` binary — npm published as @anchor-ai/cli
│   │   ├── src/
│   │   │   ├── index.ts            # commander.js root, wires commands to core packages
│   │   │   └── commands/
│   │   │       ├── baseline.ts
│   │   │       ├── compare.ts
│   │   │       ├── watch.ts
│   │   │       ├── init.ts
│   │   │       └── mcp.ts          # starts MCP server process
│   │   ├── package.json            # bin: { "anchor": "./dist/index.js" }
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   ├── docs/                       # documentation site (Astro or Starlight)
│   │   ├── src/
│   │   │   ├── content/            # .mdx files — guides, API reference, examples
│   │   │   └── components/
│   │   ├── package.json
│   │   └── astro.config.mjs
│   │
│   └── playground/                 # interactive web UI for trying Anchor without install
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   │
│   ├── core/                       # @anchor-ai/core — pure domain logic, no I/O
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── models/             # TypeScript interfaces and types
│   │   │   │   └── index.ts
│   │   │   ├── diff/
│   │   │   │   ├── CorpusTreeDiffer.ts
│   │   │   │   ├── SectionDiffer.ts
│   │   │   │   ├── FuzzyMatcher.ts
│   │   │   │   └── CrossAssetCorrelator.ts
│   │   │   ├── parsing/
│   │   │   │   ├── IDocumentParser.ts
│   │   │   │   ├── MarkdownParser.ts
│   │   │   │   ├── OpenApiParser.ts
│   │   │   │   ├── PlainTextParser.ts
│   │   │   │   └── ParserFactory.ts
│   │   │   ├── routing/
│   │   │   │   ├── TargetRouter.ts
│   │   │   │   └── GlobMatcher.ts
│   │   │   └── severity/
│   │   │       └── SeverityClassifier.ts  # rules-based pre-filter before LLM
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   ├── git/                        # @anchor-ai/git — git operations
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── GitExtractor.ts     # simple-git wrapper, blob extraction
│   │   │   └── GitTreeDiffer.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── images/                     # @anchor-ai/images — image analysis pipeline
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── PerceptualHasher.ts  # pHash via sharp
│   │   │   ├── ImageRoleClassifier.ts
│   │   │   └── ImageChangeDetector.ts
│   │   ├── tests/
│   │   ├── package.json            # peerDependency: sharp (native, optional)
│   │   └── README.md
│   │
│   ├── llm/                        # @anchor-ai/llm — LLM integration, provider-agnostic
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── ILlmClient.ts       # interface all providers implement
│   │   │   ├── providers/
│   │   │   │   ├── AnthropicClient.ts   # @anthropic-ai/sdk, prompt caching
│   │   │   │   └── OpenAiClient.ts
│   │   │   ├── prompts/
│   │   │   │   ├── ClassificationPrompt.ts
│   │   │   │   ├── ImageDiffPrompt.ts
│   │   │   │   └── InstructionGenPrompt.ts
│   │   │   └── SectionClassificationBatcher.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── baseline/                   # @anchor-ai/baseline — brownfield bootstrapper
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── extractors/
│   │   │   │   ├── IExtractor.ts
│   │   │   │   ├── RouteExtractor.ts
│   │   │   │   ├── SchemaExtractor.ts
│   │   │   │   ├── ScreenExtractor.ts
│   │   │   │   ├── OpenApiExtractor.ts
│   │   │   │   ├── AssetExtractor.ts
│   │   │   │   └── PackageExtractor.ts
│   │   │   ├── SectionGenerator.ts  # Haiku pass: code → spec prose
│   │   │   ├── CorpusWriter.ts
│   │   │   └── TargetDetector.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── mcp/                        # @anchor-ai/mcp — MCP server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── McpServer.ts        # @modelcontextprotocol/sdk
│   │   │   └── tools/
│   │   │       ├── CompareCorpusTool.ts
│   │   │       ├── CompareFileTool.ts
│   │   │       ├── ManifestTool.ts
│   │   │       ├── HistoryTool.ts
│   │   │       ├── TargetsTool.ts
│   │   │       └── BaselineStatusTool.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── config/                     # @anchor-ai/config — .anchor.yaml loading + validation
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── AnchorConfig.ts     # zod schema for config
│   │   │   └── ConfigLoader.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── templates/                  # @anchor-ai/templates — host integration templates
│       ├── src/
│       │   ├── index.ts
│       │   └── hosts/
│       │       ├── claude.ts        # CLAUDE.md + slash command templates
│       │       ├── copilot.ts       # copilot-instructions.md + skill templates
│       │       ├── cursor.ts        # .cursor/rules/ template
│       │       ├── openclaw.ts      # openclaw-workflow.yaml template
│       │       └── github-actions.ts
│       ├── templates/               # raw .md / .yaml template files
│       │   ├── claude/
│       │   ├── copilot/
│       │   ├── cursor/
│       │   └── openclaw/
│       ├── package.json
│       └── README.md
│
├── integrations/                   # third-party integration packages (community-contributed)
│   ├── notion/                     # @anchor-ai/integration-notion
│   │   ├── src/
│   │   │   └── NotionSpecExporter.ts  # export Notion pages to corpus format
│   │   ├── package.json
│   │   └── README.md
│   ├── confluence/                 # @anchor-ai/integration-confluence
│   └── figma/                      # @anchor-ai/integration-figma (wireframes from Figma)
│
├── spec/                           # Anchor's own spec corpus (dogfood)
│   ├── .anchor.yaml
│   ├── architecture/
│   │   └── overview.md
│   ├── packages/
│   │   ├── core.md
│   │   ├── baseline.md
│   │   └── mcp.md
│   └── api/
│       └── mcp-tools.md
│
├── docs-content/                   # source docs (consumed by apps/docs)
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── brownfield-onboarding.md
│   │   ├── agentic-handoff.md
│   │   └── host-integrations.md
│   ├── reference/
│   │   ├── config.md
│   │   ├── mcp-tools.md
│   │   └── cli.md
│   └── examples/
│       ├── mobile-app/
│       ├── api-contract/
│       └── vibe-app-rescue/
│
├── fixtures/                       # shared test fixtures across all packages
│   ├── spec-corpus/                # sample spec corpus with multiple commits
│   ├── vibe-app/                   # minimal Express+React app for baseline tests
│   └── git-repos/                  # bare git repos with scripted commit history
│
├── turbo.json                      # task pipeline: build, test, lint, typecheck
├── pnpm-workspace.yaml             # workspace: packages/*, apps/*, integrations/*
├── package.json                    # root: scripts, devDependencies (shared tooling)
├── tsconfig.base.json              # base TS config extended by all packages
├── .eslintrc.js                    # shared ESLint config
├── vitest.workspace.ts             # vitest project references for all packages
├── .anchor.yaml                    # Anchor tracks its own spec changes (dogfood)
│
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE                         # MIT
```

---

## Package Dependency Graph

```
apps/cli
  └── @anchor-ai/core
  └── @anchor-ai/git
  └── @anchor-ai/images
  └── @anchor-ai/llm
  └── @anchor-ai/baseline
  └── @anchor-ai/mcp
  └── @anchor-ai/config
  └── @anchor-ai/templates

@anchor-ai/mcp
  └── @anchor-ai/core
  └── @anchor-ai/git
  └── @anchor-ai/images
  └── @anchor-ai/llm
  └── @anchor-ai/config

@anchor-ai/baseline
  └── @anchor-ai/core
  └── @anchor-ai/llm
  └── @anchor-ai/config

@anchor-ai/llm
  └── @anchor-ai/core      (models only)

@anchor-ai/images
  └── @anchor-ai/core      (models only)

@anchor-ai/git
  └── @anchor-ai/core      (models only)

@anchor-ai/core            (no internal deps — pure domain logic)
@anchor-ai/config          (no internal deps — only zod + js-yaml)
@anchor-ai/templates       (no internal deps — string templates)
```

`@anchor-ai/core` has zero internal dependencies. It is the stable foundation everything else builds on. Contributors can run its tests with no API key, no git, no native dependencies.

---

## Key Files

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'integrations/*'
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
    "rootDir": "src"
  }
}
```

Each package extends this: `{ "extends": "../../tsconfig.base.json" }`

### Root `package.json`
```json
{
  "scripts": {
    "build":     "turbo run build",
    "test":      "turbo run test",
    "lint":      "turbo run lint",
    "typecheck": "turbo run typecheck",
    "changeset": "changeset",
    "version":   "changeset version",
    "release":   "turbo run build --filter=...[origin/main] && changeset publish"
  },
  "devDependencies": {
    "turbo": "latest",
    "@changesets/cli": "latest",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "latest",
    "tsup": "latest"
  }
}
```

---

## What Gets Published vs What Stays Private

| Package | Published to npm | Reason |
|---|---|---|
| `@anchor-ai/core` | Yes | Embeddable in other tools |
| `@anchor-ai/git` | Yes | Useful standalone |
| `@anchor-ai/images` | Yes | Useful standalone |
| `@anchor-ai/llm` | Yes | Useful standalone |
| `@anchor-ai/baseline` | Yes | Primary adoption driver |
| `@anchor-ai/mcp` | Yes | Embeddable MCP server |
| `@anchor-ai/config` | Yes | Config schema reuse |
| `@anchor-ai/templates` | Yes | Needed by `anchor init` |
| `@anchor-ai/cli` (apps/cli) | Yes | The `anchor` binary |
| `@anchor-ai/integration-*` | Yes | Community packages |
| `apps/docs` | Deployed (not published) | Vercel/Cloudflare Pages |
| `apps/playground` | Deployed (not published) | Web demo |

---

## Open Source Contribution Experience

### For a first-time contributor fixing a bug in the markdown parser

```bash
git clone https://github.com/anchor-ai/anchor
cd anchor
pnpm install                        # installs all workspaces

cd packages/core
pnpm test                           # runs only core tests — fast, no API key needed

# Make fix in packages/core/src/parsing/MarkdownParser.ts
# Add test in packages/core/tests/parsing/MarkdownParser.test.ts
pnpm test                           # confirm fix
pnpm run typecheck                  # catch type errors

cd ../..
pnpm changeset                      # guided prompt: which package changed? patch/minor/major?
git commit -m "fix(core): handle nested heading sections in MarkdownParser"
```

No API key. No special setup. The `@anchor-ai/core` package has zero external service dependencies — it is pure TypeScript logic that can be tested entirely in process.

### For a contributor adding a new baseline extractor

```bash
cd packages/baseline
# Add packages/baseline/src/extractors/DrizzleExtractor.ts
# Add packages/baseline/tests/extractors/DrizzleExtractor.test.ts
# Update packages/baseline/src/extractors/index.ts
pnpm test
pnpm changeset  # minor bump on @anchor-ai/baseline
```

The extractor interface (`IExtractor`) is the contribution surface. All extractors implement the same interface. The contributor never needs to understand the diff engine, MCP layer, or LLM clients.

### For a contributor adding a new host integration template

```bash
cd packages/templates
# Add packages/templates/src/hosts/windsurf.ts
# Add packages/templates/templates/windsurf/anchor.md.template
# Register in packages/templates/src/index.ts
# Update apps/cli/src/commands/init.ts to add --host windsurf option
pnpm test
pnpm changeset  # patch on @anchor-ai/templates
```

### CONTRIBUTING.md structure

The `CONTRIBUTING.md` at root covers:

1. **Where to start** — points to `packages/core` as the simplest entry point
2. **Package map** — one-paragraph description of each package and what it does
3. **Local development** — `pnpm install`, how to run tests, how to test CLI locally with `pnpm link`
4. **Adding an extractor** — step-by-step (most common contribution type)
5. **Adding a host template** — step-by-step
6. **LLM prompt changes** — notes that prompt changes need cost regression testing
7. **Changeset requirement** — every PR that changes a published package needs a changeset
8. **Fixtures** — how to add git fixture repos for integration tests

### CODEOWNERS

```
# Core domain logic — high review bar
/packages/core/                 @anchor-ai/core-team

# LLM prompts — cost implications, requires benchmark run
/packages/llm/src/prompts/      @anchor-ai/core-team

# Community integration packages — lighter review
/integrations/                  @anchor-ai/contributors

# Templates — anyone can contribute
/packages/templates/            @anchor-ai/contributors

# Docs
/docs-content/                  @anchor-ai/docs-team
```

---

## CI Pipeline (`.github/workflows/ci.yml`)

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

      # Integration tests (needs git fixture repos, no API key)
      - run: pnpm turbo run test:integration --filter=...[HEAD^1]
```

The `--filter=...[HEAD^1]` flag tells Turborepo to only run tasks in packages whose files changed relative to the previous commit. A PR that only touches `packages/core` does not run tests for `packages/baseline`. This keeps CI fast as the repo grows.

---

## Dogfooding: Anchor Tracks Its Own Spec

The `spec/` directory at repo root is Anchor's own spec corpus. The `.anchor.yaml` at root configures Anchor to watch it. The `anchor-self-check.yml` GitHub Actions workflow runs on every push to `main` that touches `spec/`:

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
      - run: npm install -g @anchor-ai/cli
      - run: anchor compare --corpus spec/ --from HEAD~1 --to HEAD
               --write-instructions .anchor/instructions/
               --format json
      - uses: actions/upload-artifact@v4
        with:
          name: anchor-instructions
          path: .anchor/instructions/
```

This serves two purposes: it validates that Anchor works correctly on real commits, and it produces instruction files that maintainers can review when architectural changes are made to the spec.

---

## Phase-by-Phase Activation

Not all packages need to exist on day one. The monorepo structure supports incremental activation:

| Phase | What gets created | What gets published |
|---|---|---|
| Phase 1 | `packages/core`, `packages/git`, `packages/llm`, `packages/config`, `apps/cli` | `@anchor-ai/cli` (includes core, git, llm, config inline) |
| Phase 2 | Extract `@anchor-ai/core` as standalone | `@anchor-ai/core` |
| Phase 3 | `packages/images` | `@anchor-ai/images` |
| Phase 4 | `packages/mcp` | `@anchor-ai/mcp` |
| Phase 5 | `packages/baseline` | `@anchor-ai/baseline` |
| Phase 6 | `packages/templates`, `apps/docs`, `integrations/*` | All remaining packages |

In Phase 1 the monorepo structure exists but `apps/cli` vendors its dependencies directly rather than consuming published packages. This lets you ship fast without coordinating multi-package releases. In Phase 2, you extract the stable packages and begin treating the public API as a contract.
