import type { ChatMessage } from "@hfq/providers";
import type { SessionEvent, SessionInfo } from "@hfq/shared";

export interface UiMessage {
  role: string;
  text?: string;
  name?: string;
  detail?: unknown;
  /** Tool call id when role === "tool" (R2 card merge). */
  callId?: string;
  /** running | done for tool cards */
  phase?: "running" | "done";
  ok?: boolean;
  input?: unknown;
  output?: unknown;
  messageId?: string;
  streaming?: boolean;
  /** Model chain-of-thought when role === "thinking" (collapsed CoT UI). */
  thinking?: boolean;
}

export interface UiChange {
  path: string;
  kind?: "create" | "modify" | "delete";
  before?: string;
  after?: string;
  at?: string;
  accepted?: boolean;
  rejected?: boolean;
}

export interface UiTerminalLine {
  callId: string;
  command: string;
  stdout?: string;
  stderr?: string;
  code?: number | null;
  ok: boolean;
  at: string;
}

export interface UiTask {
  taskId: string;
  title: string;
  status: string;
  detail?: string;
  at: string;
}

export interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface SessionSnapshot {
  info: SessionInfo;
  messages: UiMessage[];
  chatMessages: ChatMessage[];
  changes: UiChange[];
  terminal: UiTerminalLine[];
  tasks: UiTask[];
  usage: SessionUsage;
  events: SessionEvent[];
}

function asRecord(e: SessionEvent): Record<string, unknown> {
  return e as unknown as Record<string, unknown>;
}

/**
 * UX1: list/open/children SessionInfo always expose identity keys.
 * Empty string = unknown (not configured / legacy transcript without session.meta).
 * Prefer this over omitting optional fields so UI never treats "missing key" as "loading".
 */
export function withSessionIdentityKeys(info: SessionInfo): SessionInfo {
  return {
    ...info,
    model: info.model != null ? String(info.model) : "",
    providerId: info.providerId != null ? String(info.providerId) : "",
  };
}

/**
 * Rebuild session info + UI/model context from a JSONL event stream.
 */
