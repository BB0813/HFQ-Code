import { describe, expect, it } from "vitest";
import {
  formatProviderHttpError,
  normalizeOpenAICompatibleBaseURL,
} from "./openai-base-url.js";

describe("normalizeOpenAICompatibleBaseURL", () => {
  it("appends /v1 for OpenCode Zen portal path", () => {
    expect(normalizeOpenAICompatibleBaseURL("https://opencode.ai/zen")).toBe(
      "https://opencode.ai/zen/v1",
    );
    expect(normalizeOpenAICompatibleBaseURL("https://opencode.ai/zen/")).toBe(
      "https://opencode.ai/zen/v1",
    );
  });

  it("keeps OpenCode Zen when already /v1", () => {
    expect(normalizeOpenAICompatibleBaseURL("https://opencode.ai/zen/v1")).toBe(
      "https://opencode.ai/zen/v1",
    );
    expect(normalizeOpenAICompatibleBaseURL("https://opencode.ai/zen/v1/")).toBe(
      "https://opencode.ai/zen/v1",
    );
  });

  it("normalizes common vendor roots", () => {
    expect(normalizeOpenAICompatibleBaseURL("https://api.openai.com")).toBe(
      "https://api.openai.com/v1",
    );
    expect(normalizeOpenAICompatibleBaseURL("https://api.deepseek.com")).toBe(
      "https://api.deepseek.com/v1",
    );
    expect(normalizeOpenAICompatibleBaseURL("https://api.groq.com/openai")).toBe(
      "https://api.groq.com/openai/v1",
    );
    expect(normalizeOpenAICompatibleBaseURL("https://api.moonshot.cn")).toBe(
      "https://api.moonshot.cn/v1",
    );
    expect(
      normalizeOpenAICompatibleBaseURL(
        "https://dashscope.aliyuncs.com/compatible-mode",
      ),
    ).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
  });

  it("does not invent /v1 for arbitrary reverse proxies", () => {
    expect(normalizeOpenAICompatibleBaseURL("https://grok.clove.dpdns.org/v1")).toBe(
      "https://grok.clove.dpdns.org/v1",
    );
    expect(normalizeOpenAICompatibleBaseURL("https://mid.example.com/proxy")).toBe(
      "https://mid.example.com/proxy",
    );
  });

  it("strips trailing slashes", () => {
    expect(normalizeOpenAICompatibleBaseURL("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1",
    );
  });
});

describe("formatProviderHttpError", () => {
  it("humanizes HTML 404 for OpenCode-like mistakes", () => {
    const msg = formatProviderHttpError({
      providerId: "opencode",
      status: 404,
      body: "<!DOCTYPE html><html><title>Not Found</title></html>",
      requestUrl: "https://opencode.ai/zen/chat/completions",
    });
    expect(msg).toMatch(/HTML/);
    expect(msg).toMatch(/opencode\.ai\/zen\/v1/);
    expect(msg).not.toMatch(/<!DOCTYPE/);
  });

  it("surfaces auth_unavailable on 5xx", () => {
    const msg = formatProviderHttpError({
      providerId: "grok-test",
      status: 503,
      body: JSON.stringify({ error: { message: "auth_unavailable: no auth available" } }),
      requestUrl: "https://mid.example/v1/chat/completions",
    });
    expect(msg).toMatch(/上游未配置该模型鉴权/);
    expect(msg).toMatch(/auth_unavailable/);
  });

  it("hints on 401/403", () => {
    const msg = formatProviderHttpError({
      providerId: "x",
      status: 403,
      body: "Access denied",
    });
    expect(msg).toMatch(/鉴权失败/);
  });
});
