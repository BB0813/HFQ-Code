import { describe, expect, it } from "vitest";
import { createMockProvider } from "./mock.js";

const tools = [
  {
    name: "list_dir",
    description: "list",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  },
  {
    name: "read_file",
    description: "read",
    parameters: { type: "object", properties: { path: { type: "string" } } },
  },
  {
    name: "write_file",
    description: "write",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
    },
  },
  {
    name: "shell",
    description: "shell",
    parameters: { type: "object", properties: { command: { type: "string" } } },
  },
  {
    name: "git_status",
    description: "git status",
    parameters: { type: "object", properties: { includeLog: { type: "boolean" } } },
  },
];

describe("createMockProvider", () => {
  const provider = createMockProvider();

  it("returns help text", async () => {
    const res = await provider.chat({
      model: "mock",
      messages: [{ role: "user", content: "help" }],
      tools,
    });
    expect(res.toolCalls).toHaveLength(0);
    expect(res.message).toMatch(/list|read|write|shell/i);
  });

  it("streams mock thinking when user asks for 思考过程", async () => {
    const think: string[] = [];
    const res = await provider.chat({
      model: "mock",
      messages: [{ role: "user", content: "show 思考过程 please" }],
      tools,
      onThinkingDelta: (t) => {
        think.push(t);
      },
    });
    expect(think.join("").length).toBeGreaterThan(10);
    expect(res.reasoning).toMatch(/mock thinking/i);
  });

  it("emits list_dir tool call", async () => {
    const res = await provider.chat({
      model: "mock",
      messages: [{ role: "user", content: "list" }],
      tools,
    });
    expect(res.toolCalls[0]?.name).toBe("list_dir");
  });

  it("emits read_file tool call with path", async () => {
    const res = await provider.chat({
      model: "mock",
      messages: [{ role: "user", content: "read README.md" }],
      tools,
    });
    expect(res.toolCalls[0]?.name).toBe("read_file");
    expect(res.toolCalls[0]?.arguments.path).toBe("README.md");
  });

  it("emits write_file tool call", async () => {
    const res = await provider.chat({
      model: "mock",
      messages: [{ role: "user", content: "write demo to hfq-demo.txt" }],
      tools,
    });
    expect(res.toolCalls[0]?.name).toBe("write_file");
    expect(res.toolCalls[0]?.arguments.path).toBe("hfq-demo.txt");
  });

  it("emits git_status tool call", async () => {
    const res = await provider.chat({
      model: "mock",
      messages: [{ role: "user", content: "git status" }],
      tools,
    });
    expect(res.toolCalls[0]?.name).toBe("git_status");
  });

  it("summarizes after tool result message", async () => {
    const res = await provider.chat({
      model: "mock",
      messages: [
        { role: "user", content: "list" },
        { role: "assistant", content: "listing" },
        {
          role: "tool",
          name: "list_dir",
          tool_call_id: "1",
          content: JSON.stringify({ entries: [] }),
        },
      ],
      tools,
    });
    expect(res.toolCalls).toHaveLength(0);
    expect(res.message).toMatch(/Tool finished/i);
  });
});
