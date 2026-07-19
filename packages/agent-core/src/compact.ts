import type { ChatMessage, ModelProvider } from "@hfq/providers";

export interface CompactOptions {
  /** Soft cap on total characters across all messages (approx). Default 48_000. */
  maxChars?: number;
  /** Always keep the last N messages intact. Default 12. */
  keepRecent?: number;
  /** Max chars for a single tool/assistant body after clip. Default 2_000. */
  maxMessageChars?: number;
}

export type CompactMode = "none" | "heuristic" | "llm";

export interface CompactResult {
  messages: ChatMessage[];
  compacted: boolean;
  beforeChars: number;
  afterChars: number;
  /** How compaction was applied (1.1.6+). */
  mode: CompactMode;
}

function estimateChars(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) {
    n += (m.content?.length ?? 0) + (m.name?.length ?? 0) + 16;
    if (m.tool_calls?.length) {
      for (const tc of m.tool_calls) {
        n += tc.function?.name?.length ?? 0;
        n += tc.function?.arguments?.length ?? 0;
        n += 24;
      }
    }
  }
  return n;
}

function clipBody(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [compacted ${text.length - max} chars]`;
}

function splitForCompact(
  messages: ChatMessage[],
  keepRecent: number,
): { system: ChatMessage[]; head: ChatMessage[]; tail: ChatMessage[] } | null {
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  if (rest.length <= keepRecent) return null;
  const head = rest.slice(0, Math.max(0, rest.length - keepRecent));
  const tail = rest.slice(-keepRecent);
  if (!head.length) return null;
  return { system, head, tail };
}

function clipHeadMessages(head: ChatMessage[], maxMessageChars: number): ChatMessage[] {
  return head.map((m) => {
    if (m.role === "tool") {
      return {
        ...m,
        content: clipBody(m.content || "", Math.min(maxMessageChars, 800)),
      };
    }
    if (m.role === "assistant") {
      return {
        ...m,
        content: clipBody(m.content || "", maxMessageChars),
        tool_calls: undefined,
      };
    }
    if (m.role === "user") {
      return {
        ...m,
        content: clipBody(m.content || "", maxMessageChars * 2),
      };
    }
    return m;
  });
}

function hardClipIfNeeded(
  working: ChatMessage[],
  maxChars: number,
): { messages: ChatMessage[]; afterChars: number } {
  let afterChars = estimateChars(working);
  if (afterChars <= maxChars) return { messages: working, afterChars };
  const next = working.map((m, idx) => {
    if (m.role === "system" && idx === 0) return m;
    const cap = m.role === "user" ? 1_200 : 600;
    return { ...m, content: clipBody(m.content || "", cap), tool_calls: m.tool_calls };
  });
  return { messages: next, afterChars: estimateChars(next) };
}

/** Format older turns into a short transcript for the compression model. */
export function formatHeadTranscript(head: ChatMessage[], maxChars = 12_000): string {
  const lines: string[] = [];
  let used = 0;
  for (let i = 0; i < head.length; i++) {
    const m = head[i]!;
    const role = m.role;
    let body = (m.content || "").replace(/\s+/g, " ").trim();
    if (m.tool_calls?.length) {
      const names = m.tool_calls.map((t) => t.function?.name || "tool").join(",");
      body = `${body}${body ? " " : ""}[tool_calls: ${names}]`;
    }
    if (m.name) body = `(${m.name}) ${body}`;
    const line = `${i + 1}. ${role}: ${body.slice(0, 600)}`;
    if (used + line.length + 1 > maxChars) {
      lines.push(`… [${head.length - i} more turns omitted]`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

/**
 * Shrink long chat histories before a model round.
 * Keeps system messages and the most recent turns; clips older tool/assistant bodies.
 * Pure / side-effect free (heuristic only).
 */
export function compactChatMessages(
  messages: ChatMessage[],
  opts: CompactOptions = {},
): CompactResult {
  const maxChars = opts.maxChars ?? 48_000;
  const keepRecent = opts.keepRecent ?? 12;
  const maxMessageChars = opts.maxMessageChars ?? 2_000;

  const beforeChars = estimateChars(messages);
  if (beforeChars <= maxChars || messages.length <= keepRecent + 1) {
    return { messages, compacted: false, beforeChars, afterChars: beforeChars, mode: "none" };
  }

  const parts = splitForCompact(messages, keepRecent);
  if (!parts) {
    return { messages, compacted: false, beforeChars, afterChars: beforeChars, mode: "none" };
  }

  const { system, head, tail } = parts;
  const summarizedHead = clipHeadMessages(head, maxMessageChars);

  let working: ChatMessage[] = [...system, ...summarizedHead, ...tail];
  let afterChars = estimateChars(working);
  let usedNote = false;

  if (afterChars > maxChars && summarizedHead.length > 4) {
    const note: ChatMessage = {
      role: "system",
      content: [
        "[context compacted]",
        `Older turns (${summarizedHead.length}) were summarized to fit the context budget.`,
        `Approx chars before: ${beforeChars}.`,
        "Continue from the recent messages; re-read files if details are missing.",
      ].join(" "),
    };
    const samples = summarizedHead.slice(-3);
    working = [...system, note, ...samples, ...tail];
    afterChars = estimateChars(working);
    usedNote = true;
  }

  const hard = hardClipIfNeeded(working, maxChars);
  working = hard.messages;
  afterChars = hard.afterChars;

  return {
    messages: working,
    compacted: afterChars < beforeChars || usedNote,
    beforeChars,
    afterChars,
    mode: afterChars < beforeChars || usedNote ? "heuristic" : "none",
  };
}

export interface LlmCompactOptions extends CompactOptions {
  /** Optional cheap model for summarizing dropped head turns. */
  compression?: {
    provider: ModelProvider;
    model: string;
    /** Soft timeout for the summarizer call (ms). Default 12_000. */
    timeoutMs?: number;
    /** Max chars of LLM summary note. Default 1_800. */
    maxSummaryChars?: number;
  };
}

/**
 * Compact with optional LLM summary of the dropped head.
 * On any compression failure, falls back to pure heuristic (never throws).
 */
export async function compactChatMessagesMaybeLlm(
  messages: ChatMessage[],
  opts: LlmCompactOptions = {},
): Promise<CompactResult> {
  const maxChars = opts.maxChars ?? 48_000;
  const keepRecent = opts.keepRecent ?? 12;
  const maxMessageChars = opts.maxMessageChars ?? 2_000;
  const beforeChars = estimateChars(messages);

  if (beforeChars <= maxChars || messages.length <= keepRecent + 1) {
    return { messages, compacted: false, beforeChars, afterChars: beforeChars, mode: "none" };
  }

  const role = opts.compression;
  if (!role?.provider || !String(role.model || "").trim()) {
    return compactChatMessages(messages, opts);
  }

  const parts = splitForCompact(messages, keepRecent);
  if (!parts) {
    return compactChatMessages(messages, opts);
  }

  const { system, head, tail } = parts;
  const maxSummaryChars = Math.min(Math.max(role.maxSummaryChars ?? 1_800, 400), 4_000);
  const timeoutMs = Math.min(Math.max(role.timeoutMs ?? 12_000, 2_000), 60_000);
  const transcript = formatHeadTranscript(head, 12_000);

  try {
    const summary = await Promise.race([
      (async () => {
        const res = await role.provider.chat({
          model: role.model,
          messages: [
            {
              role: "system",
              content: [
                "You compress older coding-agent chat turns into a dense continuity note.",
                "Keep: goals, decisions, file paths, commands run, errors, open TODOs.",
                "Drop: chit-chat, repeated tool dumps, full file contents.",
                `Max ${maxSummaryChars} characters. Plain text only. No markdown fences.`,
              ].join(" "),
            },
            {
              role: "user",
              content: `Summarize these older turns for context continuity:\n\n${transcript}`,
            },
          ],
          tools: [],
        });
        return String(res?.message ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, maxSummaryChars);
      })(),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("compression_timeout")), timeoutMs);
      }),
    ]);

    if (!summary) {
      return compactChatMessages(messages, opts);
    }

    const note: ChatMessage = {
      role: "system",
      content: [
        "[context compacted · llm]",
        `Older turns (${head.length}) summarized by compression model.`,
        `Approx chars before: ${beforeChars}.`,
        "Summary:",
        summary,
        "Continue from recent messages; re-read files if details are missing.",
      ].join(" "),
    };

    // Keep a couple of clipped head samples as anchors when still room.
    const samples = clipHeadMessages(head.slice(-2), maxMessageChars);
    let working: ChatMessage[] = [...system, note, ...samples, ...tail];
    const hard = hardClipIfNeeded(working, maxChars);
    working = hard.messages;
    const afterChars = hard.afterChars;

    return {
      messages: working,
      compacted: true,
      beforeChars,
      afterChars,
      mode: "llm",
    };
  } catch {
    return compactChatMessages(messages, opts);
  }
}
