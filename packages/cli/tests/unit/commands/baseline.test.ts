import { describe, expect, it } from "vitest";
import { baselineAction } from "../../../src/commands/baseline.js";

describe("baselineAction", () => {
  it("returns generated baseline summary in json format", async () => {
    const chunks: string[] = [];

    const result = await baselineAction(
      {
        src: "/repo/src",
        out: "/repo/docs/specs",
        dryRun: true,
        format: "json",
      },
      {
        cwd: "/repo",
        targetDetector: {
          detect() {
            return [{ name: "backend", fileGlobs: ["**/*"], minSeverity: "INFORMATIONAL" }];
          },
        } as never,
        sectionGenerator: {
          generate() {
            return [{ path: "overview.md", content: "# Overview\n" }];
          },
        } as never,
        corpusWriter: {
          write() {
            return {
              outputPath: "/repo/docs/specs",
              configPath: "/repo/docs/specs/.anchor.yaml",
              writtenFiles: ["/repo/docs/specs/overview.md", "/repo/docs/specs/.anchor.yaml"],
              dryRun: true,
            };
          },
        } as never,
        emitOutput(output) {
          chunks.push(output);
        },
      },
    );

    expect(result.targets).toHaveLength(1);
    const payload = JSON.parse(chunks.join(""));
    expect(payload.targets).toEqual(["backend"]);
    expect(payload.dryRun).toBe(true);
  });
});
