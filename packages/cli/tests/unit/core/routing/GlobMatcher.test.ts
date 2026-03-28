import { describe, expect, it } from "vitest";
import { GlobMatcher } from "../../../../src/core/routing/GlobMatcher.js";

describe("GlobMatcher", () => {
  const matcher = new GlobMatcher();

  it("matches star within a path segment", () => {
    expect(matcher.matches("docs/spec.md", "docs/*.md")).toBe(true);
    expect(matcher.matches("docs/sub/spec.md", "docs/*.md")).toBe(false);
  });

  it("matches globstar across nested segments", () => {
    expect(matcher.matches("docs/sub/spec.md", "docs/**/*.md")).toBe(true);
    expect(matcher.matches("src/index.ts", "docs/**/*.md")).toBe(false);
  });

  it("supports single-character wildcard", () => {
    expect(matcher.matches("apps/web-a", "apps/web-?")).toBe(true);
    expect(matcher.matches("apps/web-ab", "apps/web-?")).toBe(false);
  });

  it("normalizes windows-style separators", () => {
    expect(matcher.matches("docs\\spec.md", "docs/*.md")).toBe(true);
  });
});
