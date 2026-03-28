# Anchor — Requirements Delta Agent Tool
### Specification & High-Level Architecture v3.0

---

## 1. Problem Statement

When a requirements document or API spec changes, downstream implementors (coding agents, engineers, mobile teams) need to know *exactly* what changed and *what action to take*. Naive diffing produces noisy line-level output that doesn't communicate semantic intent. Running a full document through a top-tier LLM is expensive, slow, and wasteful when most of the document hasn't changed.

A second, equally important problem: most real-world projects have *no spec at all*. Vibe-coded apps, legacy systems, and fast-moving startups have behavior locked inside code with no human-readable requirements corpus to diff against. Before Anchor can track change, it needs a baseline to anchor to.

**Anchor** is a TypeScript MCP-compatible CLI tool that:

- **Bootstraps** a structured spec corpus from an existing codebase (`anchor baseline`)
- Inspects the git history of one or more spec/requirements files **or an entire folder tree**
- Detects added, removed, modified, and renamed documents across a spec folder
- Analyzes changed **images** (screenshots, wireframes, diagrams) using vision models
- Correlates text and image changes from the same commit into **coherent cross-asset deltas**
- Generates focused, actionable instructions per target audience (iOS, Android, backend, QA)
- Supports **fully agentic product→dev handoff** workflows with no human in the loop
- Works with Claude Code, GitHub Copilot, OpenClaw, and any MCP-compatible agent host
- Minimizes LLM token spend by sending only changed regions and changed images

---

## 2. Use Cases

| Scenario | Trigger | Consumers |
|---|---|---|
| Brownfield onboarding | Existing project, no specs | `anchor baseline` → initial corpus |
| Vibe app rescue | Spaghetti codebase needs control | `anchor baseline` → diffable foundation |
| API contract change | OpenAPI/AsyncAPI spec updated | Frontend agents, SDK generators |
| Product spec update | PRD or feature doc revised | iOS agent, Android agent, QA agent |
| Wireframe revision | Screen mockup PNG replaced or added | iOS agent, Android agent, QA agent |
| Screenshot regression | Reference screenshot changed | QA agent, visual regression tooling |
| Data model change | Schema doc updated | Backend agents, migration scripts |
| Full feature folder update | Multiple files changed in one commit | All targets, cross-correlated output |
| Fully agentic handoff | Product agent commits spec; dev agents auto-respond | All targets, zero human coordination |

---

## 3. Goals & Constraints

### Goals
- **Bootstrap** a spec corpus from code when none exists
- Produce **semantic** deltas, not line diffs
- Handle **entire spec folders** with file-level change detection
- Analyze **image changes** (wireframes, screenshots, diagrams) via vision models
- **Correlate** text and image changes from the same commit into unified delta entries
- Output **structured, machine-readable** change sets (JSON) plus **human-readable** summaries
- Route changes to **specific consumer targets** with focused, agent-ready instructions
- Support **fully agentic handoff** workflows — product agent → Anchor → dev agents — no human required
- Work across **all major agent hosts**: Claude Code, GitHub Copilot, OpenClaw, Cursor, and any MCP client
- Run cheaply via a chunked, section-scoped approach using smaller models (Haiku)
- Ship as a **TypeScript npm package** for maximum ecosystem reach and contributor accessibility

### Non-Goals
- Not a general git diff viewer
- Not a pixel-level image comparison tool (use visual regression tools for that)
- Not a full document summarizer
- Not a change approval or PR workflow tool (though it could feed one)
- Not a spec creation tool for new features (OpenSpec, Spec Kit, Kiro fill that role)

---

## 4. Core Concepts

### 4.1 Spec Corpus

A **Spec Corpus** is the unit of analysis — either a single file or a folder tree that constitutes one product spec domain (e.g., `docs/product/payments/`). When comparing a corpus across two refs, Anchor operates at three levels simultaneously:

1. **Corpus level** — which files were added, removed, renamed
2. **Document level** — which sections within changed text files changed
3. **Asset level** — which images changed and what the visual change means

A corpus is created either by the product team (authoring specs directly) or by `anchor baseline` (reverse-engineered from code). Either way, it is committed to git and becomes the source of truth Anchor diffs against.

### 4.2 Document Sections

Anchor treats text documents as a collection of named sections, not raw text. Section boundaries are detected by:

- Markdown headings (`#`, `##`, `###`)
- OpenAPI top-level keys (`paths`, `components`, `info`)
- Numbered clause structure (e.g., `3.2.1 Authentication`)
- Configurable delimiter patterns per document type

### 4.3 Image Asset Classification

| Image Role | Detection Heuristic | Analysis Strategy |
|---|---|---|
| `wireframe` | Filename contains `wireframe`, `wf`, `mockup`; or low color count | Layout and element comparison |
| `screenshot` | Filename contains `screen`, `capture`, `preview`; high color count | UI state and content comparison |
| `diagram` | Filename contains `diagram`, `flow`, `arch`, `erd`, `uml` | Structure and relationship comparison |
| `icon_or_asset` | Small dimensions, asset folder path | Added/removed detection only |
| `unknown` | None of the above | Generic visual description diff |

Role detection is heuristic and overridable via `.anchor.yaml` per file glob.

### 4.4 Change Classification

**Change Type:** `ADDED` | `REMOVED` | `MODIFIED` | `RENAMED` | `REORDERED`

**Semantic Severity:**
- `BREAKING` — likely to cause incompatibility (removed field, changed endpoint, screen flow restructured)
- `BEHAVIORAL` — changes what the system does (new validation rule, changed default, new UI state)
- `INFORMATIONAL` — clarification, rewording, minor visual adjustment
- `COSMETIC` — formatting, typos, palette-only image tweak (suppressed by default)

### 4.5 Cross-Asset Correlation

When a text document and an image are modified in the same commit *and* share a naming or structural relationship, they are grouped into a **CorrelatedDelta**. Correlation rules in priority order:

