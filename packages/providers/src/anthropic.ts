import type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  ModelProvider,
  ToolCall,
} from "./types.js";

export interface AnthropicConfig {
  id: string;
  /** Default https://api.anthropic.com */
  baseURL?: string;
  apiKey: string;
  apiVersion?: string;
  defaultHeaders?: Record<string, string>;
}

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

function splitSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      if (m.content?.trim()) systemParts.push(m.content);
    } else {
      rest.push(m);
    }
  }
  return { system: systemParts.join("\n\n"), rest };
}

/**
 * Map HFQ chat history to Anthropic Messages API messages.
 * Consecutive tool results are folded into a single user turn.
 */
function toAnthropicMessages(messages: ChatMessage[]): Array<{
  role: "user" | "assistant";
  content: string | AnthropicContent[];
}> {
  const out: Array<{ role: "user" | "assistant"; content: string | AnthropicContent[] }> = [];

  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content ?? "" });
      continue;
    }
    if (m.role === "assistant") {
      const blocks: AnthropicContent[] = [];
      if (m.content?.trim()) {
        blocks.push({ type: "text", text: m.content });
      }
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            input = { raw: tc.function.arguments };
          }
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
      }
      out.push({
        role: "assistant",
        content: blocks.length ? blocks : [{ type: "text", text: m.content ?? "" }],
      });
      continue;
    }
    if (m.role === "tool") {
      const block: AnthropicContent = {
        type: "tool_result",
        tool_use_id: m.tool_call_id || "",
        content: m.content ?? "",
      };
      const last = out[out.length - 1];
      if (last?.role === "user" && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }
  return out;
}

function parseToolCallsFromContent(content: unknown): { text: string; toolCalls: ToolCall[] } {
  let text = "";
  const toolCalls: ToolCall[] = [];
  if (typeof content === "string") {
    return { text: content, toolCalls };
  }
  if (!Array.isArray(content)) return { text, toolCalls };
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as {
      type?: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    };
    if (b.type === "text" && typeof b.text === "string") {
      text += b.text;
    } else if (b.type === "tool_use") {
      toolCalls.push({
        id: b.id || `tool_${toolCalls.length}`,
        name: b.name || "unknown",
        arguments: b.input && typeof b.input === "object" ? b.input : {},
      });
    }
  }
  return { text, toolCalls };
}

export function createAnthropicProvider(cfg: AnthropicConfig): ModelProvider {
  const base = (cfg.baseURL || "https://api.anthropic.com").replace(/\/+$/, "");
  const url = `${base}/v1/messages`;
  const version = cfg.apiVersion || "2023-06-01";

  return {
    id: cfg.id,
    async chat(req: ChatRequest): Promise<ChatResult> {
      const { system, rest } = splitSystem(req.messages);
      const body: Record<string, unknown> = {
        model: req.model,
        max_tokens: 4096,
        temperature: req.temperature ?? 0.2,
        messages: toAnthropicMessages(rest),
      };
      if (system) body.system = system;
      if (req.tools?.length) {
        body.tools = req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters ?? { type: "object", properties: {} },
        }));
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": version,
          ...cfg.defaultHeaders,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`provider ${cfg.id} ${res.status}: ${errText.slice(0, 800)}`);
      }

      const data = (await res.json()) as {
        content?: unknown;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const parsed = parseToolCallsFromContent(data.content);
      if (parsed.text && req.onDelta) await req.onDelta(parsed.text);

      return {
        message: parsed.text,
        toolCalls: parsed.toolCalls,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}

/** Test helper: export conversion without network. */
export function _testOnly_toAnthropicMessages(messages: ChatMessage[]) {
  const { system, rest } = splitSystem(messages);
  return { system, messages: toAnthropicMessages(rest) };
}
