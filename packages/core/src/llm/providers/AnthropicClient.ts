import Anthropic from "@anthropic-ai/sdk";
import { LlmApiError } from "../../errors/LlmApiError.js";
import {
  buildMissingAnthropicKeyMessage,
  DEFAULT_ANTHROPIC_MODEL,
  resolveAnthropicApiKey,
} from "../LlmClient.js";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  content: string;
  stopReason: "end_turn" | "max_tokens" | "stop_sequence";
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class AnthropicClient {
  private client: Anthropic;
  private model: string;

  constructor(
    apiKey?: string,
    model: string = DEFAULT_ANTHROPIC_MODEL,
    apiKeyEnvVarName?: string,
  ) {
    const keyResolution = resolveAnthropicApiKey({
      explicitApiKey: apiKey,
      explicitEnvVarName: apiKeyEnvVarName,
    });

    if (!keyResolution) {
      throw new LlmApiError(
        "NO_API_KEY",
        buildMissingAnthropicKeyMessage(apiKeyEnvVarName)
      );
    }

    this.client = new Anthropic({ apiKey: keyResolution.apiKey });
    this.model = model;
  }

  /**
   * Call Claude API with messages and return response
   */
  async call(
    messages: LlmMessage[],
    systemPrompt?: string,
    maxTokens: number = 1024
  ): Promise<LlmResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const textContent = response.content.find((block) => block.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new LlmApiError(
          "INVALID_RESPONSE",
          "No text content in API response"
        );
      }

      return {
        content: textContent.text,
        stopReason: response.stop_reason as "end_turn" | "max_tokens" | "stop_sequence",
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      throw new LlmApiError(
        "API_CALL_FAILED",
        `Anthropic API error while using model '${this.model}': ${errorMsg}`
      );
    }
  }
}
