import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initAction } from "../../../src/commands/init.js";

describe("initAction", () => {
  it("writes .anchor.yaml and selected host templates", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "anchor-init-"));
    const templates = join(cwd, "templates");

    try {
      mkdirSync(join(templates, "claude"), { recursive: true });
      writeFileSync(join(templates, "claude", "CLAUDE.md.template"), "claude template\n", "utf8");
      writeFileSync(
        join(templates, "claude", "anchor-check.md.template"),
        "anchor check template\n",
        "utf8",
      );

      const chunks: string[] = [];
      const result = await initAction(
        {
          host: "claude",
          src: ".",
          force: false,
        },
        {
          cwd,
          templateRoot: templates,
          targetDetector: {
            detect() {
              return [{ name: "backend", fileGlobs: ["**/*"], minSeverity: "INFORMATIONAL" }];
            },
          } as never,
          emitOutput(output) {
            chunks.push(output);
          },
        },
      );

      expect(result.targets).toHaveLength(1);
      expect(readFileSync(join(cwd, ".anchor.yaml"), "utf8")).toContain("targets:");
      expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toContain("claude template");
      expect(readFileSync(join(cwd, ".claude/commands/anchor-check.md"), "utf8")).toContain("anchor check template");
      expect(chunks.join("\n")).toContain("Anchor init complete");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("skips existing files unless force is enabled", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "anchor-init-skip-"));
    const templates = join(cwd, "templates");

    try {
      mkdirSync(join(templates, "claude"), { recursive: true });
      writeFileSync(join(templates, "claude", "CLAUDE.md.template"), "new template\n", "utf8");
      writeFileSync(join(templates, "claude", "anchor-check.md.template"), "check\n", "utf8");
      writeFileSync(join(cwd, "CLAUDE.md"), "existing\n", "utf8");

      const result = await initAction(
        {
          host: "claude",
          src: ".",
          force: false,
        },
        {
          cwd,
          templateRoot: templates,
          targetDetector: {
            detect() {
              return [{ name: "backend", fileGlobs: ["**/*"], minSeverity: "INFORMATIONAL" }];
            },
          } as never,
          emitOutput: () => undefined,
        },
      );

      expect(result.skippedFiles.some((path) => path.endsWith("CLAUDE.md"))).toBe(true);
      expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toContain("existing");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
