import { describe, expect, it } from "vitest";
import { compareAction } from "../../../src/commands/compare.js";
import { createTempGitRepo } from "../../../../../tests/helpers/tempGitRepo.js";
import type { AnchorResult } from "@anchor-ai/core";

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
});
