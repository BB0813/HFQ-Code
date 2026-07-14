import { describe, expect, it } from "vitest";
import { compactChatMessages } from "../src/compact.js";
import type { ChatMessage } from "@hfq/providers";

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

describe("compactChatMessages", () => {
  it("returns unchanged when under budget", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ];
    const res = compactChatMessages(messages, { maxChars: 10_000 });
    expect(res.compacted).toBe(false);
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
    expect(res.afterChars).toBeLessThan(res.beforeChars);
    expect(res.messages[0]?.role).toBe("system");
    // Last user message still present in some form.
    const joined = res.messages.map((m) => m.content || "").join("\n");
    expect(joined).toMatch(/user turn 29|assistant turn 29|tool/);
  });
});
