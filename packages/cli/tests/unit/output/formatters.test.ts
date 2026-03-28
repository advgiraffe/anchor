import { describe, expect, it } from "vitest";
import type { AnchorResult } from "../../../src/core/index.js";
import { formatResult, resolveFormatter } from "../../../src/output/FormatterRegistry.js";

const sampleResult: AnchorResult = {
  metadata: {
    path: "docs",
    fromRef: "abc",
    toRef: "def",
    generatedAt: "2026-03-22T00:00:00.000Z",
    totalFilesChanged: 1,
  },
  fileDeltas: [
    {
      path: "docs/spec.md",
      changeType: "MODIFIED",
      maxSeverity: "BEHAVIORAL",
      sectionDeltas: [
        {
          sectionId: "auth",
          title: "Authentication",
          changeType: "MODIFIED",
          severity: "BEHAVIORAL",
          summary: "OAuth required",
        },
      ],
    },
  ],
};

describe("output formatters", () => {
  it("formats json output", () => {
    const output = formatResult(sampleResult, "json");

    expect(output).toContain('"metadata"');
    expect(output).toContain('"path": "docs"');
    expect(output.endsWith("\n")).toBe(true);
  });

  it("formats markdown output", () => {
    const output = formatResult(sampleResult, "markdown");

    expect(output).toContain("# Anchor Compare Report");
    expect(output).toContain("## docs/spec.md");
    expect(output).toContain("[BEHAVIORAL] MODIFIED Authentication");
  });

  it("formats instructions output", () => {
    const output = formatResult(sampleResult, "instructions");

    expect(output).toContain("Anchor change instructions");
    expect(output).toContain("Target: default");
    expect(output).toContain("Required actions:");
    expect(output).toContain("BEHAVIORAL MODIFIED section \"Authentication\"");
  });

  it("formats sarif output", () => {
    const output = formatResult(sampleResult, "sarif");
    const parsed = JSON.parse(output);

    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0].tool.driver.name).toBe("anchor");
    expect(parsed.runs[0].results).toHaveLength(1);
    expect(parsed.runs[0].results[0].ruleId).toBe("ANCHOR_BEHAVIORAL");
  });

  it("rejects unknown format names", () => {
    expect(() => resolveFormatter("xml")).toThrow("Unsupported format");
  });
});
