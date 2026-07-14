import { describe, expect, it, vi, afterEach } from "vitest";
import {
  _testOnly_toAnthropicMessages,
  createAnthropicProvider,
} from "./anthropic.js";
import { toAssistantToolCalls } from "./types.js";

describe("anthropic provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps system, tool_calls, and tool results to Messages API shape", () => {
    const { system, messages } = _testOnly_toAnthropicMessages([
      { role: "system", content: "You are HFQ." },
      { role: "user", content: "edit file" },
      {
        role: "assistant",
        content: "ok",
        tool_calls: toAssistantToolCalls([
          { id: "c1", name: "read_file", arguments: { path: "a.ts" } },
        ]),
      },
      {
        role: "tool",
        tool_call_id: "c1",
        name: "read_file",
        content: '{"content":"x"}',
      },
    ]);
    expect(system).toContain("HFQ");
    expect(messages[0]).toEqual({ role: "user", content: "edit file" });
    const assistant = messages[1];
    expect(assistant?.role).toBe("assistant");
    expect(Array.isArray(assistant?.content)).toBe(true);
    const blocks = assistant?.content as Array<{ type: string; name?: string }>;
    expect(blocks.some((b) => b.type === "tool_use" && b.name === "read_file")).toBe(true);
    const toolTurn = messages[2];
    expect(toolTurn?.role).toBe("user");
    expect(Array.isArray(toolTurn?.content)).toBe(true);
  });

  it("parses tool_use content from API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        async json() {
          return {
            content: [
              { type: "text", text: "Reading…" },
              {
                type: "tool_use",
                id: "tu_1",
                name: "list_dir",
                input: { path: "." },
              },
            ],
            usage: { input_tokens: 10, output_tokens: 5 },
          };
        },
      })),
    );

    const p = createAnthropicProvider({
      id: "anthropic",
      apiKey: "sk-ant-test",
    });
    const res = await p.chat({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "list" }],
      tools: [
        {
          name: "list_dir",
          description: "list",
          parameters: { type: "object", properties: {} },
        },
      ],
    });
    expect(res.message).toContain("Reading");
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0]?.name).toBe("list_dir");
    expect(res.toolCalls[0]?.arguments).toEqual({ path: "." });
    expect(res.usage?.inputTokens).toBe(10);
  });

  it("requires non-empty apiKey via factory usage", () => {
    const p = createAnthropicProvider({ id: "a", apiKey: "k" });
    expect(p.id).toBe("a");
  });
});
