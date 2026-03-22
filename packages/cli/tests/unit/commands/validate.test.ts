import { describe, expect, it } from "vitest";
import { validateAction } from "../../../src/commands/validate.js";

describe("validateAction", () => {
  it("returns valid result for a valid config", async () => {
    const chunks: string[] = [];

    const result = await validateAction(
      {
        config: ".anchor.yaml",
        format: "text",
      },
      {
        configLoader: {
          load() {
            return {
              targets: [{ name: "ios", fileGlobs: ["docs/**"] }],
            };
          },
        } as never,
        cwd: "/repo",
        emitOutput(output) {
          chunks.push(output);
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.targetCount).toBe(1);
    expect(chunks.join("\n")).toContain("OK config valid");
  });

  it("returns invalid result and json output for invalid config", async () => {
    const chunks: string[] = [];

    const result = await validateAction(
      {
        config: ".anchor.yaml",
        format: "json",
      },
      {
        configLoader: {
          load() {
            throw new Error("bad config");
          },
        } as never,
        cwd: "/repo",
        emitOutput(output) {
          chunks.push(output);
        },
      },
    );

    expect(result.valid).toBe(false);
    const payload = JSON.parse(chunks.join(""));
    expect(payload.valid).toBe(false);
    expect(payload.message).toContain("bad config");
  });
});
