import { describe, expect, it, vi } from "vitest";
import { createProviderFromConfig } from "./resolve.js";

describe("createProviderFromConfig", () => {
  it("returns mock provider", async () => {
    const p = createProviderFromConfig({ id: "mock", kind: "mock" });
    expect(p.id).toBe("mock");
    const res = await p.chat({
      model: "mock-hfq",
      messages: [{ role: "user", content: "help" }],
    });
    expect(res.message.length).toBeGreaterThan(0);
  });

  it("requires apiKey for openai_compatible", () => {
    expect(() =>
      createProviderFromConfig({
        id: "x",
        kind: "openai_compatible",
        baseURL: "https://api.openai.com/v1",
      }),
    ).toThrow(/apiKey/);
  });

  it("requires apiKey for anthropic", () => {
    expect(() =>
      createProviderFromConfig({
        id: "anthropic",
        kind: "anthropic",
      }),
    ).toThrow(/apiKey/);
  });

  it("creates anthropic provider", () => {
    const p = createProviderFromConfig({
      id: "anthropic",
      kind: "anthropic",
      apiKey: "sk-ant-x",
    });
    expect(p.id).toBe("anthropic");
  });

  it("normalizes OpenCode Zen baseURL missing /v1", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toBe("https://opencode.ai/zen/v1/chat/completions");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const p = createProviderFromConfig({
        id: "opencode",
        kind: "openai_compatible",
        baseURL: "https://opencode.ai/zen",
        apiKey: "sk-test",
      });
      await p.chat({
        model: "mimo-v2.5-free",
        messages: [{ role: "user", content: "hi" }],
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
