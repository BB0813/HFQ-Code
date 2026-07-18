/**
 * Typed facade over window.hfq (preload.cjs).
 * Source of truth: docs/FRONTEND-IPC.md + apps/desktop/electron/preload.cjs
 */

export type HfqInvokeResult<T = unknown> = T & { ok?: boolean; error?: string };

/** Soft-fail result from models:list / listProviderModels. */
export interface ListProviderModelsResult {
  ok?: boolean;
  providerId?: string;
  source?: "remote" | "config" | "mock" | "unsupported" | string;
  models?: string[];
  error?: string;
  warning?: string;
  rawCount?: number;
  [key: string]: unknown;
}

export interface AppInfo {
  version?: string;
  name?: string;
  platform?: string;
  electron?: string;
  activeProviderId?: string;
  activeModel?: string;
  [key: string]: unknown;
}

export interface WorkspaceInfo {
  /** UI-normalized path (from IPC `workspacePath`). */
  path?: string | null;
  /** Raw IPC field; prefer `path` after normalizeWorkspace. */
  workspacePath?: string | null;
  name?: string | null;
  bound?: boolean;
  ok?: boolean;
  [key: string]: unknown;
}

export interface SessionInfo {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  workspacePath?: string | null;
  parentSessionId?: string | null;
  subagentProfile?: "explore" | "edit" | "shell" | string | null;
  subagentDepth?: number;
  goal?: string | null;
  model?: string;
  providerId?: string;
  [key: string]: unknown;
}

/** Progress payload from `onUpdateDownload` (D3). */
export interface UpdateDownloadStatus {
  status?: "idle" | "downloading" | "completed" | "failed" | "cancelled" | string;
  percent?: number;
  bytesReceived?: number;
  bytesTotal?: number;
  filePath?: string;
  sha256?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SetActiveModelResult {
  sessionApplied?: {
    id?: string;
    model?: string;
    providerId?: string;
  } | null;
  sessionApplyError?: string | null;
  [key: string]: unknown;
}

export interface InstallUpdateResult {
  ok?: boolean;
  filePath?: string;
  quitSuggested?: boolean;
  cancelled?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface SessionMessage {
  id?: string;
  role: "user" | "assistant" | "system" | "tool" | string;
  /** UI-normalized body (from agent-core `text` or legacy `content`). */
  content?: string | unknown;
  /** Raw agent-core UiMessage field. */
  text?: string;
  name?: string;
  callId?: string;
  phase?: "running" | "done";
  ok?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}

export interface SessionChange {
  id?: string;
  path: string;
  kind?: "create" | "modify" | "delete";
  status?: string;
  before?: string;
  after?: string;
  at?: string;
  accepted?: boolean;
  rejected?: boolean;
  [key: string]: unknown;
}

export interface SessionSnapshot {
  /** agent-core open/snapshot primary session info */
  info?: SessionInfo;
  session?: SessionInfo;
  messages?: SessionMessage[];
  changes?: SessionChange[];
  tasks?: unknown[];
  terminal?: unknown[];
  usage?: { inputTokens?: number; outputTokens?: number };
  state?: Record<string, unknown>;
  [key: string]: unknown;
}

export type PermissionDecision = "allow" | "deny" | "allow_session";

export interface PermissionRequest {
  requestId: string;
  sessionId?: string;
  toolName?: string;
  description?: string;
  risk?: string;
  args?: unknown;
  [key: string]: unknown;
}

export interface PtySessionInfo {
  id: string;
  pid?: number;
  cwd?: string;
  shell?: string;
  backend?: string;
  cols?: number;
  rows?: number;
  label?: string;
  createdAt?: string;
}

export interface AvailableShell {
  kind: string;
  file?: string;
  available?: boolean;
  label?: string;
}

/** Shallow workspace directory entry from `listWorkspaceDir`. */
export interface WorkspaceDirEntry {
  name: string;
  path: string;
  type: "dir" | "file" | "symlink" | "other" | string;
  size?: number;
  mtimeMs?: number;
}

export interface GitStatusEntry {
  xy: string;
  path: string;
  origPath?: string;
}

export interface GitStatus {
  isRepo?: boolean;
  branch?: string;
  dirty?: boolean;
  entries?: GitStatusEntry[];
  head?: string;
  recent?: unknown[];
  [key: string]: unknown;
}

export interface GitLogEntry {
  sha: string;
  shortSha?: string;
  subject?: string;
  author?: string;
  relativeDate?: string;
  isoDate?: string;
}

export interface SpawnAttempt {
  /** Backend primary key (bc5f42b+); fall back to id for compat. */
  attemptId?: string;
  id?: string;
  sessionId?: string;
  parentSessionId?: string;
  goal?: string;
  profile?: string;
  status?: string;
  error?: string;
  errorCode?: string;
  childSessionId?: string | null;
  at?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AppPaths {
  userData?: string;
  configPath?: string;
  credentialsPath?: string;
  credentialsEncoding?: "missing" | "plaintext" | "dpapi-current-user" | "unknown" | string;
  credentialsDpapi?: boolean;
  logsPath?: string;
  exportsPath?: string;
  [key: string]: unknown;
}

export type SessionEvent = {
  type: string;
  sessionId?: string;
  [key: string]: unknown;
};

export interface HfqApi {
  getInfo: () => Promise<AppInfo>;
  listPages: () => Promise<unknown>;
  openWorkspace: () => Promise<WorkspaceInfo>;
  setWorkspace: (payload?: { workspacePath?: string; path?: string }) => Promise<WorkspaceInfo>;
  getWorkspace: () => Promise<WorkspaceInfo>;
  openPath: (payload?: { path?: string }) => Promise<unknown>;
  openWorkspaceFile: (payload?: { path?: string }) => Promise<unknown>;
  openInEditor: (payload?: { path?: string; line?: number }) => Promise<unknown>;
  readWorkspaceText: (payload?: {
    path?: string;
  }) => Promise<{ content?: string; error?: string; exists?: boolean; ok?: boolean }>;
  writeWorkspaceText: (payload?: { path?: string; content?: string }) => Promise<unknown>;
  /** Shallow dir listing under workspace (Files page). */
  listWorkspaceDir: (payload?: {
    path?: string;
    workspacePath?: string;
  }) => Promise<{
    ok?: boolean;
    path?: string;
    error?: string;
    entries?: WorkspaceDirEntry[];
  }>;
  /** System file dialog scoped to workspace; returns relative paths. */
  pickWorkspaceFiles: (payload?: {
    multi?: boolean;
    workspacePath?: string;
  }) => Promise<{
    ok?: boolean;
    cancelled?: boolean;
    paths?: string[];
    rejected?: string[];
  }>;
  runShell: (payload?: { command?: string; cwd?: string }) => Promise<unknown>;

