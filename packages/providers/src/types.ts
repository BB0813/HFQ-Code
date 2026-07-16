export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** OpenAI-compatible wire shape for assistant tool_calls (stored on ChatMessage). */
export interface AssistantToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  /** Present on assistant messages that request tools. */
  tool_calls?: AssistantToolCall[];
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatResult {
  message: string;
  toolCalls: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
  /**
   * Model chain-of-thought / extended thinking for this round (when the API returns it).
   * Not re-injected into subsequent ChatMessage history by agent-core.
   */
  reasoning?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  /** When set, providers may stream text chunks via this callback (message.delta). */
  onDelta?: (text: string) => void | Promise<void>;
  /**
   * When set, providers may stream reasoning / thinking chunks (thinking.delta).
   * OpenAI-compatible: delta.reasoning_content | delta.reasoning
   * Anthropic: content_block type thinking
   */
  onThinkingDelta?: (text: string) => void | Promise<void>;
}

export interface ModelProvider {
  id: string;
  chat(req: ChatRequest): Promise<ChatResult>;
}

export function toAssistantToolCalls(calls: ToolCall[]): AssistantToolCall[] {
  return calls.map((c) => ({
    id: c.id,
    type: "function" as const,
    function: {
      name: c.name,
      arguments: JSON.stringify(c.arguments ?? {}),
    },
  }));
}
