import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ModelProvider } from "@hfq/providers";
import { createMockProvider } from "@hfq/providers";
import type { SessionEvent, SessionInfo } from "@hfq/shared";
import { JsonlTranscript } from "@hfq/transcript";
import { buildSessionSnapshot, type SessionSnapshot } from "./history.js";
import {
  AgentSession,
  type AgentSessionOptions,
  type PermissionHandler,
} from "./loop.js";
import { ensureDataDirs } from "./paths.js";
import {
  defaultBudget,
  formatSubagentSummary,
  type SubagentProfile,
} from "./subagent.js";
import type { PermissionMode } from "@hfq/policy";

export type PermissionDecision = "allow" | "deny" | "allow_session";

export interface CreateSessionParams {
  workspacePath: string;
  model?: string;
  provider?: ModelProvider;
  title?: string;
  bundledSkillsDir?: string;
  planMode?: boolean;
  permissionMode?: PermissionMode;
  memoryEnabled?: boolean;
  compactMaxChars?: number;
  parentSessionId?: string;
  subagentDepth?: number;
  subagentProfile?: SubagentProfile;
  maxRounds?: number;
  maxToolCalls?: number;
}

export interface OpenSessionParams {
  sessionId: string;
  workspacePath?: string;
  model?: string;
  provider?: ModelProvider;
  bundledSkillsDir?: string;
  planMode?: boolean;
  permissionMode?: PermissionMode;
  memoryEnabled?: boolean;
  compactMaxChars?: number;
}

export interface SessionManagerOptions {
  onEvent?: (event: SessionEvent) => void | Promise<void>;
  bundledSkillsDir?: string;
  sharedAgentsDir?: string;
  /** Inject live MCP (or other) tools into every session round. */
  getExtraTools?: AgentSessionOptions["getExtraTools"];
  /** Defaults applied to every new session when not overridden. */
  memoryEnabled?: boolean;
  compactMaxChars?: number;
}

interface PendingPermission {
  resolve: (decision: PermissionDecision) => void;
}

export class SessionManager {
  private readonly sessions = new Map<string, AgentSession>();
  private readonly pending = new Map<string, PendingPermission>();
  private readonly sendQueues = new Map<string, Promise<void>>();
  /** parentId → child session ids */
  private readonly children = new Map<string, Set<string>>();
  /** last provider/model used for spawn inheritance */
  private readonly sessionProviders = new Map<
    string,
    { provider: ModelProvider; model: string }
  >();

