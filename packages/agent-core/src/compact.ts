import type { ChatMessage } from "@hfq/providers";

export interface CompactOptions {
  /** Soft cap on total characters across all messages (approx). Default 48_000. */
  maxChars?: number;
  /** Always keep the last N messages intact. Default 12. */
  keepRecent?: number;
  /** Max chars for a single tool/assistant body after clip. Default 2_000. */
  maxMessageChars?: number;
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

/**
 * Shrink long chat histories before a model round.
 * Keeps system messages and the most recent turns; clips older tool/assistant bodies.
 * Pure / side-effect free.
 */
export function compactChatMessages(
  messages: ChatMessage[],
  opts: CompactOptions = {},
): { messages: ChatMessage[]; compacted: boolean; beforeChars: number; afterChars: number } {
  const maxChars = opts.maxChars ?? 48_000;
  const keepRecent = opts.keepRecent ?? 12;
  const maxMessageChars = opts.maxMessageChars ?? 2_000;

  const beforeChars = estimateChars(messages);
  if (beforeChars <= maxChars || messages.length <= keepRecent + 1) {
    return { messages, compacted: false, beforeChars, afterChars: beforeChars };
  }

  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  if (rest.length <= keepRecent) {
    return { messages, compacted: false, beforeChars, afterChars: beforeChars };
  }

  const head = rest.slice(0, Math.max(0, rest.length - keepRecent));
  const tail = rest.slice(-keepRecent);

  const summarizedHead: ChatMessage[] = head.map((m) => {
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
        // Drop bulky tool_calls from older assistant turns to save tokens.
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

  // Replace a long head with a single system-style summary + clipped samples when still huge.
  let working: ChatMessage[] = [...system, ...summarizedHead, ...tail];
  let afterChars = estimateChars(working);

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
    // Keep only a few clipped head samples + note + tail.
    const samples = summarizedHead.slice(-3);
    working = [...system, note, ...samples, ...tail];
    afterChars = estimateChars(working);
  }

  // Final hard clip if still over.
  if (afterChars > maxChars) {
    working = working.map((m, idx) => {
      if (m.role === "system" && idx === 0) return m;
      const cap = m.role === "user" ? 1_200 : 600;
      return { ...m, content: clipBody(m.content || "", cap), tool_calls: m.tool_calls };
    });
    afterChars = estimateChars(working);
  }

  return {
    messages: working,
    compacted: afterChars < beforeChars,
    beforeChars,
    afterChars,
  };
}
