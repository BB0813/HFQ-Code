import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";

describe("createOpenAICompatibleProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends assistant tool_calls and tool results in OpenAI wire shape", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages: Array<Record<string, unknown>>;
        tools?: unknown[];
        tool_choice?: string;
      };
      expect(body.tools?.length).toBe(1);
      expect(body.tool_choice).toBe("auto");
      const assistant = body.messages.find((m) => m.role === "assistant");
      expect(assistant?.tool_calls).toEqual([
        {
          id: "c1",
          type: "function",
          function: { name: "list_dir", arguments: "{\"path\":\".\"}" },
        },
      ]);
      expect(assistant?.content).toBeNull();
      const tool = body.messages.find((m) => m.role === "tool");
      expect(tool?.tool_call_id).toBe("c1");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "done", tool_calls: [] } }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const p = createOpenAICompatibleProvider({
      id: "oc",
      baseURL: "http://example.test/v1",
      apiKey: "sk-test",
    });

    const result = await p.chat({
      model: "grok-4.5",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "list" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: { name: "list_dir", arguments: "{\"path\":\".\"}" },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "c1",
          name: "list_dir",
          content: "{\"entries\":[]}",
        },
      ],
      tools: [
        {
          name: "list_dir",
          description: "list",
          parameters: { type: "object", properties: { path: { type: "string" } } },
        },
      ],
    });

    expect(result.message).toBe("done");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://example.test/v1/chat/completions");
  });

  it("parses tool_calls from provider response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "call_x",
                      type: "function",
                      function: { name: "read_file", arguments: "{\"path\":\"a.md\"}" },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const p = createOpenAICompatibleProvider({
      id: "oc",
      baseURL: "http://example.test/v1/",
      apiKey: "sk-test",
    });
    const result = await p.chat({
      model: "m",
      messages: [{ role: "user", content: "read a.md" }],
      tools: [
        {
          name: "read_file",
          description: "read",
          parameters: { type: "object", properties: {} },
        },
      ],
    });
    expect(result.toolCalls).toEqual([
      { id: "call_x", name: "read_file", arguments: { path: "a.md" } },
    ]);
    expect(result.message).toBe("");
  });

  it("streams SSE deltas via onDelta", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })),
    );
    const chunks: string[] = [];
    const p = createOpenAICompatibleProvider({
      id: "oc",
      baseURL: "http://example.test/v1",
      apiKey: "sk-test",
    });
    const result = await p.chat({
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      onDelta: (t) => {
        chunks.push(t);
      },
    });
    expect(chunks.join("")).toBe("Hello");
    expect(result.message).toBe("Hello");
  });

  it("streams reasoning_content via onThinkingDelta", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"step1 "}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":"step2"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })),
    );
    const think: string[] = [];
    const body: string[] = [];
    const p = createOpenAICompatibleProvider({
      id: "oc",
      baseURL: "http://example.test/v1",
      apiKey: "sk-test",
    });
    const result = await p.chat({
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      onThinkingDelta: (t) => {
        think.push(t);
      },
      onDelta: (t) => {
        body.push(t);
      },
    });
    expect(think.join("")).toBe("step1 step2");
    expect(body.join("")).toBe("answer");
    expect(result.reasoning).toBe("step1 step2");
    expect(result.message).toBe("answer");
  });
});
