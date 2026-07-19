import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ModelProvider } from "@hfq/providers";
import { createMockProvider } from "@hfq/providers";
import type { SessionEvent, SessionInfo } from "@hfq/shared";
import { JsonlTranscript } from "@hfq/transcript";
import {
  buildSessionSnapshot,
  withSessionIdentityKeys,
  type SessionSnapshot,
} from "./history.js";
import {
  AgentSession,
  type AgentSessionOptions,
  type PermissionHandler,
} from "./loop.js";
import { deleteGoalsSidecar, upsertGoalFromEvent } from "./goals-store.js";
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
  /** Short goal text for sub-agent children. */
  goal?: string;
  maxRounds?: number;
  maxToolCalls?: number;
  /** Coding profile system addon (Kivio-style). */
  codingProfileAddon?: string;
  codingProfileSkillIds?: string[];
  skillMatch?: {
    enabled?: boolean;
    maxBodies?: number;
    maxBodyChars?: number;
  };
  /** Optional title model role (live provider + model id). */
  titleModelRole?: { provider?: ModelProvider; model?: string };
  compressionModelRole?: { provider?: ModelProvider; model?: string };
}

/** Parent-tree spawn attempt for Tasks observability (B3). */
export interface SubagentSpawnAttempt {
  attemptId: string;
  parentSessionId: string;
  childSessionId?: string;
  profile: SubagentProfile;
  goal: string;
  status: "started" | "completed" | "failed";
  error?: string;
  errorCode?: string;
  at: string;
  updatedAt: string;
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
  codingProfileAddon?: string;
  codingProfileSkillIds?: string[];
  skillMatch?: {
    enabled?: boolean;
    maxBodies?: number;
    maxBodyChars?: number;
  };
  titleModelRole?: { provider?: ModelProvider; model?: string };
  compressionModelRole?: { provider?: ModelProvider; model?: string };
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
  /** Owning session — abort/delete only denies waiters for that session (+ children). */
  sessionId: string;
}

export class SessionManager {
  private readonly sessions = new Map<string, AgentSession>();
  private readonly pending = new Map<string, PendingPermission>();
  private readonly sendQueues = new Map<string, Promise<void>>();
  /** parentId → child session ids */
  private readonly children = new Map<string, Set<string>>();
  /** parentId → spawn attempts (including failed before/without child) */
  private readonly spawnAttempts = new Map<string, SubagentSpawnAttempt[]>();
  /** last provider/model used for spawn inheritance */
  private readonly sessionProviders = new Map<
    string,
    { provider: ModelProvider; model: string }
  >();

  constructor(private readonly opts: SessionManagerOptions = {}) {}

