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
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["idle", "running", "waiting_permission", "completed", "failed"]),
});

export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const SendMessageRequestSchema = z.object({
  sessionId: z.string(),
  text: z.string().min(1),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
