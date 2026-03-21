import { type Severity } from "../models/index.js";
import { AnthropicClient } from "./providers/AnthropicClient.js";

export interface ClassificationResult {
  severity: Severity;
  summary: string;
  reasoning: string;
}

export class SectionClassifier {
  private client: AnthropicClient;

  constructor(apiKey?: string) {
    this.client = new AnthropicClient(apiKey);
  }

  /**
   * Classify a single section change as BREAKING, BEHAVIORAL, INFORMATIONAL, or COSMETIC
   */
  async classifyChange(
    title: string,
    oldContent: string | undefined,
    newContent: string | undefined,
    changeType: "ADDED" | "REMOVED" | "MODIFIED"
  ): Promise<ClassificationResult> {
    const systemPrompt = `You are a classification system for documentation changes. Classify the severity of a change based on its impact:

- BREAKING: Fundamental API/behavior change that requires immediate user action
- BEHAVIORAL: Feature change or behavior modification that affects how users interact
- INFORMATIONAL: Clarifications, examples, or new information that doesn't change behavior
- COSMETIC: Formatting, typo fixes, or trivial improvements

Respond with a JSON object: {"severity": "BREAKING"|"BEHAVIORAL"|"INFORMATIONAL"|"COSMETIC", "summary": "brief summary", "reasoning": "why this classification"}`;

    const userPrompt = this.buildClassificationPrompt(
      title,
      oldContent,
      newContent,
      changeType
    );

    const response = await this.client.call(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      512
    );

    try {
      const result = JSON.parse(response.content) as ClassificationResult;
      this.validateSeverity(result.severity);
      return result;
    } catch (error) {
      // Fallback parsing if JSON is wrapped in markdown
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
        this.validateSeverity(result.severity);
        return result;
      }
      throw new Error(
        `Failed to parse classification response: ${response.content}`
      );
    }
  }

  /**
   * Batch classify multiple section changes
   */
  async classifyChanges(
    changes: Array<{
      title: string;
      oldContent?: string;
      newContent?: string;
      changeType: "ADDED" | "REMOVED" | "MODIFIED";
    }>
  ): Promise<ClassificationResult[]> {
    // For now, classify sequentially to avoid rate limit issues
    // In production, could batch these more intelligently
    const results: ClassificationResult[] = [];

    for (const change of changes) {
      const result = await this.classifyChange(
        change.title,
        change.oldContent,
        change.newContent,
        change.changeType
      );
      results.push(result);

      // Add small delay between calls to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Build the user prompt for classification
   */
  private buildClassificationPrompt(
    title: string,
    oldContent: string | undefined,
    newContent: string | undefined,
    changeType: "ADDED" | "REMOVED" | "MODIFIED"
  ): string {
    let prompt = `Classify this documentation change:\n\nSection: "${title}"\nChange Type: ${changeType}\n\n`;

    if (changeType === "REMOVED") {
      prompt += `Old Content:\n${this.truncate(oldContent || "", 500)}\n\nNew Content: [SECTION REMOVED]`;
    } else if (changeType === "ADDED") {
      prompt += `Old Content: [SECTION ADDED]\n\nNew Content:\n${this.truncate(newContent || "", 500)}`;
    } else {
      prompt += `Old Content:\n${this.truncate(oldContent || "", 400)}\n\nNew Content:\n${this.truncate(newContent || "", 400)}`;
    }

    return prompt;
  }

  /**
   * Truncate content to specified length
   */
  private truncate(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + `\n... (truncated)`;
  }

  /**
   * Validate that the severity is a valid value
   */
  private validateSeverity(severity: unknown): asserts severity is Severity {
    const validSeverities: Severity[] = [
      "BREAKING",
      "BEHAVIORAL",
      "INFORMATIONAL",
      "COSMETIC",
    ];
    if (!validSeverities.includes(severity as Severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }
  }
}
