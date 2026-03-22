import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CorpusWriter } from "../../../src/baseline/CorpusWriter.js";

describe("CorpusWriter", () => {
  it("writes baseline sections and .anchor.yaml", () => {
    const dir = mkdtempSync(join(tmpdir(), "anchor-corpus-"));

    try {
      const writer = new CorpusWriter();
      const result = writer.write({
        outputPath: dir,
        sections: [
          { path: "overview.md", content: "# Overview\n" },
          { path: "inventory/files.md", content: "# Files\n" },
        ],
        targets: [
          {
            name: "backend",
            fileGlobs: ["**/*"],
            minSeverity: "INFORMATIONAL",
          },
        ],
      });

      expect(result.dryRun).toBe(false);
      expect(existsSync(join(dir, "overview.md"))).toBe(true);
      expect(existsSync(join(dir, "inventory/files.md"))).toBe(true);
      expect(existsSync(join(dir, ".anchor.yaml"))).toBe(true);
      expect(readFileSync(join(dir, ".anchor.yaml"), "utf8")).toContain("targets:");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
