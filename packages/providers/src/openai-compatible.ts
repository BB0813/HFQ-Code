import type {
  AssistantToolCall,
  ChatMessage,
  ChatRequest,
  ChatResult,
  ModelProvider,
  ToolCall,
} from "./types.js";

export interface OpenAICompatibleConfig {
  id: string;
  baseURL: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
}

function toWireMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === "assistant") {
      const out: Record<string, unknown> = {
        role: "assistant",
        content: m.content && m.content.length > 0 ? m.content : m.tool_calls?.length ? null : "",
      };
      if (m.tool_calls?.length) {
        out.tool_calls = m.tool_calls;
      }
      return out;
    }
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content ?? "",
        tool_call_id: m.tool_call_id,
        ...(m.name ? { name: m.name } : {}),
      };
    }
    return {
      role: m.role,
      content: m.content ?? "",
      ...(m.name ? { name: m.name } : {}),
    };
  });
}

function buildRequestBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: toWireMessages(req.messages),
    temperature: req.temperature ?? 0.2,
    stream,
  };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters ?? { type: "object", properties: {} },
      },
    }));
    body.tool_choice = "auto";
  }
  return body;
}

function parseToolCalls(
  raw: Array<{
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
    index?: number;
  }>,
): ToolCall[] {
  return raw.map((tc, i) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function?.arguments || "{}") as Record<string, unknown>;
    } catch {
      args = { raw: tc.function?.arguments };
    }
    return {
      id: tc.id || `call_${i}`,
      name: tc.function?.name || "unknown",
      arguments: args,
    };
  });
}

/** OpenAI-compatible + DeepSeek/Qwen/etc. reasoning field variants. */
function extractReasoningText(obj: {
  reasoning_content?: string | null;
  reasoning?: string | null;
} | null | undefined): string {
  if (!obj) return "";
  if (typeof obj.reasoning_content === "string" && obj.reasoning_content) {
    return obj.reasoning_content;
  }
  if (typeof obj.reasoning === "string" && obj.reasoning) {
    return obj.reasoning;
  }
  return "";
}

function deltaReasoningChunk(delta: {
  reasoning_content?: string | null;
  reasoning?: string | null;
} | null | undefined): string {
  return extractReasoningText(delta);
}

async function chatNonStream(
  cfg: OpenAICompatibleConfig,
  req: ChatRequest,
  url: string,
): Promise<ChatResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
      ...cfg.defaultHeaders,
    },
    body: JSON.stringify(buildRequestBody(req, false)),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`provider ${cfg.id} ${res.status}: ${errText.slice(0, 800)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: AssistantToolCall[];
        reasoning_content?: string | null;
        reasoning?: string | null;
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const msg = data.choices?.[0]?.message;
  const toolCalls = parseToolCalls(msg?.tool_calls ?? []);
  const message = typeof msg?.content === "string" ? msg.content : msg?.content ?? "";
  const reasoning = extractReasoningText(msg);
  if (reasoning && req.onThinkingDelta) await req.onThinkingDelta(reasoning);
  if (message && req.onDelta) await req.onDelta(message);

  return {
    message,
    toolCalls,
    reasoning: reasoning || undefined,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

async function chatStream(
  cfg: OpenAICompatibleConfig,
  req: ChatRequest,
  url: string,
): Promise<ChatResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
      accept: "text/event-stream",
      ...cfg.defaultHeaders,
    },
    body: JSON.stringify(buildRequestBody(req, true)),
  });

  if (!res.ok) {
    // Some gateways reject stream; fall back once without stream.
    if (res.status === 400 || res.status === 404 || res.status === 415) {
      return chatNonStream(cfg, req, url);
    }
    const errText = await res.text();
    throw new Error(`provider ${cfg.id} ${res.status}: ${errText.slice(0, 800)}`);
  }

  if (!res.body) {
    return chatNonStream(cfg, req, url);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let reasoning = "";
  const toolAcc = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  const flushLine = async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let json: {
      choices?: Array<{
        delta?: {
          content?: string | null;
          reasoning_content?: string | null;
          reasoning?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        message?: {
          content?: string | null;
          tool_calls?: AssistantToolCall[];
          reasoning_content?: string | null;
          reasoning?: string | null;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      json = JSON.parse(data) as typeof json;
    } catch {
      return;
    }

    if (json.usage) {
      usage = {
        inputTokens: json.usage.prompt_tokens ?? 0,
        outputTokens: json.usage.completion_tokens ?? 0,
      };
    }

    const choice = json.choices?.[0];
    const delta = choice?.delta;
    const thinkChunk = deltaReasoningChunk(delta);
    if (thinkChunk) {
      reasoning += thinkChunk;
      await req.onThinkingDelta?.(thinkChunk);
    }
    if (delta?.content) {
      content += delta.content;
      await req.onDelta?.(delta.content);
    }
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const cur = toolAcc.get(idx) ?? { id: "", name: "", arguments: "" };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.arguments += tc.function.arguments;
        toolAcc.set(idx, cur);
      }
    }
    // Non-delta full message chunks (rare)
    if (choice?.message) {
      const fullReason = extractReasoningText(choice.message);
      if (fullReason && !reasoning) {
        reasoning = fullReason;
        await req.onThinkingDelta?.(fullReason);
      }
      if (choice.message.content && !content) {
        content = String(choice.message.content);
        await req.onDelta?.(content);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      await flushLine(line);
    }
  }
  if (buffer.trim()) await flushLine(buffer);

  const toolCalls: ToolCall[] = [...toolAcc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([i, tc]) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = { raw: tc.arguments };
      }
      return {
        id: tc.id || `call_${i}`,
        name: tc.name || "unknown",
        arguments: args,
      };
    });

  return {
    message: content,
    toolCalls,
    reasoning: reasoning || undefined,
    usage,
  };
}

export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): ModelProvider {
  return {
    id: cfg.id,
    async chat(req: ChatRequest): Promise<ChatResult> {
      const url = `${cfg.baseURL.replace(/\/$/, "")}/chat/completions`;
      if (req.onDelta) {
        try {
          return await chatStream(cfg, req, url);
        } catch (err) {
          // Network/stream parse failures: try non-stream once.
          const msg = err instanceof Error ? err.message : String(err);
          if (/provider .+ \d+:/.test(msg) && !/400|404|415/.test(msg)) throw err;
          return chatNonStream(cfg, req, url);
        }
      }
      return chatNonStream(cfg, req, url);
    },
  };
}
