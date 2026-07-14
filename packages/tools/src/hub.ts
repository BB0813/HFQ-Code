import type { ToolDefinition, ToolRisk } from "@hfq/shared";
import { builtinHandlers, builtinToolDefs, type ToolHandler } from "./builtin.js";

export interface ToolHub {
  list(): ToolDefinition[];
  riskOf(name: string): ToolRisk;
  execute(name: string, workspaceRoot: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface CreateToolHubOptions {
  extraDefs?: ToolDefinition[];
  /** Handlers for extra / dynamic tools (e.g. MCP). Builtins always available. */
  handlers?: Record<string, ToolHandler>;
}

export function createToolHub(
  extraOrOpts: ToolDefinition[] | CreateToolHubOptions = [],
): ToolHub {
  const opts: CreateToolHubOptions = Array.isArray(extraOrOpts)
    ? { extraDefs: extraOrOpts }
    : extraOrOpts;
  const defs = [...builtinToolDefs, ...(opts.extraDefs ?? [])];
  const byName = new Map(defs.map((d) => [d.name, d]));
  const handlers: Record<string, ToolHandler> = {
    ...builtinHandlers,
    ...(opts.handlers ?? {}),
  };

  return {
    list: () => [...byName.values()],
    riskOf: (name) => byName.get(name)?.risk ?? "high",
    execute: async (name, workspaceRoot, input) => {
      const handler = handlers[name];
      if (!handler) throw new Error(`unknown tool: ${name}`);
      return handler(workspaceRoot, input);
    },
  };
}
