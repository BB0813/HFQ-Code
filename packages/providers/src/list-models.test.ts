import { afterEach, describe, expect, it, vi } from "vitest";
import { listProviderModels } from "./list-models.js";

describe("listProviderModels", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns mock models from config", async () => {
    const res = await listProviderModels({
      id: "mock",
      kind: "mock",
      models: ["mock-hfq"],
    });
    expect(res.ok).toBe(true);
    expect(res.source).toBe("mock");
    expect(res.models).toEqual(["mock-hfq"]);
  });

  it("lists openai_compatible remote models", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toBe("https://api.example.com/v1/models");
      return new Response(
        JSON.stringify({ data: [{ id: "a" }, { id: "b" }, { id: "a" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const res = await listProviderModels({
      id: "oc",
      kind: "openai_compatible",
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      models: ["local-only"],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(res.source).toBe("remote");
    expect(res.models).toEqual(["a", "b"]);
    expect(res.rawCount).toBe(2);
  });

  it("soft-falls back to config on remote 401", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("unauthorized", { status: 401 });
    });
    const res = await listProviderModels({
      id: "oc",
      kind: "openai_compatible",
      baseURL: "https://api.example.com/v1",
      apiKey: "bad",
      models: ["cfg-model"],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(res.source).toBe("config");
    expect(res.models).toEqual(["cfg-model"]);
    expect(res.error || res.warning).toMatch(/401|failed/i);
  });

  it("normalizes OpenCode zen path before /models", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toBe("https://opencode.ai/zen/v1/models");
      return new Response(JSON.stringify({ data: [{ id: "mimo-v2.5-free" }] }), {
        status: 200,
      });
    });
    const res = await listProviderModels({
      id: "opencode",
      kind: "openai_compatible",
      baseURL: "https://opencode.ai/zen",
      apiKey: "sk",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(res.models).toContain("mimo-v2.5-free");
  });

  it("marks anthropic as unsupported remote list", async () => {
    const res = await listProviderModels({
      id: "anthropic",
      kind: "anthropic",
      baseURL: "https://api.anthropic.com",
      models: ["claude-sonnet-4-20250514"],
    });
    expect(res.source).toBe("unsupported");
    expect(res.models).toEqual(["claude-sonnet-4-20250514"]);
    expect(res.error).toMatch(/not supported/i);
  });
});
