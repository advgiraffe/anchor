import { type Severity } from "../models/index.js";
import { AnthropicClient } from "./providers/AnthropicClient.js";

export interface ClassificationClient {
  call(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    systemPrompt?: string,
    maxTokens?: number,
  ): Promise<{ content: string }>;
}

export interface ClassificationResult {
  severity: Severity;
  summary: string;
  reasoning: string;
}

export class SectionClassifier {
  private client: ClassificationClient;

  constructor(apiKey?: string, client?: ClassificationClient) {
    this.client = client ?? new AnthropicClient(apiKey);
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

    try {
      const response = await this.client.call(
        [{ role: "user", content: userPrompt }],
        systemPrompt,
        512
      );

      return this.parseClassification(response.content);
    } catch {
      return this.fallbackClassification(title, oldContent, newContent, changeType);
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

  private parseClassification(content: string): ClassificationResult {
    try {
      const result = JSON.parse(content) as ClassificationResult;
      this.validateSeverity(result.severity);
      return result;
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Failed to parse classification response: ${content}`);
      }

      const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
      this.validateSeverity(result.severity);
      return result;
    }
  }

  private fallbackClassification(
    title: string,
    oldContent: string | undefined,
    newContent: string | undefined,
    changeType: "ADDED" | "REMOVED" | "MODIFIED",
  ): ClassificationResult {
    const combined = `${title}\n${oldContent ?? ""}\n${newContent ?? ""}`.toLowerCase();

    let severity: Severity;
    if (changeType === "REMOVED") {
      severity = "BREAKING";
    } else if (/(breaking|invalid|deprecated|removed|replace|oauth|required|must)/.test(combined)) {
      severity = changeType === "ADDED" ? "BEHAVIORAL" : "BREAKING";
    } else if (/(add|added|new|support|status|filter|limit|rate)/.test(combined)) {
      severity = "BEHAVIORAL";
    } else {
      severity = "INFORMATIONAL";
    }

    return {
      severity,
      summary: this.buildFallbackSummary(title, changeType, severity),
      reasoning: `Fallback rule-based classification used for ${changeType.toLowerCase()} change`,
    };
  }

  private buildFallbackSummary(
    title: string,
    changeType: "ADDED" | "REMOVED" | "MODIFIED",
    severity: Severity,
  ): string {
    switch (changeType) {
      case "REMOVED":
        return `${title} was removed and may require consumer action`;
      case "ADDED":
        return `${title} was added with ${severity.toLowerCase()} impact`;
      case "MODIFIED":
      default:
        return `${title} was modified with ${severity.toLowerCase()} impact`;
    }
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