export function buildSessionSnapshot(
  events: SessionEvent[],
  fallback: Partial<SessionInfo> & { id: string },
): SessionSnapshot {
  let workspacePath = fallback.workspacePath ?? "";
  let createdAt = fallback.createdAt ?? new Date().toISOString();
  let updatedAt = fallback.updatedAt ?? createdAt;
  let status: SessionInfo["status"] = fallback.status ?? "idle";
  let title = fallback.title ?? "Session";
  let model = fallback.model;
  let providerId = fallback.providerId;
  let parentSessionId = fallback.parentSessionId;
  let subagentProfile = fallback.subagentProfile;
  let subagentDepth = fallback.subagentDepth;
  let goal = fallback.goal;
  let firstUser: string | undefined;
  let metaTitle: string | undefined;
  let usage: SessionUsage = { inputTokens: 0, outputTokens: 0 };

  const messages: UiMessage[] = [];
  const chatMessages: ChatMessage[] = [];
  const changes: UiChange[] = [];
  const terminal: UiTerminalLine[] = [];
  const tasks: UiTask[] = [];

  for (const event of events) {
    const at = String(asRecord(event).at ?? updatedAt);
    updatedAt = at;

    switch (event.type) {
      case "session.started":
        workspacePath = event.workspacePath || workspacePath;
        createdAt = event.at || createdAt;
        status = "idle";
        break;
      case "session.completed":
        status = "idle";
        break;
      case "session.failed":
        status = "failed";
        messages.push({ role: "error", text: event.error });
        break;
      case "session.aborted":
        status = "idle";
        messages.push({ role: "system", text: "会话已由用户停止" });
        break;
      case "session.meta":
        if (event.title?.trim()) {
          metaTitle = event.title.trim();
          title = metaTitle;
        }
        if (event.model?.trim()) model = event.model.trim();
        if (event.providerId?.trim()) providerId = event.providerId.trim();
        if (event.parentSessionId) parentSessionId = event.parentSessionId;
        if (event.subagentProfile) subagentProfile = event.subagentProfile;
        if (event.subagentDepth != null) subagentDepth = event.subagentDepth;
        if (event.goal?.trim()) goal = event.goal.trim();
        break;
      case "subagent.updated":
        // Parent tree event — no local message reconstruction.
        break;
      case "thinking.delta":
        // Live-only; not in durable JSONL.
        break;
      case "thinking.completed":
        if (event.text?.trim()) {
          messages.push({
            role: "thinking",
            text: event.text,
            messageId: event.messageId,
            thinking: true,
          });
        }
        break;
      case "usage.updated":
        usage = {
          inputTokens: usage.inputTokens + (Number(event.inputTokens) || 0),
          outputTokens: usage.outputTokens + (Number(event.outputTokens) || 0),
        };
        break;
      case "message.completed":
        messages.push({
          role: event.role,
          text: event.text,
          messageId: event.messageId,
        });
        if (event.role === "user") {
          chatMessages.push({ role: "user", content: event.text });
          if (!firstUser) firstUser = event.text;
        } else if (event.role === "assistant") {
          chatMessages.push({ role: "assistant", content: event.text });
        } else if (event.role === "system") {
          // system rows in transcript are rare; keep UI only
        }
        break;
      case "tool.started": {
        messages.push({
          role: "tool",
          name: event.name,
          text: `开始执行 ${event.name}`,
          detail: event.input,
          callId: event.callId,
          phase: "running",
          input: event.input,
        });
        // Reconstruct OpenAI-compatible assistant.tool_calls so resumed sessions can continue.
        chatMessages.push({
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: event.callId,
              type: "function",
              function: {
                name: event.name,
                arguments: JSON.stringify(event.input ?? {}),
              },
            },
          ],
        });
        break;
      }
      case "tool.completed": {
        const idx = event.callId
          ? messages.findIndex(
              (m) =>
                m &&
                m.role === "tool" &&
                (m as { callId?: string }).callId === event.callId &&
                (m as { phase?: string }).phase === "running",
            )
          : -1;
        const row = {
          role: "tool" as const,
          name: event.name,
          text: event.ok ? `完成 ${event.name}` : `失败 ${event.name}`,
          detail: event.output,
          callId: event.callId,
          phase: "done" as const,
          ok: event.ok,
          input: idx >= 0 ? (messages[idx] as { input?: unknown }).input : undefined,
          output: event.output,
        };
        if (idx >= 0) messages[idx] = { ...messages[idx], ...row };
        else messages.push(row);
        const content =
          typeof event.output === "string" ? event.output : JSON.stringify(event.output ?? {});
        chatMessages.push({
          role: "tool",
          tool_call_id: event.callId,
          name: event.name,
          content,
        });
        break;
      }
      case "permission.resolved": {
        const map: Record<string, string> = {
          allow: "允许一次",
          deny: "拒绝",
          allow_session: "本会话允许",
        };
        messages.push({
          role: "system",
          text: `权限决策: ${map[event.decision] || event.decision} · ${event.requestId.slice(0, 8)}`,
        });
        break;
      }
      case "diff.updated": {
        const next: UiChange = {
          path: event.path,
          kind: event.kind,
          before: event.before,
          after: event.after,
          at: event.at,
        };
        const idx = changes.findIndex((c) => c.path === event.path);
        if (idx >= 0) changes[idx] = { ...changes[idx], ...next };
        else changes.unshift(next);
        break;
      }
      case "terminal.output":
        terminal.unshift({
          callId: event.callId,
          command: event.command,
          stdout: event.stdout,
          stderr: event.stderr,
          code: event.code,
          ok: event.ok,
          at: event.at,
        });
        break;
      case "task.updated": {
        const next: UiTask = {
          taskId: event.taskId,
          title: event.title,
          status: event.status,
          detail: event.detail,
          at: event.at,
        };
        const idx = tasks.findIndex((t) => t.taskId === event.taskId);
        if (idx >= 0) tasks[idx] = next;
        else tasks.unshift(next);
        break;
      }
      default:
        break;
    }
  }

  if (!metaTitle) {
    if (firstUser) {
      const short = firstUser.replace(/\s+/g, " ").trim().slice(0, 48);
      if (short) title = short;
    } else if (workspacePath) {
      const base = workspacePath.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
      if (base) title = base;
    }
  }

  if (status === "running" || status === "waiting_permission") {
    // Crash recovery: treat unfinished loops as idle.
    status = "idle";
  }

  const explicitFallback =
    fallback.title &&
    fallback.title !== "New session" &&
    fallback.title !== "Session" &&
    !metaTitle
      ? fallback.title
      : undefined;

  const info: SessionInfo = withSessionIdentityKeys({
    id: fallback.id,
    workspacePath,
    title: metaTitle || explicitFallback || title,
    model: model != null && String(model).trim() ? String(model).trim() : "",
    providerId:
      providerId != null && String(providerId).trim()
        ? String(providerId).trim()
        : "",
    createdAt,
    updatedAt,
    status,
    parentSessionId,
    subagentProfile,
    subagentDepth,
    goal,
  });

  return {
    info,
    messages,
    chatMessages,
    changes,
    terminal: terminal.slice(0, 80),
    tasks: tasks.slice(0, 100),
    usage,
    events,
  };
}