  ptyCreate: (payload?: {
    cols?: number;
    rows?: number;
    cwd?: string | null;
    shell?: string | null;
    label?: string;
    workspacePath?: string | null;
  }) => Promise<PtySessionInfo>;
  ptyWrite: (payload: { id: string; data: string }) => Promise<unknown>;
  ptyResize: (payload: { id: string; cols: number; rows: number }) => Promise<unknown>;
  ptyKill: (payload: { id: string }) => Promise<unknown>;
  ptyList: () => Promise<{ sessions?: PtySessionInfo[] } | PtySessionInfo[]>;
  ptyShells: () => Promise<{ shells: AvailableShell[]; preferred: string }>;
  onPtyData: (handler: (data: { id: string; data: string }) => void) => () => void;
  onPtyExit: (handler: (data: { id: string; exitCode?: number; signal?: string }) => void) => () => void;

  getConfig: () => Promise<Record<string, unknown>>;
  setActiveModel: (payload: {
    providerId?: string;
    model?: string;
  }) => Promise<SetActiveModelResult | Record<string, unknown>>;
  upsertProvider: (payload: Record<string, unknown>) => Promise<unknown>;
  removeProvider: (payload: { id?: string; providerId?: string }) => Promise<unknown>;
  setPrefs: (payload: Record<string, unknown>) => Promise<unknown>;
  testModel: (payload?: Record<string, unknown>) => Promise<unknown>;
  /**
   * Remote / config model enumeration (soft-fail).
   * Workbench chips still come from config.providers[].models; this is for refresh/pick.
   */
  listProviderModels: (payload: {
    providerId: string;
  }) => Promise<ListProviderModelsResult>;

