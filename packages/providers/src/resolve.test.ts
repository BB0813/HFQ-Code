import { describe, expect, it } from "vitest";
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
});