  /**
   * Attach live access-mode fields for in-memory sessions only.
   * Disk-only (cold) rows omit permissionMode/planMode so UI can fall back
   * to getPermissionMode / prefs without treating a default as authoritative.
   */
  private withLiveAccessMode(info: SessionInfo): SessionInfo {
    const base = withSessionIdentityKeys(info);
    const live = this.sessions.get(base.id);
    if (!live) return base;
    const permissionMode = live.getPermissionMode();
    return {
      ...base,
      permissionMode,
      planMode: permissionMode === "plan" || live.getPlanMode(),
    };
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => this.withLiveAccessMode({ ...s.info }));
  }

  /**
   * Children of a parent session.
   * Live map first; always also merge disk JSONL via listAll
   * (`SessionInfo.parentSessionId`) so Tasks tree survives cold start.
   */
  async listChildren(parentSessionId: string): Promise<SessionInfo[]> {
    const parentId = String(parentSessionId ?? "").trim();
    if (!parentId) return [];

    const byId = new Map<string, SessionInfo>();
    const memIds = this.children.get(parentId);
    if (memIds?.size) {
      for (const id of memIds) {
        const live = this.sessions.get(id)?.info;
        if (live) byId.set(id, this.withLiveAccessMode({ ...live }));
      }
    }

    try {
      // Cold-start / partial map: scan all sessions by parentSessionId.
      const all = await this.listAll();
      for (const s of all) {
        if (s.parentSessionId !== parentId) continue;
        const prev = byId.get(s.id);
        // Prefer live memory fields when both exist; identity keys always present.
        // listAll already attaches live access modes when available.
        byId.set(s.id, prev ? { ...s, ...prev } : { ...s });
        const set = this.children.get(parentId) ?? new Set();
        set.add(s.id);
        this.children.set(parentId, set);
      }
    } catch {
      /* disk scan best-effort */
    }

    return [...byId.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  /**
   * Recent spawn attempts for a parent (success + failed), newest first.
   * Loads from `%data%/sessions/<parentId>.spawn-attempts.json` when memory is cold.
   */
  async listSpawnAttempts(parentSessionId: string): Promise<SubagentSpawnAttempt[]> {
    const parentId = String(parentSessionId ?? "").trim();
    if (!parentId) return [];
    const list = await this.loadSpawnAttempts(parentId);
    return list.map((a) => ({ ...a })).reverse();
  }

  private spawnAttemptsPath(sessionsDir: string, parentSessionId: string): string {
    // Keep beside JSONL transcripts; sanitize path segment.
    const safe = String(parentSessionId).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    return path.join(sessionsDir, `${safe}.spawn-attempts.json`);
  }

  private async loadSpawnAttempts(parentSessionId: string): Promise<SubagentSpawnAttempt[]> {
    if (this.spawnAttempts.has(parentSessionId)) {
      return this.spawnAttempts.get(parentSessionId) ?? [];
    }
    try {
      const dirs = await ensureDataDirs();
      const file = this.spawnAttemptsPath(dirs.sessions, parentSessionId);
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { attempts?: unknown })?.attempts)
          ? (parsed as { attempts: unknown[] }).attempts
          : [];
      const cleaned: SubagentSpawnAttempt[] = [];
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const a = item as Record<string, unknown>;
        const attemptId = String(a.attemptId ?? "").trim();
        const profile = a.profile;
        if (!attemptId) continue;
        if (profile !== "explore" && profile !== "edit" && profile !== "shell") continue;
        const status = a.status;
        if (status !== "started" && status !== "completed" && status !== "failed") continue;
        cleaned.push({
          attemptId,
          parentSessionId: String(a.parentSessionId ?? parentSessionId),
          childSessionId: a.childSessionId ? String(a.childSessionId) : undefined,
          profile,
          goal: String(a.goal ?? ""),
          status,
          error: a.error != null ? String(a.error) : undefined,
          errorCode: a.errorCode != null ? String(a.errorCode) : undefined,
          at: String(a.at ?? new Date().toISOString()),
          updatedAt: String(a.updatedAt ?? a.at ?? new Date().toISOString()),
        });
      }
      const capped = cleaned.slice(-50);
      this.spawnAttempts.set(parentSessionId, capped);
      return capped;
    } catch {
      this.spawnAttempts.set(parentSessionId, []);
      return [];
    }
  }

  private async persistSpawnAttempts(parentSessionId: string): Promise<void> {
    try {
      const dirs = await ensureDataDirs();
      const list = this.spawnAttempts.get(parentSessionId) ?? [];
      const file = this.spawnAttemptsPath(dirs.sessions, parentSessionId);
      await fs.writeFile(
        file,
        `${JSON.stringify({
          version: 1,
          parentSessionId,
          attempts: list,
        })}\n`,
        "utf8",
      );
    } catch {
      /* ignore disk errors — memory list still works this process */
    }
  }

  private async pushSpawnAttempt(attempt: SubagentSpawnAttempt): Promise<void> {
    await this.loadSpawnAttempts(attempt.parentSessionId);
    const list = this.spawnAttempts.get(attempt.parentSessionId) ?? [];
    list.push(attempt);
    if (list.length > 50) list.splice(0, list.length - 50);
    this.spawnAttempts.set(attempt.parentSessionId, list);
    await this.persistSpawnAttempts(attempt.parentSessionId);
  }

  private async updateSpawnAttempt(
    parentSessionId: string,
    attemptId: string,
    patch: Partial<SubagentSpawnAttempt>,
  ): Promise<SubagentSpawnAttempt | undefined> {
    await this.loadSpawnAttempts(parentSessionId);
    const list = this.spawnAttempts.get(parentSessionId);
    if (!list) return undefined;
    const idx = list.findIndex((a) => a.attemptId === attemptId);
    if (idx < 0) return undefined;
    const next = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    list[idx] = next;
    await this.persistSpawnAttempts(parentSessionId);
    return next;
  }

  private async emitParentSubagent(
    parent: AgentSession,
    event: Extract<SessionEvent, { type: "subagent.updated" }>,
  ): Promise<void> {
    // Best-effort: surface on parent event stream for UI without requiring a full transcript write API.
    await this.opts.onEvent?.(event);
    void parent;
  }

  get(sessionId: string): SessionInfo | undefined {
    const s = this.sessions.get(sessionId);
    return s ? this.withLiveAccessMode({ ...s.info }) : undefined;
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
      // list() already normalizes identity + live permissionMode/planMode.
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
        // UX1: always include model + providerId keys ("" if unknown).
        // Cold disk rows intentionally omit permissionMode/planMode.
        byId.set(id, withSessionIdentityKeys(snap.info));
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

    // Filled after AgentSession construction (id is known in constructor).
    const sessionIdRef = { id: "" };
    const onPermission: PermissionHandler = async (req) => {
      return new Promise<PermissionDecision>((resolve) => {
        this.pending.set(req.requestId, {
          resolve,
          sessionId: sessionIdRef.id,
        });
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
      goal: params.goal,
      maxRounds: params.maxRounds,
      maxToolCalls: params.maxToolCalls,
      codingProfileAddon: params.codingProfileAddon,
      codingProfileSkillIds: params.codingProfileSkillIds,
      skillMatch: params.skillMatch,
      titleModelRole: params.titleModelRole,
      compressionModelRole: params.compressionModelRole,
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
        if (event.type === "task.updated") {
          void upsertGoalFromEvent(event);
        }
        await this.opts.onEvent?.(event);
      },
      onPermission,
    });
    sessionIdRef.id = session.info.id;

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
    // UX1 + access mode: create return always exposes identity + live permission fields.
    return this.withLiveAccessMode({ ...session.info });
  }

  /**
   * Spawn a child session, run a single goal turn, return summary for parent tool.
   * Emits `subagent.updated` on the manager event bus for Tasks UI.
   */
  async spawnSubagent(params: {
    parentSessionId: string;
    goal: string;
    profile: SubagentProfile;
    provider?: ModelProvider;
    model?: string;
    workspacePath?: string;
  }): Promise<{
    childSessionId: string;
    summary: string;
    ok: boolean;
    error?: string;
    errorCode?: string;
  }> {
    const parent = this.sessions.get(params.parentSessionId);
    if (!parent) throw new Error(`unknown parent session: ${params.parentSessionId}`);
    const goal = String(params.goal ?? "").trim();
    const attemptId = `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const at = new Date().toISOString();
    const depth = parent.getSubagentDepth() + 1;

    const failEarly = async (
      error: string,
      errorCode: string,
      goalText: string = goal,
    ): Promise<{
      childSessionId: string;
      summary: string;
      ok: boolean;
      error?: string;
      errorCode?: string;
    }> => {
      // Persist failed attempts (depth / goal_required / …) so Tasks survives cold start.
      await this.pushSpawnAttempt({
        attemptId,
        parentSessionId: params.parentSessionId,
        profile: params.profile,
        goal: goalText,
        status: "failed",
        error,
        errorCode,
        at,
        updatedAt: at,
      });
      await this.emitParentSubagent(parent, {
        type: "subagent.updated",
        sessionId: params.parentSessionId,
        parentSessionId: params.parentSessionId,
        profile: params.profile,
        goal: goalText,
        status: "failed",
        error,
        errorCode,
        at,
      });
      return {
        childSessionId: "",
        summary: formatSubagentSummary({
          goal: goalText,
          profile: params.profile,
          childSessionId: "",
          ok: false,
          error,
        }),
        ok: false,
        error,
        errorCode,
      };
    };

    if (!goal) {
      return failEarly("goal required", "goal_required", "");
    }

    if (depth > 2) {
      return failEarly("sub-agent depth exceeded (max 2)", "depth");
    }

    await this.pushSpawnAttempt({
      attemptId,
      parentSessionId: params.parentSessionId,
      profile: params.profile,
      goal,
      status: "started",
      at,
      updatedAt: at,
    });
    await this.emitParentSubagent(parent, {
      type: "subagent.updated",
      sessionId: params.parentSessionId,
      parentSessionId: params.parentSessionId,
      profile: params.profile,
      goal,
      status: "started",
      at,
    });

    const inherited = this.sessionProviders.get(params.parentSessionId);
    const provider = params.provider ?? inherited?.provider ?? createMockProvider();
    const model = params.model ?? inherited?.model ?? parent.info.model ?? "mock-hfq";
    const workspacePath = path.resolve(
      params.workspacePath || parent.info.workspacePath,
    );
    const budget = defaultBudget(params.profile, depth);
    const title = `子代理 · ${params.profile}: ${goal.slice(0, 40)}`;

    let childInfo: SessionInfo;
    try {
      childInfo = await this.create({
        workspacePath,
        provider,
        model,
        title,
        parentSessionId: params.parentSessionId,
        subagentDepth: depth,
        subagentProfile: params.profile,
        goal,
        maxRounds: budget.maxRounds,
        maxToolCalls: budget.maxToolCalls,
        planMode: params.profile === "explore" ? false : undefined,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.updateSpawnAttempt(params.parentSessionId, attemptId, {
        status: "failed",
        error,
        errorCode: "create_failed",
      });
      await this.emitParentSubagent(parent, {
        type: "subagent.updated",
        sessionId: params.parentSessionId,
        parentSessionId: params.parentSessionId,
        profile: params.profile,
        goal,
        status: "failed",
        error,
        errorCode: "create_failed",
        at: new Date().toISOString(),
      });
      return {
        childSessionId: "",
        summary: formatSubagentSummary({
          goal,
          profile: params.profile,
          childSessionId: "",
          ok: false,
          error,
        }),
        ok: false,
        error,
        errorCode: "create_failed",
      };
    }

    await this.updateSpawnAttempt(params.parentSessionId, attemptId, {
      childSessionId: childInfo.id,
    });
    await this.emitParentSubagent(parent, {
      type: "subagent.updated",
      sessionId: params.parentSessionId,
      parentSessionId: params.parentSessionId,
      childSessionId: childInfo.id,
      profile: params.profile,
      goal,
      status: "started",
      at: new Date().toISOString(),
    });

    try {
      await this.send(
        childInfo.id,
        `You are a sub-agent (${params.profile}). Complete this goal and finish with a concise summary.\n\nGoal:\n${goal}`,
      );
      const snap = this.getSnapshot(childInfo.id);
      const lastAssistant = [...(snap?.messages || [])]
        .reverse()
        .find((m) => m.role === "assistant");
      const changePaths = (snap?.changes || []).map((c) => c.path);
      const summary = formatSubagentSummary({
        goal,
        profile: params.profile,
        childSessionId: childInfo.id,
        assistantText: lastAssistant?.text,
        changePaths,
        ok: true,
      });
      await this.updateSpawnAttempt(params.parentSessionId, attemptId, {
        status: "completed",
        childSessionId: childInfo.id,
      });
      await this.emitParentSubagent(parent, {
        type: "subagent.updated",
        sessionId: params.parentSessionId,
        parentSessionId: params.parentSessionId,
        childSessionId: childInfo.id,
        profile: params.profile,
        goal,
        status: "completed",
        at: new Date().toISOString(),
      });
      return { childSessionId: childInfo.id, summary, ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const summary = formatSubagentSummary({
        goal,
        profile: params.profile,
        childSessionId: childInfo.id,
        ok: false,
        error,
      });
      await this.updateSpawnAttempt(params.parentSessionId, attemptId, {
        status: "failed",
        childSessionId: childInfo.id,
        error,
        errorCode: "run_failed",
      });
      await this.emitParentSubagent(parent, {
        type: "subagent.updated",
        sessionId: params.parentSessionId,
        parentSessionId: params.parentSessionId,
        childSessionId: childInfo.id,
        profile: params.profile,
        goal,
        status: "failed",
        error,
        errorCode: "run_failed",
        at: new Date().toISOString(),
      });
      return {
        childSessionId: childInfo.id,
        summary,
        ok: false,
        error,
        errorCode: "run_failed",
      };
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
   * When provider/model are passed for an already-live session, rebind if different
   * so toolbar global active and live chat stay aligned after Models switch.
   */
  async open(params: OpenSessionParams): Promise<SessionSnapshot> {
    const live = this.sessions.get(params.sessionId);
    if (live) {
      if (params.provider && params.model?.trim()) {
        const wantModel = String(params.model).trim();
        const liveModel = live.getModel();
        const liveProviderId = live.getProviderId();
        const wantProviderId = params.provider.id;
        if (liveModel !== wantModel || liveProviderId !== wantProviderId) {
          try {
            await live.setProviderModel(params.provider, wantModel);
            this.sessionProviders.set(params.sessionId, {
              provider: params.provider,
              model: wantModel,
            });
          } catch (err) {
            // Busy session: keep live binding; UI still sees mismatch until idle rebind.
            void err;
          }
        }
      }
      return live.getSnapshot();
    }

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

    // Prefer explicit open params (global active) so resume after model switch
    // does not keep calling the old API with a stale model id.
    const provider = params.provider ?? createMockProvider();
    const model =
      (params.model && String(params.model).trim()) ||
      prelim.info.model ||
      "mock-hfq";
    const sharedAgentsDir =
      this.opts.sharedAgentsDir ?? path.join(os.homedir(), ".agents", "skills");

    const onPermission: PermissionHandler = async (req) => {
      return new Promise<PermissionDecision>((resolve) => {
        this.pending.set(req.requestId, {
          resolve,
          sessionId: params.sessionId,
        });
      });
    };

    const session = new AgentSession({
      sessionId: params.sessionId,
      workspacePath,
      provider,
      model,
      title: prelim.info.title,
      resume: true,
      // Restore sub-agent identity from transcript so listChildren/listAll stay consistent.
      parentSessionId: prelim.info.parentSessionId,
      subagentDepth: prelim.info.subagentDepth,
      subagentProfile: prelim.info.subagentProfile,
      goal: prelim.info.goal,
      bundledSkillsDir: params.bundledSkillsDir ?? this.opts.bundledSkillsDir,
      sharedAgentsDir,
      getExtraTools: this.opts.getExtraTools,
      planMode: params.planMode,
      permissionMode: params.permissionMode,
      memoryEnabled: params.memoryEnabled ?? this.opts.memoryEnabled,
      compactMaxChars: params.compactMaxChars ?? this.opts.compactMaxChars,
      codingProfileAddon: params.codingProfileAddon,
      codingProfileSkillIds: params.codingProfileSkillIds,
      skillMatch: params.skillMatch,
      titleModelRole: params.titleModelRole,
      compressionModelRole: params.compressionModelRole,
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
        if (event.type === "task.updated") {
          void upsertGoalFromEvent(event);
        }
        await this.opts.onEvent?.(event);
      },
      onPermission,
    });

    const snap = await session.init();
    this.sessions.set(session.info.id, session);
    this.sessionProviders.set(session.info.id, { provider, model });
    // Re-link parent→child map for Tasks after cold open.
    const parentId = session.info.parentSessionId;
    if (parentId) {
      const set = this.children.get(parentId) ?? new Set();
      set.add(session.info.id);
      this.children.set(parentId, set);
    }
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
   * Cooperative abort of the current agent turn.
   * Denies pending permission waiters for this session and its live children only
   * (does not steal another session's modal queue).
   * Returns true if the session exists (waiters cleared even when already idle).
   */
  abort(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.requestAbort();
    // Cascade to children
    const kids = this.children.get(sessionId);
    if (kids) {
      for (const childId of kids) {
        this.sessions.get(childId)?.requestAbort();
      }
    }
    this.denyPendingForSessions(this.sessionTreeIds(sessionId));
    return true;
  }

  /** Live session id + known child ids (memory map only). */
  private sessionTreeIds(rootId: string): Set<string> {
    const ids = new Set<string>([rootId]);
    const kids = this.children.get(rootId);
    if (kids) {
      for (const c of kids) ids.add(c);
    }
    return ids;
  }

  /** Deny + drop waiters owned by any of the given session ids. */
  private denyPendingForSessions(sessionIds: Set<string>): void {
    for (const [requestId, waiter] of this.pending) {
      if (!sessionIds.has(waiter.sessionId)) continue;
      this.pending.delete(requestId);
      waiter.resolve("deny");
    }
  }

  /**
   * Drop an in-memory session and delete its JSONL transcript.
   * Also clears spawn-attempts sidecar, parent→child map links, and provider cache
   * so Tasks / listChildren do not keep ghost rows after delete.
   * Aborts a running turn first (permission waiters denied).
   */
  async delete(sessionId: string): Promise<{ ok: true; removedFile: boolean; wasLive: boolean }> {
    const id = String(sessionId ?? "").trim();
    if (!id) return { ok: true, removedFile: false, wasLive: false };

    const live = this.sessions.get(id);
    const parentId = live?.info.parentSessionId
      ? String(live.info.parentSessionId).trim()
      : "";

    if (live) {
      this.abort(id);
      this.sessions.delete(id);
      this.sendQueues.delete(id);
    }
    this.sessionProviders.delete(id);

    // Unlink from parent's children set (live map).
    if (parentId) {
      const set = this.children.get(parentId);
      if (set) {
        set.delete(id);
        if (!set.size) this.children.delete(parentId);
      }
    }
    // Drop this id as a parent of any in-memory children links.
    this.children.delete(id);

    // Drop in-memory spawn attempts for this parent id.
    this.spawnAttempts.delete(id);

    const dirs = await ensureDataDirs();
    const removedFile = await JsonlTranscript.delete(dirs.sessions, id);

    // Remove durable attempts sidecar (best-effort).
    try {
      await fs.unlink(this.spawnAttemptsPath(dirs.sessions, id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        /* ignore other disk errors — transcript already handled */
      }
    }

    // Remove goals sidecar (1.1.6 Goal tree cold-start).
    await deleteGoalsSidecar(id);

    return { ok: true, removedFile, wasLive: Boolean(live) };
  }

  /**
   * Hot-swap provider/model on a live session (Models setActive / open with new default).
   */
  async setProviderModel(
    sessionId: string,
    provider: ModelProvider,
    model: string,
  ): Promise<SessionInfo> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`unknown session: ${sessionId}`);
    const info = await session.setProviderModel(provider, model);
    this.sessionProviders.set(sessionId, { provider, model: info.model || model });
    return this.withLiveAccessMode({ ...info });
  }

  async rename(sessionId: string, title: string): Promise<SessionInfo> {
    const next = title.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!next) throw new Error("title required");

    const live = this.sessions.get(sessionId);
    if (live) return this.withLiveAccessMode({ ...(await live.setTitle(next)) });

    const dirs = await ensureDataDirs();
    const tr = await JsonlTranscript.openExisting(dirs.sessions, sessionId);
    if (!tr) throw new Error(`unknown session: ${sessionId}`);
    const at = new Date().toISOString();
    const priorEvents = await tr.readEvents();
    const prior = buildSessionSnapshot(priorEvents, { id: sessionId });
    // Preserve identity on offline rename so listSessions keeps model/providerId.
    await tr.append({
      type: "session.meta",
      sessionId,
      title: next,
      model: prior.info.model || undefined,
      providerId: prior.info.providerId || undefined,
      at,
    });
    const events = await tr.readEvents();
    const snap = buildSessionSnapshot(events, { id: sessionId, title: next });
    return withSessionIdentityKeys({ ...snap.info, title: next, updatedAt: at });
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
