export interface ParsedSection {
  id: string;
  title: string;
  level: number;
  content: string;
  startLine: number;
  endLine: number;
}

export class MarkdownParser {
  /**
   * Parse markdown content into sections by heading hierarchy
   * Sections are delimited by headings (# ## ### etc)
   */
  parse(content: string): ParsedSection[] {
    const lines = content.split("\n");
    const sections: ParsedSection[] = [];
    const headingIds: string[] = [];
    const headingOccurrences = new Map<string, number>();

    let currentSection: Partial<ParsedSection> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section if exists
        if (currentSection) {
          sections.push({
            id: currentSection.id ?? "",
            level: currentSection.level ?? 0,
            title: currentSection.title ?? "",
            content: currentSection.content ?? "",
            startLine: currentSection.startLine ?? 0,
            endLine: i - 1,
          });
        }

        // Start new section
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        headingIds.splice(level - 1);

        const parentId = headingIds[level - 2];
        const titleId = this.generateSectionId(title);
        const baseId = parentId ? `${parentId}-${titleId}` : titleId;
        const occurrence = (headingOccurrences.get(baseId) ?? 0) + 1;
        headingOccurrences.set(baseId, occurrence);
        const currentId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
        headingIds[level - 1] = currentId;

        currentSection = {
          id: currentId,
          level,
          title,
          content: "",
          startLine: i,
        };
      } else if (currentSection) {
        // Append content to current section
        currentSection.content = (currentSection.content ?? "") + line + "\n";
      }
    }

    // Save final section
    if (currentSection) {
      sections.push({
        id: currentSection.id ?? "",
        level: currentSection.level ?? 0,
        title: currentSection.title ?? "",
        content: currentSection.content ?? "",
        startLine: currentSection.startLine ?? 0,
        endLine: lines.length - 1,
      });
    }

    return sections.filter((s) => s.title.trim().length > 0);
  }

  /**
   * Generate unique section ID from title
   */
  generateSectionId(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  }
}
