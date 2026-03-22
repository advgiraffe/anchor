import { describe, expect, it } from "vitest";
import { targetsAction } from "../../../src/commands/targets.js";

describe("targetsAction", () => {
  it("renders targets in table format", async () => {
    const chunks: string[] = [];

    const targets = await targetsAction(
      {
        config: ".anchor.yaml",
        format: "table",
      },
      {
        configLoader: {
          load() {
            return {
              targets: [
                {
                  name: "ios",
                  description: "iOS team",
                  fileGlobs: ["docs/mobile/**"],
                  minSeverity: "BEHAVIORAL",
                },
              ],
            };
          },
        } as never,
        emitOutput(output) {
          chunks.push(output);
        },
      },
    );

    expect(targets).toHaveLength(1);
    expect(chunks.join("\n")).toContain("Configured targets:");
    expect(chunks.join("\n")).toContain("- ios");
  });

  it("renders targets in json format", async () => {
    const chunks: string[] = [];

    await targetsAction(
      {
        config: ".anchor.yaml",
        format: "json",
      },
      {
        configLoader: {
          load() {
            return {
              targets: [
                {
                  name: "backend",
                  fileGlobs: ["docs/api/**"],
                },
              ],
            };
          },
        } as never,
        emitOutput(output) {
          chunks.push(output);
        },
      },
    );

    const payload = JSON.parse(chunks.join(""));
    expect(payload).toHaveLength(1);
    expect(payload[0].name).toBe("backend");
  });
});
