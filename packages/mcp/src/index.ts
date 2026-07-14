/**
 * MCP client host — registry + connection state.
 * Stdio: real JSON-RPC initialize + tools/list + tools/call.
 * HTTP: JSON-RPC POST (plain JSON / simple SSE) tools/list + tools/call.
 */

import { connectHttpMcp } from "./http.js";
import { connectStdioMcp, type McpRemoteTool } from "./stdio.js";

export type McpServerStatus = "disconnected" | "connecting" | "connected" | "error";

export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  /** Optional HTTP auth / custom headers (Bearer, etc.). */
  headers?: Record<string, string>;
  enabled: boolean;
  description?: string;
}

export interface McpServerState extends McpServerConfig {
  status: McpServerStatus;
  lastError?: string;
  connectedAt?: string;
  toolCount: number;
}

export interface McpToolInfo {
  serverId: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** Tool names exposed to the agent: mcp__<serverId>__<toolName> */
export function mcpAgentToolName(serverId: string, toolName: string): string {
  const safeServer = serverId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTool = toolName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `mcp__${safeServer}__${safeTool}`;
}

export function parseMcpAgentToolName(
  name: string,
): { serverId: string; toolName: string } | null {
  if (!name.startsWith("mcp__")) return null;
  const rest = name.slice("mcp__".length);
  const idx = rest.indexOf("__");
  if (idx <= 0) return null;
  return { serverId: rest.slice(0, idx), toolName: rest.slice(idx + 2) };
}

export interface McpAgentToolBundle {
  defs: Array<{
    name: string;
    description: string;
    risk: "low" | "medium" | "high";
    inputSchema: Record<string, unknown>;
  }>;
  call: (name: string, input: Record<string, unknown>) => Promise<unknown>;
}

export interface McpHost {
  listServers(): McpServerState[];
  listTools(): Promise<McpToolInfo[]>;
  setServers(servers: McpServerConfig[]): void;
  upsertServer(server: McpServerConfig): McpServerState;
  removeServer(id: string): boolean;
  setEnabled(id: string, enabled: boolean): McpServerState | null;
  connect(id: string, opts?: { cwd?: string }): Promise<McpServerState>;
  disconnect(id: string): McpServerState | null;
  /** Live stdio tools for agent-core injection. */
  getAgentToolBundle(): McpAgentToolBundle;
}

export function defaultMcpServers(): McpServerConfig[] {
  return [
    {
      id: "filesystem",
      name: "Filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      enabled: false,
      description: "工作区文件读写（stdio MCP，连接时会真实握手 tools/list）",
    },
    {
      id: "fetch",
      name: "Fetch",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
      enabled: false,
      description: "HTTP 抓取示例服务器（stdio）",
    },
  ];
}

/** Fallback tools when transport cannot list (HTTP demo / offline). */
const DEMO_TOOLS: Record<string, McpToolInfo[]> = {
  filesystem: [
    {
      serverId: "filesystem",
      name: "fs.read",
      description: "读取路径内容（演示工具清单）",
    },
    {
      serverId: "filesystem",
      name: "fs.write",
      description: "写入路径内容（演示工具清单）",
    },
    {
      serverId: "filesystem",
      name: "fs.list",
      description: "列出目录（演示工具清单）",
    },
  ],
  fetch: [
    {
      serverId: "fetch",
      name: "http.get",
      description: "GET 请求（演示工具清单）",
    },
  ],
};

function toState(cfg: McpServerConfig, prev?: McpServerState): McpServerState {
  return {
    ...cfg,
    status: prev?.status ?? "disconnected",
    lastError: prev?.lastError,
    connectedAt: prev?.connectedAt,
    toolCount: prev?.toolCount ?? 0,
  };
}

export function createMcpHost(initial: McpServerConfig[] = defaultMcpServers()): McpHost {
  const states = new Map<string, McpServerState>();
  const toolCache = new Map<string, McpToolInfo[]>();
  const liveSessions = new Map<
    string,
    { close(): void; callTool(name: string, args?: Record<string, unknown>): Promise<unknown> }
  >();
  /** Maps mcp__server__tool → { serverId, remoteName } for live sessions (stdio + http). */
  const agentRoute = new Map<string, { serverId: string; remoteName: string }>();

  for (const s of initial) states.set(s.id, toState(s));

  const rebuildAgentRoutes = () => {
    agentRoute.clear();
    for (const [serverId, tools] of toolCache) {
      if (!liveSessions.has(serverId)) continue;
      const st = states.get(serverId);
      if (!st || st.status !== "connected" || !st.enabled) continue;
      for (const t of tools) {
        agentRoute.set(mcpAgentToolName(serverId, t.name), {
          serverId,
          remoteName: t.name,
        });
      }
    }
  };

  const dropSession = (id: string) => {
    const live = liveSessions.get(id);
    if (live) {
      try {
        live.close();
      } catch {
        /* ignore */
      }
      liveSessions.delete(id);
    }
    rebuildAgentRoutes();
  };

  return {
    listServers: () =>
      [...states.values()].map((s) => ({ ...s, args: s.args ? [...s.args] : undefined })),

    listTools: async () => {
      const tools: McpToolInfo[] = [];
      for (const s of states.values()) {
        if (s.status !== "connected" || !s.enabled) continue;
        const cached = toolCache.get(s.id);
        if (cached?.length) tools.push(...cached.map((t) => ({ ...t })));
        else tools.push(...(DEMO_TOOLS[s.id] ?? []).map((t) => ({ ...t })));
      }
      return tools;
    },

    setServers: (next) => {
      const keep = new Map(states);
      for (const id of states.keys()) {
        if (!next.some((s) => s.id === id)) dropSession(id);
      }
      states.clear();
      toolCache.clear();
      for (const s of next) {
        states.set(s.id, toState(s, keep.get(s.id)));
      }
    },

    upsertServer: (server) => {
      const prev = states.get(server.id);
      const next = toState(server, prev);
      states.set(server.id, next);
      return { ...next, args: next.args ? [...next.args] : undefined };
    },

    removeServer: (id) => {
      dropSession(id);
      toolCache.delete(id);
      return states.delete(id);
    },

    setEnabled: (id, enabled) => {
      const cur = states.get(id);
      if (!cur) return null;
      if (!enabled) {
        dropSession(id);
        toolCache.delete(id);
      }
      const next: McpServerState = {
        ...cur,
        enabled,
        status: enabled ? cur.status : "disconnected",
        connectedAt: enabled ? cur.connectedAt : undefined,
        toolCount: enabled ? cur.toolCount : 0,
        lastError: enabled ? cur.lastError : undefined,
      };
      states.set(id, next);
      return { ...next, args: next.args ? [...next.args] : undefined };
    },

    connect: async (id, opts = {}) => {
      const cur = states.get(id);
      if (!cur) throw new Error(`unknown MCP server: ${id}`);
      if (!cur.enabled) throw new Error("server disabled");

      dropSession(id);

      const connecting: McpServerState = {
        ...cur,
        status: "connecting",
        lastError: undefined,
      };
      states.set(id, connecting);

      if (cur.transport === "http") {
        if (!cur.url?.trim()) {
          const failed: McpServerState = {
            ...cur,
            status: "error",
            lastError: "HTTP 传输需要填写 url",
            toolCount: 0,
          };
          states.set(id, failed);
          return { ...failed };
        }
        try {
          const session = await connectHttpMcp({
            url: cur.url.trim(),
            headers: cur.headers,
            timeoutMs: 25_000,
          });
          liveSessions.set(id, session);
          const tools: McpToolInfo[] = session.tools.map((t: McpRemoteTool) => ({
            serverId: id,
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }));
          toolCache.set(id, tools);
          const connected: McpServerState = {
            ...cur,
            status: "connected",
            connectedAt: new Date().toISOString(),
            toolCount: tools.length,
            lastError: undefined,
          };
          states.set(id, connected);
          // Must set connected before rebuild so agent routes are registered.
          rebuildAgentRoutes();
          return { ...connected, args: connected.args ? [...connected.args] : undefined };
        } catch (err) {
          dropSession(id);
          toolCache.delete(id);
          const failed: McpServerState = {
            ...cur,
            status: "error",
            lastError: err instanceof Error ? err.message : String(err),
            toolCount: 0,
          };
          states.set(id, failed);
          return { ...failed, args: failed.args ? [...failed.args] : undefined };
        }
      }

      if (!cur.command?.trim()) {
        const failed: McpServerState = {
          ...cur,
          status: "error",
          lastError: "stdio 传输需要填写 command",
          toolCount: 0,
        };
        states.set(id, failed);
        return { ...failed };
      }

      try {
        const session = await connectStdioMcp({
          command: cur.command,
          args: cur.args,
          cwd: opts.cwd,
          timeoutMs: 25_000,
        });
        liveSessions.set(id, session);
        const tools: McpToolInfo[] = session.tools.map((t: McpRemoteTool) => ({
          serverId: id,
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
        // If server returns empty list, keep empty (honest inventory).
        toolCache.set(id, tools);
        const connected: McpServerState = {
          ...cur,
          status: "connected",
          connectedAt: new Date().toISOString(),
          toolCount: tools.length,
          lastError: undefined,
        };
        // Status must be "connected" before route rebuild (routes require live + connected).
        states.set(id, connected);
        rebuildAgentRoutes();
        return { ...connected, args: connected.args ? [...connected.args] : undefined };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Fall back to demo inventory so UI still works offline / without npx package.
        // Demo tools are NOT callable via agent (no live session).
        const demo = (DEMO_TOOLS[id] ?? []).map((t) => ({ ...t, serverId: id }));
        toolCache.set(id, demo);
        rebuildAgentRoutes();
        const failed: McpServerState = {
          ...cur,
          status: demo.length ? "connected" : "error",
          connectedAt: demo.length ? new Date().toISOString() : undefined,
          toolCount: demo.length,
          lastError: demo.length
            ? `真实握手失败，已回退演示清单（不可调用）: ${message.slice(0, 220)}`
            : message.slice(0, 400),
        };
        states.set(id, failed);
        return { ...failed, args: failed.args ? [...failed.args] : undefined };
      }
    },

    disconnect: (id) => {
      const cur = states.get(id);
      if (!cur) return null;
      dropSession(id);
      toolCache.delete(id);
      rebuildAgentRoutes();
      const next: McpServerState = {
        ...cur,
        status: "disconnected",
        connectedAt: undefined,
        toolCount: 0,
        lastError: undefined,
      };
      states.set(id, next);
      return { ...next, args: next.args ? [...next.args] : undefined };
    },

    getAgentToolBundle: () => {
      const defs: McpAgentToolBundle["defs"] = [];
      for (const [agentName, route] of agentRoute) {
        const tools = toolCache.get(route.serverId) ?? [];
        const meta = tools.find((t) => t.name === route.remoteName);
        defs.push({
          name: agentName,
          description: `[MCP:${route.serverId}] ${meta?.description || route.remoteName}`,
          risk: "medium",
          inputSchema:
            meta?.inputSchema && typeof meta.inputSchema === "object"
              ? meta.inputSchema
              : { type: "object", properties: {} },
        });
      }
      return {
        defs,
        call: async (name, input) => {
          const route = agentRoute.get(name);
          if (!route) throw new Error(`MCP tool not available: ${name}`);
          const session = liveSessions.get(route.serverId);
          if (!session) throw new Error(`MCP server not live: ${route.serverId}`);
          return session.callTool(route.remoteName, input);
        },
      };
    },
  };
}

export { connectStdioMcp } from "./stdio.js";
