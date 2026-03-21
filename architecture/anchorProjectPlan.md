# Anchor — Project Structure Plan

## Context

Anchor is a TypeScript MCP-compatible CLI tool (`@anchor-ai/anchor`) that semantically diffs spec/requirements documents and bootstraps spec corpora from existing codebases. The repo currently has only `docs/anchor-spec.md`. This plan establishes the full project structure before any implementation begins.

The structure must be easy to contribute to and able to grow as subsystems mature — potentially into separate packages — without requiring a large refactor when that time comes.

---

## Recommendation: Single Package with Internal Module Boundaries

**Do not use a monorepo yet.** There is one publishable artifact, one binary, and no external consumers of individual subsystems. A monorepo at this stage would add workspace setup complexity, cross-package build ordering, and contributor friction with zero user-facing benefit.

**Future extraction path is built in** via TypeScript path aliases (`@anchor/llm`, `@anchor/diff`, etc.) that read like package imports today and become real package promotions later with no code changes.

---

## Directory Structure

```
anchor/
├── package.json                    # "name": "@anchor-ai/anchor", single package
├── tsconfig.json                   # base config with path aliases
├── tsconfig.build.json             # extends base, excludes tests
├── vitest.config.ts
├── .eslintrc.json                  # includes import cycle / boundary rules
├── .prettierrc
├── .anchor.yaml                    # anchor dogfoods itself
├── CLAUDE.md                       # Claude Code integration for contributors
│
├── src/
│   ├── models/                     # Pure TypeScript interfaces — no runtime deps
│   │   └── index.ts                # AnchorResult, FileDelta, SectionDelta, ImageDelta, etc.
│   │
│   ├── config/                     # Config interfaces + loader
│   │   ├── AnchorConfig.ts
│   │   └── ConfigLoader.ts         # js-yaml, resolves .anchor.yaml
│   │
│   ├── git/                        # Git layer
│   │   ├── GitExtractor.ts         # simple-git: blob extraction, history
│   │   ├── GitTreeDiffer.ts        # file-level add/remove/rename detection
│   │   └── index.ts
│   │
│   ├── llm/                        # LLM abstraction (likely first package extraction)
│   │   ├── LlmClient.ts            # interface — the stable boundary
│   │   ├── AnthropicClient.ts      # @anthropic-ai/sdk with prompt caching
│   │   ├── OpenAiClient.ts
│   │   ├── SectionClassifier.ts    # batched text severity classification
│   │   ├── ImageDiffDescriber.ts   # role-aware vision prompts
│   │   ├── InstructionGenerator.ts
│   │   └── index.ts
│   │
│   ├── diff/                       # Diff engine
│   │   ├── CorpusTreeDiffer.ts
│   │   ├── CrossAssetCorrelator.ts
│   │   ├── text/
│   │   │   ├── DocumentParser.ts   # pluggable strategy interface
│   │   │   ├── MarkdownParser.ts
│   │   │   ├── OpenApiParser.ts
│   │   │   ├── PlainTextParser.ts
│   │   │   └── SectionDiffer.ts    # fuzzy heading match (Levenshtein)
│   │   ├── images/
│   │   │   ├── PerceptualHasher.ts # pHash via sharp
│   │   │   ├── ImageRoleClassifier.ts
│   │   │   └── ImageChangeDetector.ts
│   │   └── index.ts
│   │
│   ├── routing/
│   │   ├── TargetRouter.ts
│   │   ├── GlobMatcher.ts          # minimatch
│   │   └── index.ts
│   │
│   ├── baseline/                   # Baseline engine
│   │   ├── extractors/
│   │   │   ├── BaseExtractor.ts    # interface — plugin contract for multi-language
│   │   │   ├── RouteExtractor.ts
│   │   │   ├── SchemaExtractor.ts
│   │   │   ├── ScreenExtractor.ts  # @ts-morph/common for React/RN component trees
│   │   │   ├── OpenApiExtractor.ts
│   │   │   ├── AssetExtractor.ts
│   │   │   └── PackageExtractor.ts
│   │   ├── SectionGenerator.ts     # Haiku: code → spec prose, batched
│   │   ├── CorpusWriter.ts
│   │   ├── TargetDetector.ts
│   │   └── index.ts
│   │
│   ├── mcp/
│   │   ├── McpServer.ts            # @modelcontextprotocol/sdk, stdio + SSE
│   │   └── tools/
│   │       ├── CompareCorpusTool.ts
│   │       ├── CompareFileTool.ts
│   │       ├── ManifestTool.ts
│   │       ├── HistoryTool.ts
│   │       ├── TargetsTool.ts
│   │       └── BaselineStatusTool.ts
│   │
│   └── cli/                        # Entry point — imports all subsystems
│       ├── index.ts                # Commander.js root, #!/usr/bin/env node
│       ├── commands/
│       │   ├── baseline.ts
│       │   ├── compare.ts
│       │   ├── watch.ts            # chokidar
│       │   ├── init.ts             # anchor init --host [claude|copilot|cursor|openclaw]
│       │   └── mcp.ts              # starts MCP server
│       └── output/
│           ├── json.ts
│           ├── markdown.ts
│           └── instructions.ts     # writes .anchor/instructions/{target}.md
│
├── templates/
│   ├── claude/
│   │   ├── CLAUDE.md.template
│   │   └── anchor-check.md.template
│   ├── copilot/
│   │   ├── copilot-instructions.md.template
│   │   └── anchor-skill.md.template
│   ├── cursor/
│   │   └── anchor.mdc.template
│   ├── openclaw/
│   │   └── openclaw-workflow.yaml.template
│   └── github-actions/
│       └── anchor.yml.template
│
├── tests/
│   ├── unit/
│   │   ├── diff/
│   │   ├── baseline/
│   │   ├── routing/
│   │   └── config/
│   ├── integration/
│   │   ├── compare-single-file.test.ts
│   │   ├── compare-corpus.test.ts
│   │   └── baseline-engine.test.ts
│   └── fixtures/
│       ├── repos/                  # programmatically constructed bare git repos
│       │   ├── simple-spec/
│       │   └── vibe-app/
│       └── specs/
│
├── architecture/
│   └── anchorProjectPlan.md        # this file
│
└── docs/
    └── anchor-spec.md              # source of truth
```