  constructor(private readonly opts: SessionManagerOptions = {}) {}

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => ({ ...s.info }));
  }

  listChildren(parentSessionId: string): SessionInfo[] {
    const ids = this.children.get(parentSessionId);
    if (!ids?.size) return [];
    return [...ids]
      .map((id) => this.sessions.get(id)?.info)
      .filter((x): x is SessionInfo => Boolean(x))
      .map((s) => ({ ...s }));
  }

  get(sessionId: string): SessionInfo | undefined {
    const s = this.sessions.get(sessionId);
    return s ? { ...s.info } : undefined;
  }

  getSnapshot(sessionId: string): SessionSnapshot | undefined {
    const s = this.sessions.get(sessionId);
    return s ? s.getSnapshot() : undefined;
  }

  /**
   * List sessions known in memory plus those on disk (JSONL).
   */
  async listAll(workspacePath?: string): Promise<SessionInfo[]> {
    const dirs = await ensureDataDirs();
    const ids = await JsonlTranscript.listSessionIds(dirs.sessions);
    const byId = new Map<string, SessionInfo>();

    for (const live of this.list()) {
      byId.set(live.id, live);
    }

    for (const id of ids) {
      if (byId.has(id)) continue;
      const tr = await JsonlTranscript.openExisting(dirs.sessions, id);
      if (!tr) continue;
      try {
        const events = await tr.readEvents();
        if (!events.length) continue;
        const snap = buildSessionSnapshot(events, { id });
        if (workspacePath && snap.info.workspacePath && snap.info.workspacePath !== workspacePath) {
          // still include; UI can filter
        }
        byId.set(id, snap.info);
      } catch {
        /* skip corrupt */
      }
    }

    return [...byId.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async create(params: CreateSessionParams): Promise<SessionInfo> {
    const workspacePath = path.resolve(params.workspacePath);
    const provider = params.provider ?? createMockProvider();
    const model = params.model ?? "mock-hfq";

    const sharedAgentsDir =
      this.opts.sharedAgentsDir ?? path.join(os.homedir(), ".agents", "skills");

    const onPermission: PermissionHandler = async (req) => {
      return new Promise<PermissionDecision>((resolve) => {
        this.pending.set(req.requestId, { resolve });
      });
    };

    const session = new AgentSession({
      workspacePath,
      provider,
      model,
      title: params.title,
      bundledSkillsDir: params.bundledSkillsDir ?? this.opts.bundledSkillsDir,
      sharedAgentsDir,
      getExtraTools: this.opts.getExtraTools,
      planMode: params.planMode,
      permissionMode: params.permissionMode,
      memoryEnabled: params.memoryEnabled ?? this.opts.memoryEnabled,
      compactMaxChars: params.compactMaxChars ?? this.opts.compactMaxChars,
      parentSessionId: params.parentSessionId,
      subagentDepth: params.subagentDepth,
      subagentProfile: params.subagentProfile,
      maxRounds: params.maxRounds,
      maxToolCalls: params.maxToolCalls,
      onSpawnSubagent: async ({ goal, profile, parentSessionId }) => {
        return this.spawnSubagent({
          parentSessionId,
          goal,
          profile,
          provider,
          model,
          workspacePath,
        });
      },
      onEvent: async (event) => {
        await this.opts.onEvent?.(event);
      },
      onPermission,
    });

    await session.init();
    if (params.title) {
      session.info.title = params.title;
    } else {
      session.info.title = path.basename(workspacePath) || "Session";
    }
    this.sessions.set(session.info.id, session);
    this.sessionProviders.set(session.info.id, { provider, model });
    if (params.parentSessionId) {
      const set = this.children.get(params.parentSessionId) ?? new Set();
      set.add(session.info.id);
      this.children.set(params.parentSessionId, set);
    }
    return { ...session.info };
  }

  /**
   * Spawn a child session, run a single goal turn, return summary for parent tool.
   */
  async spawnSubagent(params: {
    parentSessionId: string;
    goal: string;
    profile: SubagentProfile;
    provider?: ModelProvider;
    model?: string;
    workspacePath?: string;
  }): Promise<{ childSessionId: string; summary: string; ok: boolean; error?: string }> {
    const parent = this.sessions.get(params.parentSessionId);
    if (!parent) throw new Error(`unknown parent session: ${params.parentSessionId}`);
    const depth = parent.getSubagentDepth() + 1;
    if (depth > 2) {
      return {
        childSessionId: "",
        summary: "sub-agent depth exceeded",
        ok: false,
        error: "depth",
      };
    }
    const inherited = this.sessionProviders.get(params.parentSessionId);
    const provider = params.provider ?? inherited?.provider ?? createMockProvider();
    const model = params.model ?? inherited?.model ?? parent.info.model ?? "mock-hfq";
    const workspacePath = path.resolve(
      params.workspacePath || parent.info.workspacePath,
    );
    const budget = defaultBudget(params.profile, depth);
    const title = `子代理 · ${params.profile}: ${params.goal.slice(0, 40)}`;

    const childInfo = await this.create({
      workspacePath,
      provider,
      model,
      title,
      parentSessionId: params.parentSessionId,
      subagentDepth: depth,
      subagentProfile: params.profile,
      maxRounds: budget.maxRounds,
      maxToolCalls: budget.maxToolCalls,
      planMode: params.profile === "explore" ? false : undefined,
    });

    try {
      await this.send(
        childInfo.id,
        `You are a sub-agent (${params.profile}). Complete this goal and finish with a concise summary.\n\nGoal:\n${params.goal}`,
      );
      const snap = this.getSnapshot(childInfo.id);
      const lastAssistant = [...(snap?.messages || [])]
        .reverse()
        .find((m) => m.role === "assistant");
      const changePaths = (snap?.changes || []).map((c) => c.path);
      const summary = formatSubagentSummary({
        goal: params.goal,
        profile: params.profile,
        childSessionId: childInfo.id,
        assistantText: lastAssistant?.text,
        changePaths,
        ok: true,
      });
      return { childSessionId: childInfo.id, summary, ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const summary = formatSubagentSummary({
        goal: params.goal,
        profile: params.profile,
        childSessionId: childInfo.id,
        ok: false,
        error,
      });
      return { childSessionId: childInfo.id, summary, ok: false, error };
    }
  }

  setPlanMode(sessionId: string, enabled: boolean): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.setPlanMode(enabled);
    return true;
  }

  getPlanMode(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.getPlanMode() ?? false;
  }

  setPermissionMode(sessionId: string, mode: PermissionMode | string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.setPermissionMode(mode);
    return true;
  }

  getPermissionMode(sessionId: string): PermissionMode {
    return this.sessions.get(sessionId)?.getPermissionMode() ?? "confirm_before_change";
  }

  /**
   * Resume a session from JSONL into memory (or return live one).
   */
  async open(params: OpenSessionParams): Promise<SessionSnapshot> {
    const live = this.sessions.get(params.sessionId);
    if (live) return live.getSnapshot();

    const dirs = await ensureDataDirs();
    const tr = await JsonlTranscript.openExisting(dirs.sessions, params.sessionId);
    if (!tr) throw new Error(`unknown session: ${params.sessionId}`);
    const events = await tr.readEvents();
    const prelim = buildSessionSnapshot(events, { id: params.sessionId });
    const workspacePath = path.resolve(
      params.workspacePath || prelim.info.workspacePath || process.cwd(),
    );
    if (!prelim.info.workspacePath) {
      throw new Error("session has no workspace path");
    }

    const provider = params.provider ?? createMockProvider();
    const model = params.model ?? prelim.info.model ?? "mock-hfq";
    const sharedAgentsDir =
      this.opts.sharedAgentsDir ?? path.join(os.homedir(), ".agents", "skills");

    const onPermission: PermissionHandler = async (req) => {
      return new Promise<PermissionDecision>((resolve) => {
        this.pending.set(req.requestId, { resolve });
      });
    };

    const session = new AgentSession({
      sessionId: params.sessionId,
      workspacePath,
      provider,
      model,
      title: prelim.info.title,
      resume: true,
      bundledSkillsDir: params.bundledSkillsDir ?? this.opts.bundledSkillsDir,
      sharedAgentsDir,
      getExtraTools: this.opts.getExtraTools,
      planMode: params.planMode,
      permissionMode: params.permissionMode,
      memoryEnabled: params.memoryEnabled ?? this.opts.memoryEnabled,
      compactMaxChars: params.compactMaxChars ?? this.opts.compactMaxChars,
      onSpawnSubagent: async ({ goal, profile, parentSessionId }) => {
        return this.spawnSubagent({
          parentSessionId,
          goal,
          profile,
          provider,
          model,
          workspacePath,
        });
      },
      onEvent: async (event) => {
        await this.opts.onEvent?.(event);
      },
      onPermission,
    });

    const snap = await session.init();
    this.sessions.set(session.info.id, session);
    this.sessionProviders.set(session.info.id, { provider, model });
    return snap ?? session.getSnapshot();
  }

  /**
   * Resolve a permission.requested event from the UI.
   */
  resolvePermission(requestId: string, decision: PermissionDecision): boolean {
    const waiter = this.pending.get(requestId);
    if (!waiter) return false;
    this.pending.delete(requestId);
    waiter.resolve(decision);
    return true;
  }

  async send(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`unknown session: ${sessionId}`);

    const prev = this.sendQueues.get(sessionId) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(async () => {
        await session.sendUserMessage(text);
      });
    this.sendQueues.set(
      sessionId,
      next.catch(() => undefined),
    );
    await next;
  }

  /**
   * Cooperative abort of the current agent turn. Pending permission prompts are denied.
   */
  abort(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const ok = session.requestAbort();
    // Cascade to children
    const kids = this.children.get(sessionId);
    if (kids) {
      for (const childId of kids) {
        this.sessions.get(childId)?.requestAbort();
      }
    }
    // Unblock any waiters so the loop can observe abort.
    for (const [requestId, waiter] of this.pending) {
      this.pending.delete(requestId);
      waiter.resolve("deny");
    }
    return ok;
  }

  /**
   * Drop an in-memory session and delete its JSONL transcript.
   * Aborts a running turn first (permission waiters denied).
   */
  async delete(sessionId: string): Promise<{ ok: true; removedFile: boolean; wasLive: boolean }> {
    const live = this.sessions.get(sessionId);
    if (live) {
      this.abort(sessionId);
      this.sessions.delete(sessionId);
      this.sendQueues.delete(sessionId);
    }
    const dirs = await ensureDataDirs();
    const removedFile = await JsonlTranscript.delete(dirs.sessions, sessionId);
    return { ok: true, removedFile, wasLive: Boolean(live) };
  }

  /**
   * Rename a session. Live sessions use AgentSession.setTitle; offline appends session.meta to JSONL.
   */
  async rename(sessionId: string, title: string): Promise<SessionInfo> {
    const next = title.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!next) throw new Error("title required");

    const live = this.sessions.get(sessionId);
    if (live) return live.setTitle(next);

    const dirs = await ensureDataDirs();
    const tr = await JsonlTranscript.openExisting(dirs.sessions, sessionId);
    if (!tr) throw new Error(`unknown session: ${sessionId}`);
    const at = new Date().toISOString();
    await tr.append({
      type: "session.meta",
      sessionId,
      title: next,
      at,
    });
    const events = await tr.readEvents();
    const snap = buildSessionSnapshot(events, { id: sessionId, title: next });
    return { ...snap.info, title: next, updatedAt: at };
  }

  listSessionAllows(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? session.listSessionAllows() : [];
  }

  grantSessionAllow(sessionId: string, toolName: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`unknown session: ${sessionId}`);
    return session.grantSessionTool(toolName);
  }

  revokeSessionAllow(sessionId: string, toolName: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`unknown session: ${sessionId}`);
    return session.revokeSessionTool(toolName);
  }
}

export async function revertWorkspaceChange(params: {
  workspacePath: string;
  path: string;
  kind?: "create" | "modify" | "delete";
  before?: string;
}): Promise<{ ok: true; action: "deleted" | "restored" }> {
  const { resolveWorkspacePath } = await import("@hfq/tools");
  const full = resolveWorkspacePath(params.workspacePath, params.path);
  if (params.kind === "create" || (params.before === "" && params.kind !== "modify")) {
    await fs.rm(full, { force: true });
    return { ok: true, action: "deleted" };
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, params.before ?? "", "utf8");
  return { ok: true, action: "restored" };
}
