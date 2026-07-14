import { z } from "zod";

export const ToolRiskSchema = z.enum(["low", "medium", "high"]);
export type ToolRisk = z.infer<typeof ToolRiskSchema>;

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  risk: ToolRiskSchema,
  inputSchema: z.record(z.unknown()),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const PermissionDecisionSchema = z.enum(["allow", "deny", "ask"]);
export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;
