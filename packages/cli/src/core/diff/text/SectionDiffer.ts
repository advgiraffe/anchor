import type { ChangeType } from "../../models/index.js";
import type { ParsedSection } from "./parsers/MarkdownParser.js";

export interface SectionChange {
  sectionId: string;
  title: string;
  changeType: ChangeType;
  oldContent?: string;
  newContent?: string;
  similarity?: number;
}

export class SectionDiffer {
  /**
   * Detect changes between two sets of sections
   */
  diff(oldSections: ParsedSection[], newSections: ParsedSection[]): SectionChange[] {
    const changes: SectionChange[] = [];
    const oldMap = new Map(oldSections.map((section) => [section.id, section]));
    const newMap = new Map(newSections.map((section) => [section.id, section]));

    // Find removed and modified sections
    for (const [key, oldSection] of oldMap) {
      const newSection = newMap.get(key);

      if (!newSection) {
        // Section removed
        changes.push({
          sectionId: oldSection.id,
          title: oldSection.title,
          changeType: "REMOVED",
          oldContent: oldSection.content,
        });
      } else {
        // Check if content changed
        const normalized_old = this.normalizeContent(oldSection.content);
        const normalized_new = this.normalizeContent(newSection.content);

        if (normalized_old !== normalized_new) {
          changes.push({
            sectionId: oldSection.id,
            title: oldSection.title,
            changeType: "MODIFIED",
            oldContent: oldSection.content,
            newContent: newSection.content,
            similarity: this.calculateSimilarity(normalized_old, normalized_new),
          });
        }
      }
    }

    // Find added sections
    for (const [key, newSection] of newMap) {
      if (!oldMap.has(key)) {
        changes.push({
          sectionId: newSection.id,
          title: newSection.title,
          changeType: "ADDED",
          newContent: newSection.content,
        });
      }
    }

    return changes;
  }

  /**
   * Normalize content for comparison (trim whitespace, lowercase)
   */
  private normalizeContent(content: string): string {
    return content
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .toLowerCase();
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0;

    const common = this.commonSubstringLength(a, b);
    const maxLen = Math.max(a.length, b.length);
    return common / maxLen;
  }

  /**
   * Find longest common substring length
   */
  private commonSubstringLength(a: string, b: string): number {
    const aLines = a.split("\n");
    const bLines = b.split("\n");
    let common = 0;

    for (const line of aLines) {
      const probe = line.slice(0, 10);
      if (probe.length > 0 && bLines.some((bLine) => bLine.includes(probe))) {
        common++;
      }
    }

    return common;
  }
}
