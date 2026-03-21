import { describe, expect, it } from "vitest";
import { SectionDiffer } from "../../../src/diff/text/SectionDiffer.js";
import type { ParsedSection } from "../../../src/diff/text/parsers/MarkdownParser.js";

function section(id: string, title: string, content: string, level = 2): ParsedSection {
  return {
    id,
    title,
    level,
    content,
    startLine: 0,
    endLine: 1,
  };
}

describe("SectionDiffer", () => {
  it("detects added, removed, and modified sections", () => {
    const differ = new SectionDiffer();
    const oldSections = [
      section("s1", "Authentication", "Use API key"),
      section("s2", "Errors", "401 Unauthorized"),
    ];
    const newSections = [
      section("s1", "Authentication", "Use OAuth token"),
      section("s3", "Rate Limiting", "100 requests per hour"),
    ];

    const changes = differ.diff(oldSections, newSections);

    expect(changes).toHaveLength(3);
    expect(changes.find((change) => change.title === "Authentication")?.changeType).toBe("MODIFIED");
    expect(changes.find((change) => change.title === "Errors")?.changeType).toBe("REMOVED");
    expect(changes.find((change) => change.title === "Rate Limiting")?.changeType).toBe("ADDED");
  });
});
