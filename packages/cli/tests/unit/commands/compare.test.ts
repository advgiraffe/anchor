import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareAction } from "../../../src/commands/compare.js";
import { createTempGitRepo } from "../../../../../tests/helpers/tempGitRepo.js";
import { SectionClassifier, type AnchorResult } from "@anchor_app/core";

describe("compareAction", () => {
  it("runs compare against a temporary git repository without touching the main repo", async () => {
    const repo = createTempGitRepo();

    try {
      const firstRef = repo.commitFile(
        "docs/spec.md",
        [
          "# API",
          "",
          "## Authentication",
          "Use API key",
          "",
          "## Errors",
          "401 Unauthorized",
        ].join("\n"),
        "initial spec",
      );

      const secondRef = repo.commitFile(
        "docs/spec.md",
        [
          "# API",
          "",
          "## Authentication",
          "Use OAuth token",
          "",
          "## Rate Limiting",
          "100 requests per hour",
        ].join("\n"),
        "updated spec",
      );

      const result = await compareAction(
        {
          from: firstRef,
          to: secondRef,
          file: "docs/spec.md",
        },
        {
          repoPath: repo.dir,
          classifier: {
            async classifyChange(title, _oldContent, _newContent, changeType) {
              return {
                severity:
                  changeType === "REMOVED"
                    ? "BREAKING"
                    : changeType === "MODIFIED"
                      ? "BEHAVIORAL"
                      : "INFORMATIONAL",
                summary: `${title} changed`,
                reasoning: `classified ${changeType}`,
              };
            },
          },
          logger: {
            debug() {},
            info() {},
            warn() {},
            error() {},
          },
          emitResult: () => undefined,
        },
      );

      const typedResult = result as AnchorResult;
      expect(typedResult.metadata.totalFilesChanged).toBe(1);
      expect(typedResult.fileDeltas).toHaveLength(1);
      expect(typedResult.fileDeltas[0].sectionDeltas).toHaveLength(3);
      expect(typedResult.fileDeltas[0].sectionDeltas.some((delta) => delta.title === "Authentication" && delta.changeType === "MODIFIED")).toBe(true);
      expect(typedResult.fileDeltas[0].sectionDeltas.some((delta) => delta.title === "Errors" && delta.changeType === "REMOVED")).toBe(true);
      expect(typedResult.fileDeltas[0].sectionDeltas.some((delta) => delta.title === "Rate Limiting" && delta.changeType === "ADDED")).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  it("uses deterministic fallback classification when the classifier throws", async () => {
    const repo = createTempGitRepo();

    try {
      const firstRef = repo.commitFile(
        "docs/spec.md",
        [
          "# API",
          "",
          "## Authentication",
          "Use API key",
        ].join("\n"),
        "initial spec",
      );

      const secondRef = repo.commitFile(
        "docs/spec.md",
        [
          "# API",
          "",
          "## Authentication",
          "BREAKING CHANGE: OAuth token is now required",
        ].join("\n"),
        "updated spec",
      );

      const result = await compareAction(
        {
          from: firstRef,
          to: secondRef,
          file: "docs/spec.md",
        },
        {
          repoPath: repo.dir,
          classifier: new SectionClassifier(undefined, {
            async call() {
              throw new Error("classifier unavailable");
            },
          }),
          logger: {
            debug() {},
            info() {},
            warn() {},
            error() {},
          },
          emitResult: () => undefined,
        },
      );

      expect(result.fileDeltas[0].sectionDeltas[0].severity).toBe("BREAKING");
    } finally {
      repo.cleanup();
    }
  });

  it("writes formatted compare output to a file", async () => {
    const repo = createTempGitRepo();
    const outDir = mkdtempSync(join(tmpdir(), "anchor-out-"));
    const outputPath = join(outDir, "report.md");

    try {
      const firstRef = repo.commitFile(
        "docs/spec.md",
        ["# API", "", "## Authentication", "Use API key"].join("\n"),
        "initial spec",
      );

      const secondRef = repo.commitFile(
        "docs/spec.md",
        ["# API", "", "## Authentication", "Use OAuth token"].join("\n"),
        "updated spec",
      );

      await compareAction(
        {
          from: firstRef,
          to: secondRef,
          file: "docs/spec.md",
          format: "markdown",
          output: outputPath,
        },
        {
          repoPath: repo.dir,
          logger: {
            debug() {},
            info() {},
            warn() {},
            error() {},
          },
          classifier: {
            async classifyChange(title) {
              return {
                severity: "BEHAVIORAL",
                summary: `${title} changed`,
                reasoning: "deterministic test classifier",
              };
            },
          },
        },
      );

      const output = readFileSync(outputPath, "utf8");
      expect(output).toContain("# Anchor Compare Report");
      expect(output).toContain("## docs/spec.md");
    } finally {
      repo.cleanup();
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("writes target-aware instructions output using config targets", async () => {
    const repo = createTempGitRepo();
    const outDir = mkdtempSync(join(tmpdir(), "anchor-out-"));
    const outputPath = join(outDir, "instructions.md");

    try {
      const firstRef = repo.commitFile(
        "docs/spec.md",
        ["# API", "", "## Authentication", "Use API key"].join("\n"),
        "initial spec",
      );

      const secondRef = repo.commitFile(
        "docs/spec.md",
        ["# API", "", "## Authentication", "Use OAuth token"].join("\n"),
        "updated spec",
      );

      await compareAction(
        {
          from: firstRef,
          to: secondRef,
          file: "docs/spec.md",
          format: "instructions",
          config: ".anchor.yaml",
          targets: "backend",
          output: outputPath,
        },
        {
          repoPath: repo.dir,
          logger: {
            debug() {},
            info() {},
            warn() {},
            error() {},
          },
          classifier: {
            async classifyChange(title) {
              return {
                severity: "BEHAVIORAL",
                summary: `${title} changed`,
                reasoning: "deterministic test classifier",
              };
            },
          },
          configLoader: {
            load() {
              return {
                targets: [
                  {
                    name: "backend",
                    description: "Backend engineering",
                    fileGlobs: ["docs/**"],
                  },
                  {
                    name: "mobile",
                    fileGlobs: ["mobile/**"],
                  },
                ],
              };
            },
          } as never,
        },
      );

      const output = readFileSync(outputPath, "utf8");
      expect(output).toContain("Anchor change instructions");
      expect(output).toContain("Target: backend");
      expect(output).not.toContain("Target: mobile");
    } finally {
      repo.cleanup();
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
