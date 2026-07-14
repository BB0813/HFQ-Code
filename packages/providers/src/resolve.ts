import type { ModelProvider } from "./types.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createMockProvider } from "./mock.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";

export interface ProviderResolveInput {
  id: string;
  kind: "mock" | "openai_compatible" | "anthropic";
  baseURL?: string;
  apiKey?: string;
}

export function createProviderFromConfig(input: ProviderResolveInput): ModelProvider {
  if (input.kind === "mock" || input.id === "mock") {
    return createMockProvider();
  }

  if (input.kind === "openai_compatible") {
    if (!input.baseURL?.trim()) {
      throw new Error(`provider ${input.id}: baseURL is required`);
    }
    if (!input.apiKey?.trim()) {
      throw new Error(`provider ${input.id}: apiKey is required`);
    }
    return createOpenAICompatibleProvider({
      id: input.id,
      baseURL: input.baseURL,
      apiKey: input.apiKey,
    });
  }

  if (input.kind === "anthropic") {
    if (!input.apiKey?.trim()) {
      throw new Error(`provider ${input.id}: apiKey is required`);
    }
    return createAnthropicProvider({
      id: input.id,
      baseURL: input.baseURL,
      apiKey: input.apiKey,
    });
  }

  throw new Error(`unsupported provider kind: ${(input as ProviderResolveInput).kind}`);
}