1. Image is explicitly referenced in the markdown (`![login](./screens/login-v2.png)`)
2. Image filename shares a stem with the document (`payment-flow.md` ↔ `payment-flow-v3.png`)
3. Image and document are in the same directory, same commit
4. No correlation — remain independent deltas

### 4.6 Consumer Targets

A consumer target is a named stakeholder profile with routing rules. Targets can represent human teams, specific coding agents, or fully automated pipelines. Defined in `.anchor.yaml`.

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLI Entry Points                             │
│  anchor baseline   anchor compare   anchor watch   anchor targets    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
              ┌──────────────┴───────────────┐
              │                              │
   ┌──────────▼──────────┐       ┌───────────▼──────────┐
   │   BASELINE ENGINE   │       │    DIFF ENGINE        │
   │                     │       │                       │
   │ Static Analyzer     │       │ Corpus Manifest       │
   │ (routes, models,    │       │ Git Tree Differ       │
   │  screens, assets)   │       │ File Classifier       │
   │                     │       │                       │
   │ Haiku Section Gen   │       │ TEXT PIPELINE         │
   │ (code → spec prose) │       │ IMAGE PIPELINE        │
   │                     │       │                       │
   │ Corpus Writer       │       │ Cross-Asset           │
   │ (structured .md,    │       │ Correlator            │
   │  .anchor.yaml)      │       │                       │
   │                     │       │ Target Router         │
   │ git commit          │       │ Instruction Gen       │
   └─────────────────────┘       └───────────┬───────────┘
                                             │
                              ┌──────────────▼──────────────┐
                              │       MCP TOOL LAYER        │
                              │  anchor_compare_corpus      │
                              │  anchor_compare             │
                              │  anchor_manifest            │
                              │  anchor_history             │
                              │  anchor_targets             │
                              │  anchor_baseline_status     │
                              └──────────────┬──────────────┘
                                             │
                    ┌────────────────────────┼──────────────────────────┐
                    │                        │                          │
         ┌──────────▼──────┐    ┌────────────▼────────┐    ┌───────────▼──────────┐
         │  Claude Code    │    │  GitHub Copilot     │    │  OpenClaw /          │
         │  (CLAUDE.md +   │    │  (skills/.github/   │    │  Other MCP clients   │
         │   MCP server)   │    │   copilot/*.md)     │    │  (MCP stdio/SSE)     │
         └─────────────────┘    └─────────────────────┘    └──────────────────────┘
```

---

## 6. `anchor baseline` — Brownfield Bootstrapper

### 6.1 Purpose

`anchor baseline` reverse-engineers a structured, diffable spec corpus from an existing codebase. The goal is not perfect documentation — it is a **committed, versioned baseline** that Anchor can diff against from day one. The generated corpus is explicitly marked as auto-generated and should be reviewed before being treated as authoritative.

This is the primary adoption driver for teams with existing projects: vibe-coded apps, legacy systems, or any project that grew faster than its documentation.

### 6.2 Two-Pass Process

**Pass 1 — Static Analysis (zero LLM cost)**

Deterministic extraction requires no API key and runs fast:

| Extractor | What it finds | Output |
|---|---|---|
| `RouteExtractor` | Express routes, Fastify, Hono, Next.js App Router, tRPC, ASP.NET Core endpoint routing (`MapGet`, `MapPost`, etc.), Razor Pages route templates | `api/endpoints.md` |
| `SchemaExtractor` | Prisma, Drizzle, TypeORM, Mongoose, Zod schemas, JSON Schema, EF migration/model snapshot signals, SQL schema migration artifacts, API contract schemas | `data/models.md` |
| `ScreenExtractor` | React component tree, Next.js pages, React Native navigators, Razor Pages (`Pages/**/*.cshtml`), Razor views/components (`Views/**/*.cshtml`, `*.razor`) | `screens/*.md` |
| `OpenApiExtractor` | Existing OpenAPI/Swagger files (passthrough, no rewrite needed) | `api/openapi.yaml` |
| `AssetExtractor` | PNGs, JPGs, SVGs in component dirs, public/, assets/ | `assets/**` (copied) |
| `PackageExtractor` | package.json, dependencies, scripts, framework detection | `architecture.md` (partial) |
| `ConfigExtractor` | Environment variables, feature flags, build config | `architecture.md` (partial) |

### 6.2.1 Extraction Reliability Requirements

Baseline extraction must be resilient across frameworks and language conventions.

- Route extraction MUST treat framework APIs and route declarations as primary evidence (for example endpoint builder calls, route templates, and routing directives), not class-name conventions.
- Schema/model extraction MUST prioritize explicit schema sources (migration artifacts, contract schemas, and declared database mappings) over class-name heuristics.
- Razor Pages route detection MUST support default file-system routing and explicit `@page` templates.
- Multi-project repositories MUST be supported; extractors should preserve project-relative provenance to avoid collisions.
- For very large repos, extraction SHOULD remain deterministic and bounded by documented sampling/reporting limits.
- Language/framework support MUST be strategy-based (pluggable extractors) rather than accumulating all logic in one monolithic class.

**Pass 2 — LLM Section Generation (Haiku, batched)**

For each module/screen/endpoint discovered in Pass 1, sends a focused prompt to Haiku:

```
Given this [route handler / component / schema], write a product requirements section
describing what it does, written for a technical product manager.

Focus on: user-facing behavior, inputs/outputs, validation rules, error states.
Do NOT describe implementation details like variable names or framework internals.
Format as a markdown section with heading "## {module_name}".
```

Batched in groups of 5–10 per Haiku call to minimize overhead. System prompt is cached.

**Pass 3 — Corpus Assembly**

Assembles the generated sections into a structured folder:

```
anchor-specs/
├── .anchor.yaml              # auto-generated config with detected targets
├── README.md                 # explains this is auto-generated, how to use
├── architecture.md           # tech stack, dependencies, deployment summary
├── api/
│   ├── endpoints.md          # all routes with behavior descriptions
│   └── openapi.yaml          # passthrough if found
├── data/
│   └── models.md             # data model descriptions
├── screens/
│   ├── login.md
│   ├── dashboard.md
│   └── ...                   # one file per screen/feature area
└── assets/
    ├── screenshots/          # existing screenshots found in codebase
    └── diagrams/             # existing diagrams found in codebase
```

Makes an initial git commit: `anchor: baseline v0.1 (auto-generated)`

### 6.3 Target Auto-Detection

During static analysis, Anchor detects signals that suggest consumer targets:

| Signal | Detected Target |
|---|---|
| `react-native`, `expo` in dependencies | `ios`, `android` |
| `.swift` files or `ios/` directory | `ios` |
| `.kt` files or `android/` directory | `android` |
| `.sln` or `.csproj` files | `backend` |
| ASP.NET Core endpoint routing usage (`MapGet`, `MapPost`, etc.) | `backend` |
| Razor Pages files (`Pages/**/*.cshtml`) or `@page` directives | `frontend` |
| OpenAPI spec present | `api-consumer` |
| `jest`, `playwright`, `cypress` in devDependencies | `qa` |
| `prisma`, `drizzle`, database config | `backend` |

Detected targets are written into `.anchor.yaml` with sensible defaults. User reviews and refines before first real diff.

### 6.4 Baseline Quality Flags

Each generated section is tagged with a confidence level in frontmatter:

```yaml
---
anchor_generated: true
anchor_confidence: medium   # high | medium | low
anchor_source: RouteExtractor + LLM
anchor_review_needed: false
---
```

Low-confidence sections (e.g., complex business logic inferred from opaque code) are flagged for human review. The `anchor baseline --report` flag emits a summary of what was generated, what was skipped, and what needs review.

### 6.5 CLI Usage

```bash
# Full baseline — analyze everything, generate all sections
anchor baseline

# Dry run — show what would be generated, no files written
anchor baseline --dry-run

# Specific subdirectory
anchor baseline --src src/payments

# Skip LLM pass — static analysis only, stubs for sections
anchor baseline --no-llm

# Review report
anchor baseline --report

# Update baseline after major refactor (preserves manual edits, adds new sections)
anchor baseline --update
```

---

## 7. Diff Engine

### 7.1 Corpus Manifest / Git Tree Differ

Before any content analysis, Anchor compares the full file trees at `from_ref` and `to_ref`. This produces a `CorpusManifest`:

- **New files**: entire content is "added," flagged for full analysis
- **Deleted files**: noted as removed, severity defaults to `BREAKING`
- **Renamed files**: detected via content similarity (Git rename detection, 50% threshold)
- **Modified files**: passed to the appropriate pipeline (text or image)
- **Unchanged files**: excluded — zero token cost

| Extensions | Pipeline |
|---|---|
| `.md`, `.yaml`, `.yml`, `.json`, `.txt`, `.rst` | Text Pipeline |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` | Image Pipeline |
| `.pdf` | Text (extraction) + Image (page render, changed pages) |
| Others | Skipped (logged) |

### 7.2 Text Pipeline

1. Git blob extraction (before/after text at each ref)
2. Document parser / section splitter (Markdown, OpenAPI, plaintext, custom)
3. Structural section diff with fuzzy heading match (Levenshtein, ~80% threshold)
4. Haiku text classification — only changed section text, batched, system prompt cached

### 7.3 Image Pipeline

1. Git blob extraction (binary)
2. SHA-256 gate — byte-identical → skip entirely
3. Perceptual hash (pHash) gate:

| pHash Distance | Interpretation | Action |
|---|---|---|
| 0–3 | Visually identical (metadata, re-save) | Skip — COSMETIC, 0 tokens |
| 4–15 | Minor visual change | Proceed — INFORMATIONAL or BEHAVIORAL |
| 16+ | Significant visual change | Proceed — BEHAVIORAL or BREAKING |

4. Image role classifier (heuristic, no LLM)
5. Vision LLM diff description (Haiku vision, role-aware prompt, before+after in one call)

### 7.4 Cross-Asset Correlator

Groups related text and image deltas into `CorrelatedDelta` entries. Correlation strategies: explicit reference > filename stem match > directory + commit proximity > independent.

Flags **orphaned image changes** — images that changed but are not referenced by any text document.

### 7.5 Target Router / Instruction Generator

For each consumer target, filters `CorrelatedDelta[]` by file glob, section name, keyword presence, image role, and severity threshold. Generates focused instruction blocks via Haiku — when a correlated delta includes both text and image changes, both are passed in a single call.

---

## 8. Agent Host Compatibility

This is a key differentiator. Anchor must work well with every major agent host, each of which has different conventions for how tools are discovered and invoked.

### 8.1 MCP Tool Layer (Universal)

The MCP server is the universal interface. Any MCP-compatible host can use Anchor without host-specific configuration. Anchor publishes a standard MCP server over stdio (for local CLI use) or SSE (for remote/CI use).

```bash
# Install globally
npm install -g @anchor_app/anchor

# Start MCP server (stdio — Claude Code default)
anchor mcp

# Start MCP server (SSE — for remote clients)
anchor mcp --transport sse --port 3456
```

MCP tool descriptions are the first line of defense for agent discoverability. They must be detailed enough that an agent can invoke Anchor correctly *without* any additional skill or instruction file. This means tool descriptions include:

- What the tool does and when to use it
- All parameter descriptions with examples
- Expected output shape summary
- Common usage patterns in the description

**The MCP description should be sufficient for a capable agent (Claude, GPT-4.1, Gemini) to use Anchor correctly in straightforward cases.** Skills and instruction files are enhancements for reliability and host-specific behavior, not requirements.

### 8.2 Claude Code Integration

Claude Code is the primary target host. Two integration layers:

**Layer 1 — MCP server (required)**

Registered in `.mcp.json` or `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "anchor": {
      "command": "anchor",
      "args": ["mcp"],
      "type": "stdio"
    }
  }
}
```

**Layer 2 — CLAUDE.md context (recommended)**

A project-level `CLAUDE.md` entry tells Claude Code about Anchor and when to use it automatically:

```markdown
## Spec Management (Anchor)

This project uses Anchor for spec change detection. The `anchor` MCP tool is available.

**When to use Anchor automatically:**
- Before implementing any feature, run `anchor_manifest` to check if specs changed since last implementation
- If specs changed, run `anchor_compare_corpus` and read the instructions for your target before writing code
- After the product team commits to `docs/specs/`, always run Anchor before touching implementation files

**Targets in this project:** ios, android, api-consumer, qa

**Spec corpus location:** `docs/specs/`
```

**Layer 3 — Claude Code slash command (optional convenience)**

`.claude/commands/anchor-check.md`:

```markdown
Run anchor_compare_corpus for the docs/specs/ folder comparing HEAD~1 to HEAD,
targeting {{target}}. Read the returned instructions carefully and summarize
what needs to change before proceeding with implementation.
```

Skills vs. MCP description for Claude Code: **the MCP description is sufficient for invocation**. The CLAUDE.md layer adds *behavioral guidance* — telling Claude Code *when* to proactively use Anchor, not just how. Without CLAUDE.md, Claude Code will use Anchor when asked but won't proactively check for spec changes. With it, Claude Code becomes spec-aware automatically.

### 8.3 GitHub Copilot Integration

Copilot uses a different convention: agent instructions live in `.github/copilot-instructions.md` (repo-level) or `.github/instructions/*.instructions.md` (file-pattern-scoped). Copilot does not yet support custom MCP servers in all contexts, so Anchor also ships a **Copilot skill** as a fallback.

**Copilot MCP (where supported):**

Configured in VS Code settings or Copilot workspace config. Same MCP server, different registration format.

**Copilot instructions file:**

`.github/copilot-instructions.md`:

```markdown
## Anchor Spec Tool

Anchor is available as an MCP tool for spec change detection.

Before implementing changes related to any feature area, check whether the spec
has changed: use the `anchor_compare_corpus` tool on `docs/specs/` comparing
the last known good ref to HEAD.

If Anchor returns BREAKING or BEHAVIORAL deltas for your target, address those
changes before writing implementation code.
```

**Copilot skill (fallback for non-MCP contexts):**

`.github/copilot/skills/anchor.md` — a prompt-based skill that instructs Copilot how to invoke Anchor via CLI when MCP is unavailable:

```markdown
## anchor-check skill

When asked to check for spec changes, run:
  `npx anchor compare --corpus docs/specs/ --from HEAD~1 --to HEAD --target {target} --format json`

Parse the JSON output and report BREAKING and BEHAVIORAL changes for the specified target.
```

**Key difference from Claude Code:** Copilot's instruction files are more about *behavioral priming* than tool discovery. Copilot is less proactive about MCP tool usage, so the instructions file carries more weight. The MCP description alone is less reliable for Copilot — the `.github/copilot-instructions.md` file is important for consistent behavior.

### 8.4 OpenClaw Integration

OpenClaw is a browser automation agent framework that can invoke MCP tools. Anchor is relevant to OpenClaw primarily in CI/CD and workflow automation contexts — e.g., OpenClaw monitors a Confluence or Notion space, detects product spec changes, exports them to the git corpus, and triggers Anchor.

OpenClaw connects to Anchor via SSE MCP transport:

```yaml
# OpenClaw workflow config
tools:
  - name: anchor
    type: mcp-sse
    url: http://localhost:3456

triggers:
  - on: confluence_page_updated
    space: PRODUCT
    run: |
      anchor_compare_corpus({
        folderPath: "docs/specs/",
        fromRef: "main~1",
        toRef: "main",
        targets: ["ios", "android"]
      })
```

OpenClaw's lack of a persistent project context (unlike Claude Code) means it relies entirely on the MCP tool descriptions for correct invocation. **For OpenClaw, rich MCP tool descriptions are critical** — there is no CLAUDE.md equivalent. The descriptions must be self-contained.

Additionally, Anchor ships an OpenClaw-specific workflow template (`templates/openclaw-workflow.yaml`) as part of the npm package.

### 8.5 Cursor, Windsurf, and Other MCP Clients

These hosts all support MCP via stdio or SSE and use the MCP tool descriptions directly. No host-specific files needed beyond registering the MCP server. For hosts that support markdown instruction files (Cursor's `.cursor/rules/`, Windsurf's `.windsurfrules`), Anchor's `anchor init --host cursor` command generates the appropriate file.

### 8.6 Summary: What Each Integration Layer Does

| Layer | Claude Code | Copilot | OpenClaw | Cursor/Other |
|---|---|---|---|---|
| MCP tool descriptions | Sufficient for invocation | Sufficient for invocation | **Critical** — only layer | Sufficient for invocation |
| Host instruction file | Adds proactive behavior | **Important** for consistency | N/A | Adds proactive behavior |
| Skill / slash command | Convenience shortcut | Fallback (non-MCP) | N/A | N/A |
| `anchor init --host` | Generates CLAUDE.md entry | Generates copilot-instructions | Generates workflow template | Generates rules file |

---

## 9. Fully Agentic Product→Dev Handoff

### 9.1 The Handoff Problem

In traditional teams, a product manager updates a spec and then manually notifies developers. In an AI-assisted team, a product agent might update the spec — but the dev agents still need to know what changed and what to do. In a fully agentic team, *no human coordinates this at all*.

Anchor is designed to be the coordination layer in this handoff. The flow is:

```
Product Agent                Anchor                    Dev Agents
─────────────                ──────                    ──────────
Updates spec files    →   Detects changes          →   Receives instructions
Commits to git             Classifies severity          Implements changes
                           Routes to targets            Runs tests
                           Generates instructions       Commits code
```

### 9.2 Trigger Mechanisms

**Git hook (simplest):**

`.git/hooks/post-commit` or via Husky:

```bash
#!/bin/sh
# If any files in docs/specs/ changed, run Anchor and write instruction files
if git diff --name-only HEAD~1 HEAD | grep -q "^docs/specs/"; then
  anchor compare --corpus docs/specs/ --from HEAD~1 --to HEAD \
    --write-instructions .anchor/instructions/
fi
```

**GitHub Actions (CI/CD):**

```yaml
name: Anchor Spec Check
on:
  push:
    paths: ['docs/specs/**']

jobs:
  anchor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - run: npm install -g @anchor_app/anchor
      - run: anchor compare --corpus docs/specs/ --from HEAD~1 --to HEAD
               --write-instructions .anchor/instructions/
               --format json > anchor-result.json
      - name: Notify dev agents
        # Post instruction files as artifacts, trigger downstream agent workflows
```

**`anchor watch` (local daemon):**

```bash
anchor watch --corpus docs/specs/ --on-change "echo 'Specs changed, running agents...'"
```

Polls or uses `chokidar` for filesystem watch. Fires `anchor compare` automatically when spec files change, writes instruction files.

### 9.3 Instruction File Format for Agent Consumption

When `--write-instructions` is specified, Anchor writes one file per target:

`.anchor/instructions/ios.md`:

```markdown
---
anchor_version: 3.0
generated_at: 2026-03-21T14:23:00Z
from_ref: abc1234
to_ref: def5678
target: ios
severity_ceiling: BEHAVIORAL
---

# Anchor: iOS Implementation Instructions

## Changes Requiring Action

### ⚠️ BEHAVIORAL — Checkout Screen + Wireframe

**Source:** `docs/specs/payments/checkout.md` + `docs/specs/payments/wireframes/checkout-v4.png`

The checkout spec and wireframe confirm a new payment method toggle supporting Apple Pay.

**ACTION REQUIRED:**
- Add `PKPaymentAuthorizationController` integration to `CheckoutViewController`
- Update `CheckoutViewModel` to handle `paymentMethod: .applePay` state
- Add Apple Pay entitlement to `Entitlements.plist`
- Add sandbox Apple Pay test to `CheckoutViewModelTests`

---

## No Action Required

### ℹ️ INFORMATIONAL — Order Confirmation copy change
Minor wording update to confirmation message. No code change needed.
```

This format is designed to be read directly by a dev agent with no additional context. The agent opens the file, reads it, and knows exactly what to do.

### 9.4 Product Agent Conventions

For a fully agentic workflow, the product agent (whatever tool it uses — Claude Code, a custom LLM workflow, OpenClaw scraping Notion) must follow Anchor's commit conventions so Anchor can detect its changes:

```bash
# Anchor watches for commits touching the spec corpus path
# Commit message convention (optional but recommended for filtering):
git commit -m "spec(payments): add Apple Pay to checkout flow [anchor-trigger]"
```

The `[anchor-trigger]` tag is optional — Anchor detects spec changes by path, not commit message. But it enables filtering in CI and log scanning.

### 9.5 Example: Fully Agentic Mobile App Workflow

```
[Product agent — Claude Code or custom workflow]
  Reads Notion page "Checkout V2 Requirements"
  Updates docs/specs/payments/checkout.md
  Adds docs/specs/payments/wireframes/checkout-v4.png
  Commits: "spec(payments): add Apple Pay and Google Pay [anchor-trigger]"

[Git post-commit hook fires anchor]
  anchor compare --corpus docs/specs/payments/ --from HEAD~1 --to HEAD
  → Writes .anchor/instructions/ios.md
  → Writes .anchor/instructions/android.md
  → Writes .anchor/instructions/qa.md

[iOS dev agent — Claude Code with CLAUDE.md awareness]
  Reads .anchor/instructions/ios.md automatically on next task
  Implements PKPaymentAuthorizationController
  Runs tests
  Commits: "feat(checkout): add Apple Pay support per anchor spec delta"

[Android dev agent — parallel]
  Reads .anchor/instructions/android.md
  Integrates Google Pay API
  Commits: "feat(checkout): add Google Pay support per anchor spec delta"

[QA agent]
  Reads .anchor/instructions/qa.md
  Generates test cases for both payment paths
  Updates E2E test suite
```

No human coordination. No Slack messages. No "did you see the spec update?"

---

## 10. MCP Tool Interface

```typescript
// anchor_compare_corpus — primary entry point
{
  name: "anchor_compare_corpus",
  description: `Compare all spec files within a folder across two git refs and generate
    targeted implementation instructions. Use this when spec documents have changed and
    you need to know what implementation work is required. Returns structured JSON with
    per-target instruction blocks. Call anchor_manifest first if you only need a file-level
    overview without LLM analysis.`,
  inputSchema: {
    folderPath: "string — folder path relative to repo root, e.g. 'docs/specs/payments'",
    fromRef: "string — starting git ref: branch, tag, or commit SHA",
    toRef: "string — ending git ref, defaults to HEAD",
    targets: "string[] — filter to specific targets, omit for all",
    minSeverity: "'BREAKING' | 'BEHAVIORAL' | 'INFORMATIONAL' — default INFORMATIONAL",
    includeGlobs: "string[] — optional file include patterns",
    excludeGlobs: "string[] — optional file exclude patterns",
    repoPath: "string — absolute repo root path, defaults to cwd"
  }
}

// anchor_compare — single file
{
  name: "anchor_compare",
  description: `Compare a single spec file (text or image) across two git refs.
    Use for targeted analysis of one document rather than a full corpus.`
}

// anchor_manifest — zero-cost file overview
{
  name: "anchor_manifest",
  description: `Return the list of files that changed in a spec folder between two refs,
    with no LLM analysis. Zero cost. Use this first to determine whether full analysis
    is needed, or to see which files changed before deciding which targets to compare.`
}

// anchor_history — commit list for a path
{
  name: "anchor_history",
  description: `List recent git commits that touched a spec file or folder.
    Use to find a specific ref to compare against, or to understand the commit history
    of a spec corpus.`
}

// anchor_targets — list configured targets
{
  name: "anchor_targets",
  description: `List the consumer targets configured in .anchor.yaml for this repo.
    Returns target names, descriptions, and routing rules. Use before anchor_compare_corpus
    to know which target names are valid for the targets parameter.`
}

// anchor_baseline_status — check baseline health
{
  name: "anchor_baseline_status",
  description: `Check whether the current repo has an Anchor baseline, when it was
    generated, and whether it may be stale relative to recent code changes.
    Returns a recommendation to run anchor baseline --update if needed.`
}
```

---

## 11. Data Model (TypeScript)

```typescript
export interface AnchorResult {
  metadata: CorpusMetadata;
  summary: CorpusSummary;
  fileDeltas: FileDelta[];
  correlatedDeltas: CorrelatedDelta[];
  targetInstructions: TargetInstruction[];
}

export interface CorpusMetadata {
  path: string;
  isCorpus: boolean;
  fromRef: string;
  toRef: string;
  fromCommitSha: string;
  toCommitSha: string;
  generatedAt: string;          // ISO8601
  totalFilesScanned: number;
  totalFilesChanged: number;
}

export interface CorpusSummary {
  filesAdded: number;
  filesRemoved: number;
  filesModified: number;
  filesRenamed: number;
  textSectionsChanged: number;
  imagesChanged: number;
  imagesSkippedIdentical: number;
  breakingCount: number;
  behavioralCount: number;
  informationalCount: number;
  suppressedCosmeticCount: number;
}

export interface FileDelta {
  path: string;
  previousPath?: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'RENAMED';
  kind: 'TEXT' | 'IMAGE' | 'BINARY' | 'UNKNOWN';
  maxSeverity: Severity;
}

export interface CorrelatedDelta {
  correlationId: string;
  strength: 'EXPLICIT' | 'STEM_MATCH' | 'DIRECTORY' | 'NONE';
  textDeltas: SectionDelta[];
  imageDeltas: ImageDelta[];
  maxSeverity: Severity;
}

export interface SectionDelta {
  sectionId: string;            // normalized heading path
  sourceFile: string;
  heading: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'REORDERED';
  severity: Severity;
  severityRationale: string;
  beforeText?: string;
  afterText?: string;
  lineRangeBefore?: [number, number];
  lineRangeAfter?: [number, number];
  referencedImagePaths: string[];
}

export interface ImageDelta {
  imageId: string;
  path: string;
  previousPath?: string;
  role: 'WIREFRAME' | 'SCREENSHOT' | 'DIAGRAM' | 'ICON_OR_ASSET' | 'UNKNOWN';
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED';
  severity: Severity;
  severityRationale: string;
  changeSummary: string;
  elementsAdded: string[];
  elementsRemoved: string[];
  elementsMoved: string[];
  elementsModified: string[];
  pHashDistance: number;
  isOrphaned: boolean;
}

export interface TargetInstruction {
  targetName: string;
  correlationIds: string[];
  instructions: string;         // markdown, agent-ready
  severityCeiling: Severity;
}

export type Severity = 'BREAKING' | 'BEHAVIORAL' | 'INFORMATIONAL' | 'COSMETIC';
```

---

## 12. Configuration

`.anchor.yaml` at repo root or corpus root:

```yaml
version: 3

llm:
  provider: anthropic               # anthropic | openai | azure | ollama
  classificationModel: claude-haiku-4-5-20251001
  instructionModel: claude-haiku-4-5-20251001
  visionModel: claude-haiku-4-5-20251001
  # Upgrade for higher-stakes specs:
  # instructionModel: claude-sonnet-4-6

corpus:
  minSeverity: INFORMATIONAL
  suppressCosmetic: true
  includeGlobs:
    - "**/*.md"
    - "**/*.yaml"
    - "**/*.yml"
    - "**/*.json"
    - "**/*.png"
    - "**/*.jpg"
    - "**/*.webp"
    - "**/*.svg"
  excludeGlobs:
    - "drafts/**"
    - "archive/**"
    - "**/node_modules/**"

images:
  pHashSkipThreshold: 3
  pHashBreakingThreshold: 16
  roleOverrides:
    - glob: "assets/wireframes/**"
      role: wireframe
    - glob: "assets/screenshots/**"
      role: screenshot

correlation:
  stemMatchEnabled: true
  directoryMatchEnabled: true

# Output options for fully agentic workflows
output:
  writeInstructions: false          # write .anchor/instructions/{target}.md
  instructionsPath: ".anchor/instructions"
  commitInstructions: false         # auto-commit instruction files

targets:
  - name: ios
    description: "iOS Swift/SwiftUI engineering agent"
    fileGlobs: ["**/*"]
    sections: ["Mobile", "Auth", "Push", "Login", "Onboarding", "Notifications"]
    keywords: ["swift", "ios", "uikit", "swiftui", "xcode", "apns", "biometric"]
    imageRoles: [wireframe, screenshot]
    minSeverity: BEHAVIORAL

  - name: android
    description: "Android Kotlin/Jetpack engineering agent"
    fileGlobs: ["**/*"]
    sections: ["Mobile", "Auth", "Push", "Login", "Onboarding", "Notifications"]
    keywords: ["kotlin", "android", "jetpack", "fcm", "biometric"]
    imageRoles: [wireframe, screenshot]
    minSeverity: BEHAVIORAL

  - name: api-consumer
    description: "Frontend / API consumer agent"
    fileGlobs: ["api/**", "contracts/**", "**/*.yaml", "**/*.json"]
    sections: ["API", "Endpoints", "Auth", "Errors", "Rate Limiting", "Schema"]
    keywords: ["endpoint", "request", "response", "header", "status", "schema"]
    imageRoles: [diagram]
    minSeverity: INFORMATIONAL

  - name: qa
    description: "QA and test automation agent"
    fileGlobs: ["**/*"]
    sections: []
    keywords: []
    imageRoles: [wireframe, screenshot, diagram]
    minSeverity: BEHAVIORAL

  - name: backend
    description: "Backend / API implementation agent"
    fileGlobs: ["api/**", "schemas/**", "**/*.yaml"]
    sections: ["API", "Data Model", "Schema", "Auth", "Validation", "Errors"]
    keywords: ["endpoint", "field", "type", "validation", "migration", "schema"]
    imageRoles: [diagram]
    minSeverity: INFORMATIONAL
```

---

## 13. TypeScript Project Structure

```
anchor/
├── package.json
├── tsconfig.json
├── vitest.config.ts
│
├── src/
│   ├── cli/                        # CLI entry points
│   │   ├── index.ts                # commander.js root
│   │   ├── commands/
│   │   │   ├── baseline.ts         # anchor baseline
│   │   │   ├── compare.ts          # anchor compare
│   │   │   ├── watch.ts            # anchor watch
│   │   │   ├── init.ts             # anchor init --host
│   │   │   └── mcp.ts              # anchor mcp (starts MCP server)
│   │   └── output/
│   │       ├── json.ts
│   │       ├── markdown.ts
│   │       └── instructions.ts
│   │
│   ├── baseline/                   # anchor baseline engine
│   │   ├── index.ts
│   │   ├── extractors/
│   │   │   ├── RouteExtractor.ts   # Express, Fastify, Next.js, tRPC
│   │   │   ├── SchemaExtractor.ts  # Prisma, Drizzle, Zod, TypeORM
│   │   │   ├── ScreenExtractor.ts  # React/RN component tree, pages
│   │   │   ├── OpenApiExtractor.ts # passthrough existing OpenAPI
│   │   │   ├── AssetExtractor.ts   # images, diagrams
│   │   │   └── PackageExtractor.ts # dependencies, framework detection
│   │   ├── SectionGenerator.ts     # Haiku pass: code → spec prose
│   │   ├── CorpusWriter.ts         # assemble folder structure
│   │   └── TargetDetector.ts       # auto-detect targets from signals
│   │
│   ├── diff/                       # diff engine
│   │   ├── CorpusTreeDiffer.ts     # file-level tree diff
│   │   ├── text/
│   │   │   ├── DocumentParser.ts   # pluggable strategy
│   │   │   ├── MarkdownParser.ts
│   │   │   ├── OpenApiParser.ts
│   │   │   ├── PlainTextParser.ts
│   │   │   └── SectionDiffer.ts    # structural diff + fuzzy match
│   │   ├── images/
│   │   │   ├── PerceptualHasher.ts # pHash (sharp library)
│   │   │   ├── ImageRoleClassifier.ts
│   │   │   └── ImageChangeDetector.ts
│   │   └── CrossAssetCorrelator.ts
│   │
│   ├── routing/
│   │   ├── TargetRouter.ts
│   │   └── GlobMatcher.ts          # minimatch
│   │
│   ├── llm/
│   │   ├── LlmClient.ts            # interface
│   │   ├── AnthropicClient.ts      # @anthropic-ai/sdk with prompt caching
│   │   ├── OpenAiClient.ts
│   │   ├── SectionClassifier.ts    # batched text classification
│   │   ├── ImageDiffDescriber.ts   # role-aware vision prompts
│   │   └── InstructionGenerator.ts
│   │
│   ├── git/
│   │   ├── GitExtractor.ts         # simple-git wrapper
│   │   └── GitTreeDiffer.ts
│   │
│   ├── config/
│   │   ├── AnchorConfig.ts
│   │   └── ConfigLoader.ts         # js-yaml
│   │
│   ├── mcp/
│   │   ├── McpServer.ts            # @modelcontextprotocol/sdk
│   │   └── tools/
│   │       ├── CompareCorpusTool.ts
│   │       ├── CompareFileTool.ts
│   │       ├── ManifestTool.ts
│   │       ├── HistoryTool.ts
│   │       ├── TargetsTool.ts
│   │       └── BaselineStatusTool.ts
│   │
│   └── models/                     # TypeScript interfaces (Section 11)
│       └── index.ts
│
├── templates/                      # host integration templates
│   ├── claude/
│   │   ├── CLAUDE.md.template
│   │   └── anchor-check.md.template  # slash command
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
└── tests/
    ├── unit/
    ├── integration/                # real git repos with fixture commits
    └── fixtures/
        ├── sample-spec-corpus/
        └── sample-vibe-app/        # for baseline testing
```

**Key npm dependencies:**

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server hosting |
| `@anthropic-ai/sdk` | Anthropic API with vision + prompt caching |
| `simple-git` | Git operations |
| `sharp` | Image processing + pHash computation |
| `marked` or `remark` | Markdown parsing |
| `js-yaml` | YAML config and OpenAPI parsing |
| `minimatch` | Glob pattern matching |
| `commander` | CLI argument parsing |
| `openai` | OpenAI provider swap |
| `chokidar` | File watching (`anchor watch`) |
| `@ts-morph/common` | TypeScript AST for ScreenExtractor |
| `vitest` | Testing |

---

## 14. Token Economy

| Step | Approach | Model | Token Scope |
|---|---|---|---|
| File tree diff | Git tree compare | None | 0 |
| File classification | Extension + heuristic | None | 0 |
| Section split | Deterministic parser | None | 0 |
| Section match | Fuzzy string match (Levenshtein) | None | 0 |
| Image SHA check | SHA-256 comparison | None | 0 |
| Perceptual hash gate | pHash distance (sharp) | None | 0 |
| Image role classification | Filename + dimensions | None | 0 |
| Text severity classification | Per changed section, batched | Haiku text | Section text only |
| Image diff description | Per changed image (pHash gate) | Haiku vision | Both image versions |
| Instruction generation | Per target × matched deltas | Haiku text | Filtered delta JSON |
| Baseline section generation | Per module, batched | Haiku text | Module code only |

**Rough cost estimates:**

- *Single file, 5 modified sections, 3 targets:* ~3,000 tokens → **< $0.01**
- *Folder, 3 changed text files, 2 changed images, 3 targets:* ~8,800 tokens → **~$0.03**
- *Large corpus, 10 changed text files, 8 images, 4 targets:* ~29,500 tokens → **~$0.09**
- *Baseline, medium app (50 routes, 20 screens, 10 models):* ~150,000 tokens → **~$0.45**

---

## 15. Implementation Plan

### Phase 1 — Core Diff, Single File (MVP)
- `simple-git` blob extraction
- `MarkdownParser` with image ref capture
- `SectionDiffer` structural diff + fuzzy heading match
- `AnthropicClient` Haiku text classification
- `AnchorResult` JSON output
- MCP tools: `anchor_compare`, `anchor_history`
- `npm install -g @anchor_app/anchor`, `anchor mcp`
- Claude Code CLAUDE.md template

### Phase 2 — Corpus / Multi-File
- `CorpusTreeDiffer` file-level add/remove/rename
- `anchor_compare_corpus`, `anchor_manifest` MCP tools
- `.anchor.yaml` config loading
- Glob filtering, `TargetRouter`
- Per-target instruction generation + `--write-instructions`
- `anchor init --host [claude|copilot|cursor|openclaw]`

### Phase 3 — Image Pipeline
- `sharp`-based pHash
- `ImageRoleClassifier`, `ImageChangeDetector`
- Vision LLM diff (Haiku vision)
- Added/removed image handling

### Phase 4 — Correlation & Agentic Workflow
- `CrossAssetCorrelator`
- Correlated instruction generation
- `anchor watch` daemon
- GitHub Actions template
- OpenClaw workflow template

### Phase 5 — Baseline Engine
- `RouteExtractor`, `SchemaExtractor`, `ScreenExtractor`
- `SectionGenerator` (Haiku batched)
- `TargetDetector` auto-config
- `anchor baseline`, `anchor baseline --update`
- Copilot skill fallback

### Phase 6 — Parser Coverage & Hardening
- `OpenApiParser`, `PlainTextParser`
- SVG dual-pipeline (XML + rasterize)
- SHA-pair result caching (`.anchor/cache/`)
- Parallel LLM calls (configurable, default 4)
- `OpenAiClient` provider swap
- `anchor_baseline_status` MCP tool

---

## 16. Example Workflows

### Scenario A: Vibe App Rescue

```bash
cd my-spaghetti-app
npm install -g @anchor_app/anchor
anchor baseline

→ Analyzing codebase...
  Found: 23 Express routes, 8 Prisma models, 14 React screens
  Generating spec sections (batched Haiku)...
→ Created anchor-specs/
  api/endpoints.md       — 23 endpoint descriptions
  data/models.md         — 8 model descriptions
  screens/               — 14 screen specs
  .anchor.yaml           — auto-configured targets: api-consumer, backend, qa
→ Committed: "anchor: baseline v0.1 (auto-generated)"

# Now Anchor has something to diff against.
# Make code changes, then:
anchor compare --corpus anchor-specs/ --from HEAD~1 --to HEAD
```

### Scenario B: Fully Agentic Mobile Handoff

```
[Product agent commits spec update]
[Git hook fires]
anchor compare --corpus docs/specs/ --from HEAD~1 --to HEAD --write-instructions

→ .anchor/instructions/ios.md     (BEHAVIORAL: new Apple Pay flow)
→ .anchor/instructions/android.md (BEHAVIORAL: new Google Pay flow)
→ .anchor/instructions/qa.md      (BEHAVIORAL: new payment paths)

[iOS Claude Code agent reads CLAUDE.md, sees instructions file, implements]
[Android agent reads instructions, implements in parallel]
[QA agent generates test cases]
[No human coordination required]
```

### Scenario C: API Breaking Change Notification

```
anchor compare \
  --file api/contracts/payments-api.yaml \
  --from v1.3.0 --to v1.4.0 \
  --targets api-consumer,backend,qa

→ api-consumer instruction:
   "BREAKING — POST /payments
    The `card_token` field renamed to `payment_method_token`.
    ALL existing integrations receive 422 until updated.
    ACTION: Update PaymentsApiClient.createPayment(), update all call sites."
```

---

## 17. Open Questions / Design Decisions

| Question | Options | Recommendation |
|---|---|---|
| pHash via sharp | sharp has basic resize; custom DCT needed | Implement DCT in pure TS; small, no extra dep |
| Vision model | Haiku vision, Sonnet vision | Haiku by default; config override per image role |
| SVG diff strategy | Text (XML diff) or render to PNG | Both: XML section diff + rasterized visual diff |
| PDF | Text extraction only, or render pages | Phase 6: pdf-parse for text; pdf.js for render |
| Section too large | Truncate, chunk, skip | Chunk with overlap; flag `wasTruncated: true` |
| Result caching | None, in-memory, on-disk | On-disk at `.anchor/cache/{from_sha}-{to_sha}/` |
| Parallel LLM calls | Sequential, fully parallel | Parallel with configurable limit (default: 4) |
| Baseline --update strategy | Regenerate all, regenerate changed only | Changed only; preserve manual edits via frontmatter |
| Multi-repo corpus | Out of scope or supported | Out of scope for now |
| Copilot MCP support | Varies by Copilot version | Ship both MCP + skill fallback; detect at runtime |
| OpenClaw MCP transport | stdio vs SSE | SSE for OpenClaw (no persistent process); stdio for local |
