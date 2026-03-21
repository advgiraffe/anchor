import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../../../src/diff/text/parsers/MarkdownParser.js";

describe("MarkdownParser", () => {
  it("splits markdown into heading-based sections", () => {
    const parser = new MarkdownParser();
    const sections = parser.parse([
      "# Intro",
      "Top level content",
      "",
      "## Details",
      "Nested content",
      "",
      "## Examples",
      "Example content",
    ].join("\n"));

    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe("Intro");
    expect(sections[0].level).toBe(1);
    expect(sections[0].content).toContain("Top level content");
    expect(sections[1].title).toBe("Details");
    expect(sections[2].title).toBe("Examples");
  });

  it("generates normalized section ids from titles", () => {
    const parser = new MarkdownParser();
    expect(parser.generateSectionId("GET /users (beta)!"))
      .toBe("get-users-beta");
  });
});
