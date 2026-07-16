import { z } from "zod";

export const CreateSessionRequestSchema = z.object({
  workspacePath: z.string().min(1),
  title: z.string().optional(),
  model: z.string().optional(),
});

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const SessionInfoSchema = z.object({
  id: z.string(),
  workspacePath: z.string(),
  title: z.string(),
  model: z.string().optional(),
  /** Provider channel id (config.providers[].id); stable for list/open UI. */
  providerId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["idle", "running", "waiting_permission", "completed", "failed"]),
  /** Parent session when this is a sub-agent child (1.1 observability). */
  parentSessionId: z.string().optional(),
  subagentProfile: z.enum(["explore", "edit", "shell"]).optional(),
  subagentDepth: z.number().int().min(0).max(8).optional(),
  /** Short goal text for sub-agent children (UI tree). */
  goal: z.string().optional(),
});

export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const SendMessageRequestSchema = z.object({
  sessionId: z.string(),
  text: z.string().min(1),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
