import { describe, expect, it } from "vitest";
import {
  compactChatMessages,
  compactChatMessagesMaybeLlm,
  formatHeadTranscript,
} from "../src/compact.js";
import type { ChatMessage, ModelProvider } from "@hfq/providers";

function bigMessages(n: number): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "system", content: "You are HFQ Code." }];
  for (let i = 0; i < n; i++) {
    out.push({ role: "user", content: `user turn ${i} ` + "x".repeat(400) });
    out.push({
      role: "assistant",
      content: `assistant turn ${i} ` + "y".repeat(400),
    });
    out.push({
      role: "tool",
      name: "read_file",
      tool_call_id: `t${i}`,
      content: JSON.stringify({ content: "z".repeat(800) }),
    });
  }
  return out;
}

function mockCompressionProvider(reply: string, onCall?: () => void): ModelProvider {
  return {
    id: "mock-compress",
    async chat() {
      onCall?.();
      return {
        message: reply,
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  };
}

describe("compactChatMessages", () => {
  it("returns unchanged when under budget", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ];
    const res = compactChatMessages(messages, { maxChars: 10_000 });
    expect(res.compacted).toBe(false);
    expect(res.mode).toBe("none");
    expect(res.messages).toEqual(messages);
  });

  it("reduces large histories while keeping recent turns", () => {
    const messages = bigMessages(30);
    const res = compactChatMessages(messages, {
      maxChars: 8_000,
      keepRecent: 8,
      maxMessageChars: 200,
    });
    expect(res.compacted).toBe(true);
    expect(res.mode).toBe("heuristic");
    expect(res.afterChars).toBeLessThan(res.beforeChars);
    expect(res.messages[0]?.role).toBe("system");
    const joined = res.messages.map((m) => m.content || "").join("\n");
    expect(joined).toMatch(/user turn 29|assistant turn 29|tool/);
  });
});

describe("compactChatMessagesMaybeLlm", () => {
  it("matches heuristic when no compression role", async () => {
    const messages = bigMessages(30);
    const heuristic = compactChatMessages(messages, {
      maxChars: 8_000,
      keepRecent: 8,
      maxMessageChars: 200,
    });
    const llm = await compactChatMessagesMaybeLlm(messages, {
      maxChars: 8_000,
      keepRecent: 8,
      maxMessageChars: 200,
    });
    expect(llm.mode).toBe(heuristic.mode);
    expect(llm.compacted).toBe(heuristic.compacted);
  });

  it("inserts LLM summary note when compression provider succeeds", async () => {
    let calls = 0;
    const messages = bigMessages(30);
    const res = await compactChatMessagesMaybeLlm(messages, {
      maxChars: 8_000,
      keepRecent: 8,
      maxMessageChars: 200,
      compression: {
        provider: mockCompressionProvider(
          "Decided to use JWT; edited src/auth.ts; open: fix refresh token.",
          () => {
            calls += 1;
          },
        ),
        model: "cheap-summary",
      },
    });
    expect(calls).toBe(1);
    expect(res.compacted).toBe(true);
    expect(res.mode).toBe("llm");
    const joined = res.messages.map((m) => m.content || "").join("\n");
    expect(joined).toMatch(/\[context compacted · llm\]/i);
    expect(joined).toMatch(/JWT|auth\.ts|refresh/i);
  });

  it("falls back to heuristic when compression provider throws", async () => {
    const messages = bigMessages(30);
    const failing: ModelProvider = {
      id: "bad",
      async chat() {
        throw new Error("network down");
      },
    };
    const res = await compactChatMessagesMaybeLlm(messages, {
      maxChars: 8_000,
      keepRecent: 8,
      maxMessageChars: 200,
      compression: { provider: failing, model: "x" },
    });
    expect(res.compacted).toBe(true);
    expect(res.mode).toBe("heuristic");
    const joined = res.messages.map((m) => m.content || "").join("\n");
    expect(joined).not.toMatch(/\[context compacted · llm\]/i);
  });

  it("formatHeadTranscript includes roles", () => {
    const text = formatHeadTranscript([
      { role: "user", content: "hello world" },
      { role: "assistant", content: "hi there" },
    ]);
    expect(text).toMatch(/user:.*hello/);
    expect(text).toMatch(/assistant:.*hi/);
  });
});