  createSession: (payload?: Record<string, unknown>) => Promise<SessionInfo>;
  getSession: (sessionId: string) => Promise<SessionInfo | null>;
  listSessions: (payload?: Record<string, unknown>) => Promise<{ sessions?: SessionInfo[] } | SessionInfo[]>;
  openSession: (payload: { sessionId: string } | string) => Promise<SessionSnapshot | SessionInfo>;
  getSessionSnapshot: (sessionId: string) => Promise<SessionSnapshot | null>;
  /** Backend expects `text` (not content). */
  sendMessage: (payload: { sessionId: string; text: string; [k: string]: unknown }) => Promise<unknown>;
  abortSession: (payload?: { sessionId?: string }) => Promise<unknown>;
  deleteSession: (payload: { sessionId: string }) => Promise<unknown>;
  renameSession: (payload: { sessionId: string; title: string }) => Promise<unknown>;
  setPlanMode: (payload: { sessionId: string; enabled: boolean }) => Promise<unknown>;
  getPlanMode: (payload: { sessionId: string }) => Promise<{ enabled?: boolean; planMode?: boolean }>;
  setPermissionMode: (payload: { sessionId: string; mode: string }) => Promise<unknown>;
  getPermissionMode: (payload: { sessionId: string }) => Promise<{ mode?: string; permissionMode?: string }>;
  listChildSessions: (payload: { sessionId: string }) => Promise<{ sessions?: SessionInfo[] } | SessionInfo[]>;
  listSpawnAttempts: (payload: { sessionId: string }) => Promise<{ attempts?: SpawnAttempt[] } | SpawnAttempt[]>;
  spawnSubagent: (payload: {
    sessionId: string;
    goal: string;
    profile?: string;
  }) => Promise<{ ok?: boolean; childSessionId?: string; summary?: string; error?: string; errorCode?: string }>;
  /** Backend expects `decision`: allow | deny | allow_session */
  resolvePermission: (payload: {
    requestId: string;
    decision: PermissionDecision;
    [k: string]: unknown;
  }) => Promise<{ ok?: boolean } | unknown>;
  revertChange: (payload: {
    sessionId?: string;
    changeId?: string;
    path?: string;
    kind?: string;
    before?: string;
    workspacePath?: string;
  }) => Promise<unknown>;
  writeChangeContent: (payload: {
    sessionId?: string;
    path: string;
    content: string;
    workspacePath?: string;
  }) => Promise<unknown>;

  gitStatus: (payload?: { includeLog?: boolean; maxEntries?: number }) => Promise<GitStatus>;
  gitDiff: (payload?: { path?: string; staged?: boolean }) => Promise<{ diff?: string; [k: string]: unknown }>;
  gitShow: (payload?: { object?: string; path?: string }) => Promise<unknown>;
  gitStage: (payload: { paths: string[] }) => Promise<unknown>;
  gitUnstage: (payload: { paths: string[] }) => Promise<unknown>;
  gitCommit: (payload: { message: string; paths?: string[] }) => Promise<unknown>;
  gitLog: (payload?: { max?: number }) => Promise<{ entries?: GitLogEntry[] } | GitLogEntry[]>;

  getAppPaths: () => Promise<AppPaths>;
  listSkills: (payload?: Record<string, unknown>) => Promise<unknown>;
  skillsCatalog: (payload?: Record<string, unknown>) => Promise<unknown>;
  installSkillFromDir: (payload?: Record<string, unknown>) => Promise<unknown>;
  installSkillFromPackage: (payload?: Record<string, unknown>) => Promise<unknown>;
  previewSkill: (payload?: Record<string, unknown>) => Promise<unknown>;
  getPolicyMatrix: (payload?: Record<string, unknown>) => Promise<unknown>;
  getSessionAllows: (payload?: Record<string, unknown>) => Promise<unknown>;
  grantSessionAllow: (payload?: Record<string, unknown>) => Promise<unknown>;
  revokeSessionAllow: (payload?: Record<string, unknown>) => Promise<unknown>;
  listMcp: () => Promise<unknown>;
  setMcpEnabled: (payload: Record<string, unknown>) => Promise<unknown>;
  connectMcp: (payload: Record<string, unknown>) => Promise<unknown>;
  disconnectMcp: (payload: Record<string, unknown>) => Promise<unknown>;
  upsertMcp: (payload: Record<string, unknown>) => Promise<unknown>;
  removeMcp: (payload: Record<string, unknown>) => Promise<unknown>;
  pingMcp: (payload?: Record<string, unknown>) => Promise<unknown>;