---

## Dependency Direction (enforced via ESLint)

```
models     ← no outbound imports
config     ← models
git        ← models, config
llm        ← models, config
diff       ← models, config, git, llm
routing    ← models, config
baseline   ← models, config, git, llm
mcp        ← models, config, diff, routing, baseline
cli        ← everything (only allowed god layer)
```

`diff` must not import `baseline`. `llm` must not import `diff`. Enforced with `eslint-plugin-import` no-cycle rule in CI.

---

## Key Config Files

**`package.json`** — single package, bin entry `dist/cli/index.js`, `files: ["dist", "templates"]`

**`tsconfig.json`** — path aliases that simulate future package names:
```json
"paths": {
  "@anchor/models": ["./src/models/index.ts"],
  "@anchor/config": ["./src/config/index.ts"],
  "@anchor/git": ["./src/git/index.ts"],
  "@anchor/llm": ["./src/llm/index.ts"],
  "@anchor/diff": ["./src/diff/index.ts"],
  "@anchor/routing": ["./src/routing/index.ts"],
  "@anchor/baseline": ["./src/baseline/index.ts"],
  "@anchor/mcp": ["./src/mcp/index.ts"]
}
```

When a subsystem is eventually extracted to a real npm package, the path alias is deleted and the package.json dependency is added — the import statements are unchanged.

**Build:** `tsc` to `dist/` (no bundler needed for a CLI tool). `tsx` for local development. Add bundler only if startup time becomes a problem.

---

## Plugin Architecture for Baseline Extractors

`BaseExtractor.ts` defines a contract that all extractors implement. This allows future Python/Go/other language extractors to be added without modifying core logic:

```typescript
export interface BaseExtractor {
  name: string;
  canHandle(projectRoot: string): Promise<boolean>;
  extract(projectRoot: string): Promise<ExtractorResult>;
}
```

All six current extractors implement this interface. `CorpusWriter` receives `BaseExtractor[]` and calls them polymorphically.

---

## Testing Strategy

- **Unit tests** in `tests/unit/` — mocked LLM, mocked git, test one class at a time
- **Integration tests** in `tests/integration/` — real git repos built programmatically in `beforeAll`, mocked LLM, full pipeline
- **No real LLM calls in CI** — separate `test:llm` npm script for manual/secrets-gated runs
- Fixture repos created via `simple-git` init + scripted commits (no `.git` dirs checked in)

---

## First Files to Create (Suggested Implementation Order)

1. `package.json` — all deps from spec Section 13 + `tsx`, `eslint-plugin-import`
2. `tsconfig.json` — with path aliases above
3. `tsconfig.build.json` — extends base, excludes tests
4. `vitest.config.ts`
5. `.eslintrc.json` — import cycle rule
6. `.prettierrc`
7. `src/models/index.ts` — all interfaces from spec Section 11 **(first real code)**
8. `src/baseline/extractors/BaseExtractor.ts` — extractor plugin interface
9. `CLAUDE.md` — contributor context + anchor's own MCP registration
10. `.anchor.yaml` — anchor dogfoods itself on `docs/`

---

## Verification Checklist

After scaffolding:
- [ ] `npm install` resolves without errors
- [ ] `npm run typecheck` passes
- [ ] `npm run build` produces `dist/cli/index.js`
- [ ] `node dist/cli/index.js --help` prints commander usage
- [ ] `npm test` runs with 0 tests (vitest config wired correctly)
- [ ] Import cycle lint rule catches a manually introduced violation

---

## When to Extract Packages

The signal to extract a subsystem to a real npm package:
1. A second project wants to depend on it independently, **and**
2. It needs independent release cadence from the main CLI

Most likely extraction order: `@anchor-ai/llm` first (reusable LLM abstraction), then `@anchor-ai/models` (shared types). The `diff` and `baseline` engines are unlikely to be extracted — they are implementation details of the CLI, not public APIs.
