/**
 * JSON-RPC-ish framing for the session worker child process (stdio NDJSON).
 * Main process owns UI / permission dialogs; worker owns SessionManager + tools.
 */

import type { SessionEvent, SessionInfo } from "@hfq/shared";
import type { PermissionMode } from "@hfq/policy";
import type { SessionSnapshot } from "../history.js";
import type { SubagentProfile } from "../subagent.js";
import type { PermissionDecision } from "../manager.js";

export const WORKER_PROTOCOL_VERSION = 1 as const;

/** Serializable provider handle — worker rebuilds a live ModelProvider. */
export interface WorkerProviderSpec {
  id: string;
  kind: "mock" | "openai_compatible" | "anthropic";
  baseURL?: string;
  apiKey?: string;
}

export interface WorkerMcpServerSpec {
  id: string;
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  description?: string;
}

export interface WorkerConfigureParams {
  bundledSkillsDir?: string;
  sharedAgentsDir?: string;
  memoryEnabled?: boolean;
  compactMaxChars?: number;
  /** Optional MCP registry so the worker can inject mcp__ tools. */
  mcpServers?: WorkerMcpServerSpec[];
}

export interface WorkerCreateParams {
  workspacePath: string;
  model?: string;
  provider?: WorkerProviderSpec;
  title?: string;
  planMode?: boolean;
  permissionMode?: PermissionMode;
  memoryEnabled?: boolean;
  compactMaxChars?: number;
  parentSessionId?: string;
  subagentDepth?: number;
  subagentProfile?: SubagentProfile;
  maxRounds?: number;
  maxToolCalls?: number;
  codingProfileAddon?: string;
  codingProfileSkillIds?: string[];
  skillMatch?: {
    enabled?: boolean;
    maxBodies?: number;
    maxBodyChars?: number;
  };
  /** Title role as serializable provider spec + model. */
  titleModelRole?: { provider?: WorkerProviderSpec; model?: string };
  compressionModelRole?: { provider?: WorkerProviderSpec; model?: string };
}

export interface WorkerOpenParams {
  sessionId: string;
  workspacePath?: string;
  model?: string;
  provider?: WorkerProviderSpec;
  planMode?: boolean;
  permissionMode?: PermissionMode;
  memoryEnabled?: boolean;
  compactMaxChars?: number;
  codingProfileAddon?: string;
  codingProfileSkillIds?: string[];
  skillMatch?: {
    enabled?: boolean;
    maxBodies?: number;
    maxBodyChars?: number;
  };
  titleModelRole?: { provider?: WorkerProviderSpec; model?: string };
  compressionModelRole?: { provider?: WorkerProviderSpec; model?: string };
}

export interface WorkerSendParams {
  sessionId: string;
  text: string;
}

export interface WorkerPermissionParams {
  requestId: string;
  decision: PermissionDecision;
}

export interface WorkerSpawnParams {
  parentSessionId: string;
  goal: string;
  profile: SubagentProfile;
  provider?: WorkerProviderSpec;
  model?: string;
  workspacePath?: string;
}

export type WorkerRequestMethod =
  | "ping"
  | "configure"
  | "create"
  | "open"
  | "send"
  | "abort"
  | "get"
  | "list"
  | "listAll"
  | "snapshot"
  | "delete"
  | "rename"
  | "setPlanMode"
  | "getPlanMode"
  | "setPermissionMode"
  | "getPermissionMode"
  | "setProviderModel"
  | "listChildren"
  | "listSpawnAttempts"
  | "spawnSubagent"
  | "resolvePermission"
  | "listSessionAllows"
  | "grantSessionAllow"
  | "revokeSessionAllow"
  | "shutdown";

export type WorkerRequest =
  | { id: string; method: "ping"; params?: Record<string, never> }
  | { id: string; method: "configure"; params: WorkerConfigureParams }
  | { id: string; method: "create"; params: WorkerCreateParams }
  | { id: string; method: "open"; params: WorkerOpenParams }
  | { id: string; method: "send"; params: WorkerSendParams }
  | { id: string; method: "abort"; params: { sessionId: string } }
  | { id: string; method: "get"; params: { sessionId: string } }
  | { id: string; method: "list"; params?: Record<string, never> }
  | { id: string; method: "listAll"; params?: { workspacePath?: string } }
  | { id: string; method: "snapshot"; params: { sessionId: string } }
  | { id: string; method: "delete"; params: { sessionId: string } }
  | { id: string; method: "rename"; params: { sessionId: string; title: string } }
  | { id: string; method: "setPlanMode"; params: { sessionId: string; enabled: boolean } }
  | { id: string; method: "getPlanMode"; params: { sessionId: string } }
  | {
      id: string;
      method: "setPermissionMode";
      params: { sessionId: string; mode: PermissionMode | string };
    }
  | { id: string; method: "getPermissionMode"; params: { sessionId: string } }
  | {
      id: string;
      method: "setProviderModel";
      params: { sessionId: string; provider: WorkerProviderSpec; model: string };
    }
  | { id: string; method: "listChildren"; params: { sessionId: string } }
  | { id: string; method: "listSpawnAttempts"; params: { sessionId: string } }
  | { id: string; method: "spawnSubagent"; params: WorkerSpawnParams }
  | { id: string; method: "resolvePermission"; params: WorkerPermissionParams }
  | { id: string; method: "listSessionAllows"; params: { sessionId: string } }
  | {
      id: string;
      method: "grantSessionAllow";
      params: { sessionId: string; toolName: string };
    }
  | {
      id: string;
      method: "revokeSessionAllow";
      params: { sessionId: string; toolName: string };
    }
  | { id: string; method: "shutdown"; params?: Record<string, never> };

export type WorkerResponse =
  | { id: string; ok: true; result?: unknown }
  | { id: string; ok: false; error: { message: string; code?: string } };

export type WorkerNotification =
  | {
      notify: "ready";
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      pid: number;
    }
  | { notify: "event"; event: SessionEvent }
  | { notify: "log"; level: "info" | "warn" | "error"; message: string };

export type WorkerOutbound = WorkerResponse | WorkerNotification;

export type WorkerCreateResult = SessionInfo;
export type WorkerOpenResult = SessionSnapshot;
export type WorkerSnapshotResult = SessionSnapshot | null;
export type WorkerListResult = SessionInfo[];
export type WorkerSpawnResult = {
  childSessionId: string;
  summary: string;
  ok: boolean;
  error?: string;
  errorCode?: string;
};
