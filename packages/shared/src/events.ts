import { z } from "zod";

export const SessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.started"),
    sessionId: z.string(),
    workspacePath: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("session.completed"),
    sessionId: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("session.failed"),
    sessionId: z.string(),
    error: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("session.aborted"),
    sessionId: z.string(),
    reason: z.string().optional(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("session.meta"),
    sessionId: z.string(),
    title: z.string().optional(),
    model: z.string().optional(),
    /** Provider channel id bound to this session (list/open / rebind). */
    providerId: z.string().optional(),
    parentSessionId: z.string().optional(),
    subagentProfile: z.enum(["explore", "edit", "shell"]).optional(),
    subagentDepth: z.number().int().min(0).max(8).optional(),
    goal: z.string().optional(),
    at: z.string(),
  }),
  /** Parent-session tree: child spawn lifecycle for Tasks UI (1.1 B3). */
  z.object({
    type: z.literal("subagent.updated"),
    sessionId: z.string(),
    parentSessionId: z.string(),
    childSessionId: z.string().optional(),
    profile: z.enum(["explore", "edit", "shell"]),
    goal: z.string(),
    status: z.enum(["started", "completed", "failed"]),
    error: z.string().optional(),
    errorCode: z.string().optional(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("message.delta"),
    sessionId: z.string(),
    messageId: z.string(),
    role: z.enum(["assistant", "user", "system"]),
    text: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("message.completed"),
    sessionId: z.string(),
    messageId: z.string(),
    role: z.enum(["assistant", "user", "system"]),
    text: z.string(),
    at: z.string(),
  }),
  /**
   * Model chain-of-thought / extended thinking stream (live UI only).
   * Shares messageId with the following assistant message.delta/completed of the same model round.
   * Not written to JSONL (same policy as message.delta).
   */
  z.object({
    type: z.literal("thinking.delta"),
    sessionId: z.string(),
    messageId: z.string(),
    text: z.string(),
    at: z.string(),
  }),
  /**
   * Full thinking block for one model round (durable transcript for resume / collapsed CoT UI).
   */
  z.object({
    type: z.literal("thinking.completed"),
    sessionId: z.string(),
    messageId: z.string(),
    text: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("tool.started"),
    sessionId: z.string(),
    callId: z.string(),
    name: z.string(),
    input: z.unknown(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("tool.completed"),
    sessionId: z.string(),
    callId: z.string(),
    name: z.string(),
    ok: z.boolean(),
    output: z.unknown(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("permission.requested"),
    sessionId: z.string(),
    requestId: z.string(),
    toolName: z.string(),
    risk: z.enum(["low", "medium", "high"]),
    summary: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("permission.resolved"),
    sessionId: z.string(),
    requestId: z.string(),
    decision: z.enum(["allow", "deny", "allow_session"]),
    at: z.string(),
  }),
  z.object({
    type: z.literal("diff.updated"),
    sessionId: z.string(),
    path: z.string(),
    kind: z.enum(["create", "modify", "delete"]).optional(),
    before: z.string().optional(),
    after: z.string().optional(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("task.updated"),
    sessionId: z.string(),
    taskId: z.string(),
    title: z.string(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled", "failed"]),
    detail: z.string().optional(),
    /** Light Goal Driver fields (Athena-inspired; optional / additive). */
    kind: z.enum(["goal", "tool", "subagent"]).optional(),
    objective: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
    budget: z
      .object({
        maxRounds: z.number().int().optional(),
        maxToolCalls: z.number().int().optional(),
      })
      .optional(),
    parentTaskId: z.string().optional(),
    blockedReason: z.string().optional(),
    acceptance: z.string().optional(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("terminal.output"),
    sessionId: z.string(),
    callId: z.string(),
    command: z.string(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    code: z.number().nullable().optional(),
    ok: z.boolean(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("usage.updated"),
    sessionId: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    at: z.string(),
  }),
]);

export type SessionEvent = z.infer<typeof SessionEventSchema>;
