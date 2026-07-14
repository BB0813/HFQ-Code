/**
 * Client/server-shared parsing for HFQ slash commands in chat input.
 * Keep this pure (no I/O) so renderer and agent-core can share semantics.
 */

export type SlashKind = "goal" | "compact" | "plain";

export interface ParsedSlash {
  kind: SlashKind;
  /** User-facing text stored in transcript (includes slash when applicable). */
  displayText: string;
  /** Payload after the command token (goal body, compact note, or full plain text). */
  body: string;
  /** Raw trimmed input. */
  raw: string;
}

const GOAL_RE = /^\/goal(?:\s+([\s\S]*))?$/i;
const COMPACT_RE = /^\/compact(?:\s+([\s\S]*))?$/i;

export function parseUserSlash(text: string): ParsedSlash {
  const raw = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!raw) {
    return { kind: "plain", displayText: "", body: "", raw: "" };
  }

  const goal = raw.match(GOAL_RE);
  if (goal) {
    const body = String(goal[1] ?? "").trim();
    return {
      kind: "goal",
      displayText: body ? `/goal ${body}` : "/goal",
      body,
      raw,
    };
  }

  const compact = raw.match(COMPACT_RE);
  if (compact) {
    const body = String(compact[1] ?? "").trim();
    return {
      kind: "compact",
      displayText: body ? `/compact ${body}` : "/compact",
      body,
      raw,
    };
  }

  return { kind: "plain", displayText: raw, body: raw, raw };
}

/** Elevated budgets for long-running /goal turns. */
export const GOAL_MAX_ROUNDS = 32;
export const GOAL_MAX_TOOL_CALLS = 400;

export function formatGoalUserContent(goal: string): string {
  return [
    "[HFQ Goal mode — long-running task]",
    "You have an elevated tool budget this turn. Work iteratively until the goal is complete or blocked.",
    "Break the goal into steps, use tools as needed, verify results, and continue without stopping after a single search or plan.",
    "When finished, give a concise summary of what changed and what remains (if anything).",
    "",
    "Goal:",
    goal.trim(),
  ].join("\n");
}

export function formatCompactUserContent(note?: string): string {
  const extra = note?.trim() ? `\nUser note: ${note.trim()}` : "";
  return [
    "[HFQ Compact request]",
    "Summarize the conversation so far into the smallest set of durable facts, decisions, open questions, and file paths still needed.",
    "Prefer bullet points. Drop redundant tool chatter. Then wait for the next user instruction.",
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}
