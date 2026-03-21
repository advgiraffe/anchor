import { describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_KEY_ENV_OVERRIDE_VAR,
  buildMissingAnthropicKeyMessage,
  getAnthropicEnvVarCandidates,
  resolveAnthropicApiKey,
} from "../../../src/llm/LlmClient.js";

describe("Anthropic key resolution", () => {
  it("prefers Anchor-specific env vars before provider default", () => {
    vi.stubEnv("ANCHOR_ANTHROPIC_KEY", "anchor-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "provider-key");

    const result = resolveAnthropicApiKey();

    expect(result?.apiKey).toBe("anchor-key");
    expect(result?.source).toBe("ANCHOR_ANTHROPIC_KEY");

    vi.unstubAllEnvs();
  });

  it("supports a custom override env var name", () => {
    vi.stubEnv(ANTHROPIC_KEY_ENV_OVERRIDE_VAR, "MY_CUSTOM_ANCHOR_KEY");
    vi.stubEnv("MY_CUSTOM_ANCHOR_KEY", "custom-key");

    const result = resolveAnthropicApiKey();

    expect(getAnthropicEnvVarCandidates()[0]).toBe("MY_CUSTOM_ANCHOR_KEY");
    expect(result?.apiKey).toBe("custom-key");
    expect(result?.source).toBe("MY_CUSTOM_ANCHOR_KEY");

    vi.unstubAllEnvs();
  });

  it("builds a clear missing-key message", () => {
    const message = buildMissingAnthropicKeyMessage();
    expect(message).toContain("ANCHOR_ANTHROPIC_KEY");
    expect(message).toContain("ANTHROPIC_API_KEY");
    expect(message).toContain("ANCHOR_ANTHROPIC_KEY_ENV_VAR");
  });
});
