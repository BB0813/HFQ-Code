/**
 * Session worker entry — runs SessionManager in a child process.
 * Framing: one JSON object per line on stdin/stdout (NDJSON).
 *
 * Spawn: `node dist/worker/entry.js` (or tsx equivalent in tests).
 */

import type { ModelProvider } from "@hfq/providers";
import { createProviderFromConfig } from "@hfq/providers";
import type { SessionEvent } from "@hfq/shared";
import type { ExtraToolsBundle } from "../loop.js";
import { SessionManager } from "../manager.js";
import {
  WORKER_PROTOCOL_VERSION,
  type WorkerConfigureParams,
  type WorkerOutbound,
  type WorkerProviderSpec,
  type WorkerRequest,
} from "./protocol.js";

let manager: SessionManager | null = null;
let configured = false;
let lastConfig: WorkerConfigureParams = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mcpHost: any = null;

const write = (msg: WorkerOutbound) => {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
};

const log = (level: "info" | "warn" | "error", message: string) => {
  write({ notify: "log", level, message });
};

function resolveProvider(spec?: WorkerProviderSpec): ModelProvider {
  if (!spec) return createProviderFromConfig({ id: "mock", kind: "mock" });
  return createProviderFromConfig({
    id: spec.id,
    kind: spec.kind,
    baseURL: spec.baseURL,
    apiKey: spec.apiKey,
  });
}