  listMemory: (payload?: Record<string, unknown>) => Promise<unknown>;
  searchMemory: (payload?: Record<string, unknown>) => Promise<unknown>;
  upsertMemory: (payload?: Record<string, unknown>) => Promise<unknown>;
  removeMemory: (payload?: Record<string, unknown>) => Promise<unknown>;
  usageSummary: () => Promise<unknown>;
  usageExport: () => Promise<{ dir?: string; files?: string[] }>;
  importScan: (payload?: Record<string, unknown>) => Promise<unknown>;
  importApply: (payload?: Record<string, unknown>) => Promise<unknown>;
  exportDiagnostics: () => Promise<unknown>;
  checkForUpdates: (payload?: Record<string, unknown>) => Promise<unknown>;
  downloadUpdate: (payload?: Record<string, unknown>) => Promise<unknown>;
  installUpdate: (payload?: {
    autoDownload?: boolean;
    confirm?: boolean;
  }) => Promise<InstallUpdateResult | unknown>;
  cancelUpdateDownload: () => Promise<unknown>;
  getUpdateDownloadStatus?: () => Promise<UpdateDownloadStatus | unknown>;
  onUpdateDownload?: (handler: (data: UpdateDownloadStatus | unknown) => void) => () => void;
  openReleasePage: (payload?: Record<string, unknown>) => Promise<unknown>;
  openExternal: (payload?: { url?: string }) => Promise<unknown>;
  revealInFolder: (payload?: { path?: string }) => Promise<unknown>;

  onSessionEvent: (handler: (data: SessionEvent) => void) => () => void;
  onWorkspaceChanged: (handler: (data: WorkspaceInfo) => void) => () => void;
  onUpdateAvailable: (handler: (data: unknown) => void) => () => void;
}

// ---------- identity helpers (F4) ----------

/** Safe read of session.model; backend guarantees key exists but may be "" for old transcripts. */
export function sessionModel(s: { model?: string | null } | null | undefined): string {
  return String(s?.model ?? "").trim();
}

/** Safe read of session.providerId. */
export function sessionProviderId(s: { providerId?: string | null } | null | undefined): string {
  return String(s?.providerId ?? "").trim();
}

/** True when session has no model AND no providerId bound (old transcript or empty state). */
export function sessionUnbound(s: { model?: string | null; providerId?: string | null } | null | undefined): boolean {
  return !sessionModel(s) && !sessionProviderId(s);
}

declare global {
  interface Window {
    hfq?: HfqApi;
  }
}

export function getHfq(): HfqApi {
  if (!window.hfq) {
    throw new Error("window.hfq is not available (preload missing?)");
  }
  return window.hfq;
}

export function hasHfq(): boolean {
  return typeof window !== "undefined" && !!window.hfq;
}

/** Normalize list endpoints that return either array or { sessions/attempts/... } */
export function asList<T>(value: unknown, keys: string[] = ["sessions", "items", "entries", "attempts"]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object" && "text" in (content as object)) {
    return String((content as { text?: unknown }).text ?? "");
  }
  if (content == null) return "";
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

/** Map IPC `{ workspacePath }` → UI `{ path, workspacePath }`. */
export function normalizeWorkspace(raw: unknown): WorkspaceInfo | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const workspacePath =
    (typeof o.workspacePath === "string" && o.workspacePath) ||
    (typeof o.path === "string" && o.path) ||
    null;
  const path = workspacePath;
  return {
    ...o,
    workspacePath,
    path,
    bound: Boolean(path),
    ok: o.ok !== false && Boolean(path),
  };
}

/** Prefer agent-core `text`, fall back to `content`. */
export function messageBody(msg: SessionMessage | Record<string, unknown> | null | undefined): string {
  if (!msg || typeof msg !== "object") return "";
  const m = msg as Record<string, unknown>;
  if (typeof m.text === "string" && m.text) return m.text;
  return messageText(m.content ?? m.text);
}

/** Normalize open/snapshot payloads from agent-core (`info` + uiMessages). */
export function normalizeSnapshot(raw: unknown): SessionSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as SessionSnapshot & Record<string, unknown>;
  const info = (o.info ?? o.session ?? null) as SessionInfo | null;
  const messages = Array.isArray(o.messages)
    ? o.messages
    : Array.isArray((o.state as { messages?: unknown } | undefined)?.messages)
      ? ((o.state as { messages: SessionMessage[] }).messages)
      : [];
  const changes = Array.isArray(o.changes)
    ? o.changes
    : Array.isArray((o.state as { changes?: unknown } | undefined)?.changes)
      ? ((o.state as { changes: SessionChange[] }).changes)
      : [];
  return {
    ...o,
    info: info ?? undefined,
    session: info ?? o.session,
    messages,
    changes,
  };
}
