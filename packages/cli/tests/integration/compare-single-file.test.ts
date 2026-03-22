import { describe, expect, it, vi } from "vitest";
import type { AnchorResult, Severity } from "@anchor_app/core";
import { compareAction } from "../../src/commands/compare.js";
import { createTempGitRepo } from "../../../../tests/helpers/tempGitRepo.js";

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

describe("compare command integration (single-file)", () => {
  it("detects added, removed, and modified sections from real git refs", async () => {
    const repo = createTempGitRepo();

    try {
      const fromRef = repo.commitFile(
        "docs/spec.md",
        [
          "# API",
          "",
          "## Authentication",
          "Use API key.",
          "",
          "## Errors",
          "401 Unauthorized",
        ].join("\n"),
        "seed spec",
      );

      const toRef = repo.commitFile(
        "docs/spec.md",
        [
          "# API",
          "",
          "## Authentication",
          "Use OAuth token.",
          "",
          "## Rate Limiting",
          "100 requests per hour",
        ].join("\n"),
        "update spec",
      );

      const emitResult = vi.fn<[result: AnchorResult], void>();

      const result = await compareAction(
        {
          from: fromRef,
          to: toRef,
          file: "docs/spec.md",
        },
        {
          repoPath: repo.dir,
          logger: silentLogger,
          emitResult,
          classifier: {
            async classifyChange(_title, _oldContent, _newContent, changeType) {
              const severityByChangeType: Record<string, Severity> = {
                ADDED: "INFORMATIONAL",
                MODIFIED: "BEHAVIORAL",
                REMOVED: "BREAKING",
              };

              return {
                severity: severityByChangeType[changeType],
                summary: `section ${changeType.toLowerCase()}`,
                reasoning: "deterministic test classifier",
              };
            },
          },
        },
      );

      expect(result.metadata.path).toBe("docs/spec.md");
      expect(result.metadata.totalFilesChanged).toBe(1);
      expect(result.fileDeltas).toHaveLength(1);
      expect(result.fileDeltas[0].sectionDeltas).toHaveLength(3);
      expect(result.fileDeltas[0].maxSeverity).toBe("BREAKING");

      expect(
        result.fileDeltas[0].sectionDeltas.some(
          (delta) => delta.title === "Authentication" && delta.changeType === "MODIFIED",
        ),
      ).toBe(true);
      expect(
        result.fileDeltas[0].sectionDeltas.some(
          (delta) => delta.title === "Errors" && delta.changeType === "REMOVED",
        ),
      ).toBe(true);
      expect(
        result.fileDeltas[0].sectionDeltas.some(
          (delta) => delta.title === "Rate Limiting" && delta.changeType === "ADDED",
        ),
      ).toBe(true);

      expect(emitResult).toHaveBeenCalledTimes(1);
      expect(emitResult).toHaveBeenCalledWith(result);
    } finally {
      repo.cleanup();
    }
  });

  it("returns an empty section delta list when file content is unchanged", async () => {
    const repo = createTempGitRepo();

    try {
      const content = [
        "# API",
        "",
        "## Authentication",
        "Use API key.",
      ].join("\n");

      const fromRef = repo.commitFile("docs/spec.md", content, "seed spec");
      const toRef = repo.commitFile("docs/notes.md", "no-op metadata update", "no-op update");

      const result = await compareAction(
        {
          from: fromRef,
          to: toRef,
          file: "docs/spec.md",
        },
        {
          repoPath: repo.dir,
          logger: silentLogger,
          classifier: {
            async classifyChange() {
              return {
                severity: "COSMETIC",
                summary: "no-op",
                reasoning: "not used",
              };
            },
          },
          emitResult: () => undefined,
        },
      );

      expect(result.fileDeltas).toHaveLength(1);
      expect(result.fileDeltas[0].sectionDeltas).toHaveLength(0);
      expect(result.fileDeltas[0].maxSeverity).toBe("COSMETIC");
    } finally {
      repo.cleanup();
    }
  });

  it("rejects invalid file/corpus option combinations", async () => {
    await expect(
      compareAction(
        {
          from: "HEAD~1",
          to: "HEAD",
        },
        { logger: silentLogger },
      ),
    ).rejects.toThrow("Either --file or --corpus must be specified to compare");

    await expect(
      compareAction(
        {
          from: "HEAD~1",
          to: "HEAD",
          file: "docs/spec.md",
          corpus: "docs",
        },
        { logger: silentLogger },
      ),
    ).rejects.toThrow("Cannot specify both --file and --corpus");
  });
});
