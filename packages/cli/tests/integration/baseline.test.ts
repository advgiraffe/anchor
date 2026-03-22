import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baselineAction } from "../../src/commands/baseline.js";

describe("baseline command integration", () => {
  it("generates baseline corpus and .anchor.yaml from a source tree", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "anchor-baseline-int-"));
    const srcDir = join(workspace, "app");
    const outDir = join(workspace, "docs/specs");

    try {
      writeFileSync(
        join(workspace, "package.json"),
        JSON.stringify(
          {
            dependencies: {
              prisma: "latest",
            },
            devDependencies: {
              jest: "latest",
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      // A minimal source file so inventory has at least one file.
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "index.ts"), "export const hello = 'world';\n", "utf8");

      const result = await baselineAction(
        {
          src: workspace,
          out: outDir,
          dryRun: false,
          format: "json",
        },
        {
          cwd: workspace,
          emitOutput: () => undefined,
        },
      );

      expect(result.targets.map((target) => target.name)).toContain("backend");
      expect(result.targets.map((target) => target.name)).toContain("qa");

      const overview = readFileSync(join(outDir, "overview.md"), "utf8");
      const targetsDoc = readFileSync(join(outDir, "targets.md"), "utf8");
      const config = readFileSync(join(outDir, ".anchor.yaml"), "utf8");

      expect(overview).toContain("# Baseline Overview");
      expect(targetsDoc).toContain("## backend");
      expect(config).toContain("targets:");
      expect(config).toContain("name: backend");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
