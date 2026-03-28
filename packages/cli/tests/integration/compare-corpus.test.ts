import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { Severity } from "../../src/core/index.js";
import { compareAction } from "../../src/commands/compare.js";
import { createTempGitRepo } from "../../../../tests/helpers/tempGitRepo.js";

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

describe("compare command integration (corpus)", () => {
  it("returns per-file deltas for added, removed, and modified files inside corpus", async () => {
    const repo = createTempGitRepo();

    try {
      repo.commitFile(
        "docs/spec-a.md",
        ["# API", "", "## Auth", "Use API key"].join("\n"),
        "seed spec A",
      );

      const fromRef = repo.commitFile(
        "docs/spec-b.md",
        ["# API", "", "## Errors", "401 Unauthorized"].join("\n"),
        "seed spec B",
      );

      repo.commitFile(
        "other/ignored.md",
        ["# Other", "", "## Ignore", "Outside corpus"].join("\n"),
        "outside corpus",
      );

      repo.commitFile(
        "docs/spec-a.md",
        ["# API", "", "## Auth", "Use OAuth token"].join("\n"),
        "modify spec A",
      );

      repo.commitFile(
        "docs/spec-c.md",
        ["# API", "", "## Rate Limiting", "100 req/hour"].join("\n"),
        "add spec C",
      );

      rmSync(join(repo.dir, "docs/spec-b.md"));
      runGit(repo.dir, ["add", "-A"]);
      runGit(repo.dir, ["commit", "-m", "remove spec B"]);
      const toRef = runGit(repo.dir, ["rev-parse", "HEAD"]).trim();

      const result = await compareAction(
        {
          from: fromRef,
          to: toRef,
          corpus: "docs",
        },
        {
          repoPath: repo.dir,
          logger: silentLogger,
          emitResult: () => undefined,
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

      expect(result.metadata.path).toBe("docs");
      expect(result.metadata.totalFilesChanged).toBe(3);
      expect(result.fileDeltas).toHaveLength(3);

      expect(
        result.fileDeltas.some(
          (delta) => delta.path === "docs/spec-a.md" && delta.changeType === "MODIFIED",
        ),
      ).toBe(true);

      expect(
        result.fileDeltas.some(
          (delta) => delta.path === "docs/spec-b.md" && delta.changeType === "REMOVED",
        ),
      ).toBe(true);

      expect(
        result.fileDeltas.some(
          (delta) => delta.path === "docs/spec-c.md" && delta.changeType === "ADDED",
        ),
      ).toBe(true);

      expect(result.fileDeltas.every((delta) => !delta.path.startsWith("other/"))).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  it("returns no file deltas when corpus has no changes", async () => {
    const repo = createTempGitRepo();

    try {
      const fromRef = repo.commitFile(
        "docs/spec.md",
        ["# API", "", "## Auth", "Use API key"].join("\n"),
        "seed spec",
      );

      repo.commitFile("notes/chore.txt", "metadata", "non-corpus change");
      const toRef = runGit(repo.dir, ["rev-parse", "HEAD"]).trim();

      const result = await compareAction(
        {
          from: fromRef,
          to: toRef,
          corpus: "docs",
        },
        {
          repoPath: repo.dir,
          logger: silentLogger,
          emitResult: () => undefined,
          classifier: {
            async classifyChange() {
              return {
                severity: "COSMETIC",
                summary: "unused",
                reasoning: "unused",
              };
            },
          },
        },
      );

      expect(result.metadata.totalFilesChanged).toBe(0);
      expect(result.fileDeltas).toHaveLength(0);
    } finally {
      repo.cleanup();
    }
  });
});

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout;
}