async function buildExtraTools(
  cfg: WorkerConfigureParams,
): Promise<(() => ExtraToolsBundle | null | undefined) | undefined> {
  if (!cfg.mcpServers?.length) return undefined;
  try {
    const mcpMod = await import("@hfq/mcp");
    const host = mcpMod.createMcpHost(cfg.mcpServers);
    mcpHost = host;
    return () => {
      try {
        const bundle = host.getAgentToolBundle();
        if (!bundle?.defs?.length) return null;
        const handlers: ExtraToolsBundle["handlers"] = {};
        for (const def of bundle.defs) {
          handlers[def.name] = async (_ws, input) =>
            bundle.call(def.name, (input || {}) as Record<string, unknown>);
        }
        return { defs: bundle.defs, handlers };
      } catch (err) {
        log("warn", `getExtraTools failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    };
  } catch (err) {
    log(
      "warn",
      `MCP host unavailable in worker: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

async function ensureManager(cfg?: WorkerConfigureParams): Promise<SessionManager> {
  if (cfg) lastConfig = { ...lastConfig, ...cfg };

  if (manager && configured) {
    if (cfg?.mcpServers && typeof mcpHost?.setServers === "function") {
      mcpHost.setServers(cfg.mcpServers);
    }
    return manager;
  }

  const getExtraTools = await buildExtraTools(lastConfig);
  manager = new SessionManager({
    bundledSkillsDir: lastConfig.bundledSkillsDir,
    sharedAgentsDir: lastConfig.sharedAgentsDir,
    memoryEnabled: lastConfig.memoryEnabled,
    compactMaxChars: lastConfig.compactMaxChars,
    getExtraTools,
    onEvent: async (event: SessionEvent) => {
      write({ notify: "event", event });
    },
  });
  configured = true;
  return manager;
}

async function handle(req: WorkerRequest): Promise<unknown> {
  switch (req.method) {
    case "ping":
      return {
        pong: true,
        protocolVersion: WORKER_PROTOCOL_VERSION,
        pid: process.pid,
        configured,
      };

    case "configure": {
      manager = null;
      configured = false;
      mcpHost = null;
      lastConfig = req.params || {};
      await ensureManager(lastConfig);
      return { ok: true, configured: true };
    }

    case "create": {
      const mgr = await ensureManager();
      const p = req.params;
      return mgr.create({
        workspacePath: p.workspacePath,
        model: p.model,
        provider: resolveProvider(p.provider),
        title: p.title,
        planMode: p.planMode,
        permissionMode: p.permissionMode,
        memoryEnabled: p.memoryEnabled,
        compactMaxChars: p.compactMaxChars,
        parentSessionId: p.parentSessionId,
        subagentDepth: p.subagentDepth,
        subagentProfile: p.subagentProfile,
        maxRounds: p.maxRounds,
        maxToolCalls: p.maxToolCalls,
      });
    }

    case "open": {
      const mgr = await ensureManager();
      const p = req.params;
      return mgr.open({
        sessionId: p.sessionId,
        workspacePath: p.workspacePath,
        model: p.model,
        provider: resolveProvider(p.provider),
        planMode: p.planMode,
        permissionMode: p.permissionMode,
        memoryEnabled: p.memoryEnabled,
        compactMaxChars: p.compactMaxChars,
      });
    }

    case "send": {
      const mgr = await ensureManager();
      await mgr.send(req.params.sessionId, req.params.text);
      return { ok: true, sessionId: req.params.sessionId };
    }

    case "abort": {
      const mgr = await ensureManager();
      return { ok: mgr.abort(req.params.sessionId), sessionId: req.params.sessionId };
    }

    case "get": {
      const mgr = await ensureManager();
      return mgr.get(req.params.sessionId) ?? null;
    }

    case "list": {
      const mgr = await ensureManager();
      return mgr.list();
    }

    case "listAll": {
      const mgr = await ensureManager();
      return mgr.listAll(req.params?.workspacePath);
    }

    case "snapshot": {
      const mgr = await ensureManager();
      return mgr.getSnapshot(req.params.sessionId) ?? null;
    }

    case "delete": {
      const mgr = await ensureManager();
      return mgr.delete(req.params.sessionId);
    }

    case "rename": {
      const mgr = await ensureManager();
      return mgr.rename(req.params.sessionId, req.params.title);
    }

    case "setPlanMode": {
      const mgr = await ensureManager();
      const ok = mgr.setPlanMode(req.params.sessionId, req.params.enabled);
      return {
        ok,
        sessionId: req.params.sessionId,
        planMode: mgr.getPlanMode(req.params.sessionId),
        permissionMode: mgr.getPermissionMode(req.params.sessionId),
      };
    }

    case "getPlanMode": {
      const mgr = await ensureManager();
      return {
        sessionId: req.params.sessionId,
        planMode: mgr.getPlanMode(req.params.sessionId),
        permissionMode: mgr.getPermissionMode(req.params.sessionId),
      };
    }

    case "setPermissionMode": {
      const mgr = await ensureManager();
      const ok = mgr.setPermissionMode(req.params.sessionId, req.params.mode);
      return {
        ok,
        sessionId: req.params.sessionId,
        permissionMode: mgr.getPermissionMode(req.params.sessionId),
        planMode: mgr.getPlanMode(req.params.sessionId),
      };
    }

    case "getPermissionMode": {
      const mgr = await ensureManager();
      return {
        sessionId: req.params.sessionId,
        permissionMode: mgr.getPermissionMode(req.params.sessionId),
        planMode: mgr.getPlanMode(req.params.sessionId),
      };
    }

    case "listChildren": {
      const mgr = await ensureManager();
      return mgr.listChildren(req.params.sessionId);
    }

    case "listSpawnAttempts": {
      const mgr = await ensureManager();
      return mgr.listSpawnAttempts(req.params.sessionId);
    }

    case "spawnSubagent": {
      const mgr = await ensureManager();
      const p = req.params;
      return mgr.spawnSubagent({
        parentSessionId: p.parentSessionId,
        goal: p.goal,
        profile: p.profile,
        provider: p.provider ? resolveProvider(p.provider) : undefined,
        model: p.model,
        workspacePath: p.workspacePath,
      });
    }

    case "resolvePermission": {
      const mgr = await ensureManager();
      const ok = mgr.resolvePermission(req.params.requestId, req.params.decision);
      return { ok, requestId: req.params.requestId };
    }

    case "listSessionAllows": {
      const mgr = await ensureManager();
      return { sessionAllows: mgr.listSessionAllows(req.params.sessionId) };
    }

    case "grantSessionAllow": {
      const mgr = await ensureManager();
      return {
        sessionAllows: mgr.grantSessionAllow(req.params.sessionId, req.params.toolName),
      };
    }

    case "revokeSessionAllow": {
      const mgr = await ensureManager();
      return {
        sessionAllows: mgr.revokeSessionAllow(req.params.sessionId, req.params.toolName),
      };
    }

    case "shutdown": {
      setTimeout(() => process.exit(0), 10);
      return { ok: true };
    }

    default: {
      const unknown = req as { method?: string };
      throw new Error(`unknown method: ${String(unknown.method)}`);
    }
  }
}

function parseLine(line: string): WorkerRequest | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const raw = JSON.parse(trimmed) as WorkerRequest;
  if (!raw || typeof raw !== "object" || !("id" in raw) || !("method" in raw)) {
    throw new Error("invalid request frame");
  }
  return raw;
}

async function onLine(line: string): Promise<void> {
  let req: WorkerRequest | null = null;
  try {
    req = parseLine(line);
    if (!req) return;
    const result = await handle(req);
    write({ id: req.id, ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const id = req?.id ?? "unknown";
    write({ id, ok: false, error: { message } });
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let idx: number;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    void onLine(line);
  }
});

process.stdin.on("end", () => {
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  log(
    "error",
    `uncaughtException: ${err instanceof Error ? err.stack || err.message : String(err)}`,
  );
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  log("error", `unhandledRejection: ${err instanceof Error ? err.message : String(err)}`);
});

write({
  notify: "ready",
  protocolVersion: WORKER_PROTOCOL_VERSION,
  pid: process.pid,
});
