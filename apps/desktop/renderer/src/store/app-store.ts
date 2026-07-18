import { create } from "zustand";
import { toast } from "sonner";
import {
  asList,
  getHfq,
  hasHfq,
  messageBody,
  messageText,
  normalizeSnapshot,
  normalizeWorkspace,
  sessionModel,
  sessionProviderId,
  type AppInfo,
  type AppPaths,
  type PermissionDecision,
  type PermissionRequest,
  type SessionChange,
  type SessionInfo,
  type SessionMessage,
  type UiTask,
  type WorkspaceInfo,
} from "@/lib/hfq";

interface AppState {
  ready: boolean;
  error: string | null;
  info: AppInfo | null;
  bootRoute: string | null;
  workspace: WorkspaceInfo | null;
  paths: AppPaths | null;
  sessions: SessionInfo[];
  activeSessionId: string | null;
  messages: SessionMessage[];
  changes: SessionChange[];
  running: boolean;
  streamingText: string;
  /** Live CoT buffer for thinking.delta (paired messageId). */
  streamingThinking: string;
  streamingThinkingId: string | null;
  /** Permission modal queue — supports multi-session, FIFO, requestId matching. */
  pendingPermissions: PermissionRequest[];
  /** Active session permission mode (main.cjs setPermissionMode). */
  permissionMode: string;
  planMode: boolean;
  statusLine: string;
  /** F1 goal driver tasks for active session (from snapshot / task.updated). */
  tasks: UiTask[];
  /** Prefill for Chat composer (e.g. Changes「让智能体修」); consumed once by ChatView. */
  composerDraft: string | null;

  bootstrap: () => Promise<void>;
  consumeBootRoute: () => string | null;
  refreshSessions: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  createSession: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  abortSession: () => Promise<void>;
  resolvePermission: (allow: boolean, remember?: boolean) => Promise<void>;
  setSessionPermissionMode: (mode: string) => Promise<void>;
  setComposerDraft: (text: string | null) => void;
  consumeComposerDraft: () => string | null;
  applySessionEvent: (ev: Record<string, unknown>) => void;
}

function normalizeMessages(raw: unknown): SessionMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m, i) => {
    const msg = m as SessionMessage & Record<string, unknown>;
    const body = messageBody(msg);
    const role = String(msg.role ?? "assistant");
    const createdAt =
      typeof msg.createdAt === "string"
        ? msg.createdAt
        : typeof msg.at === "string"
          ? msg.at
          : undefined;
    const toolName =
      typeof msg.toolName === "string"
        ? msg.toolName
        : typeof msg.name === "string"
          ? msg.name
          : undefined;
    const thinking =
      role === "thinking" ||
      msg.thinking === true ||
      Boolean((msg as { thinking?: boolean }).thinking);
    return {
      ...msg,
      id: String(msg.id ?? msg.messageId ?? msg.callId ?? `m-${i}`),
      role: thinking ? "thinking" : role,
      text: typeof msg.text === "string" ? msg.text : body,
      content: body,
      toolName,
      thinking: thinking || undefined,
      createdAt,
    } as SessionMessage;
  });
}

function normalizeChanges(raw: unknown): SessionChange[] {
  const list = asList<SessionChange>(raw, ["changes", "items"]);
  return list.map((c, i) => ({
    ...c,
    id: c.id ?? c.path ?? `chg-${i}`,
    path: String(c.path ?? ""),
    kind: c.kind,
    status: c.status ?? c.kind,
  }));
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Live agent turn — keeps stop button / streaming chrome. */
function isLiveSessionStatus(status: unknown): boolean {
  const s = String(status ?? "").toLowerCase();
  return (
    s === "running" ||
    s === "streaming" ||
    s === "busy" ||
    s === "waiting_permission" ||
    s === "active"
  );
}

function patchSessionStatus(
  sessions: SessionInfo[],
  sessionId: string | null | undefined,
  status: string,
): SessionInfo[] {
  return patchSessionFields(sessions, sessionId, { status });
}

const EMPTY_PROVIDER_MSG = "尚未配置模型渠道，请到模型页添加";

function isEmptyProviderError(msg: string): boolean {
  return /no model provider|no provider|not configured|providers?\s*(empty|required)|empty providers?/i.test(
    msg,
  );
}

function humanizeProviderError(msg: string): string {
  return isEmptyProviderError(msg) ? EMPTY_PROVIDER_MSG : msg;
}

/** Merge identity/status fields into sessions[] (model must stay in sync with open/rebind). */
function patchSessionFields(
  sessions: SessionInfo[],
  sessionId: string | null | undefined,
  patch: Partial<SessionInfo> & Record<string, unknown>,
): SessionInfo[] {
  if (!sessionId) return sessions;
  let hit = false;
  const next = sessions.map((s) => {
    if (s.id !== sessionId) return s;
    hit = true;
    const merged: SessionInfo = {
      ...s,
      ...patch,
      updatedAt:
        typeof patch.updatedAt === "string"
          ? patch.updatedAt
          : new Date().toISOString(),
    };
    // Empty string model/provider from backend means "cleared" — keep it, don't keep stale.
    if ("model" in patch) {
      const m = patch.model;
      merged.model =
        m == null || String(m).trim() === "" ? undefined : String(m).trim();
    }
    if ("providerId" in patch) {
      const p = patch.providerId;
      merged.providerId =
        p == null || String(p).trim() === "" ? undefined : String(p).trim();
    }
    if ("status" in patch && patch.status != null) {
      merged.status = String(patch.status);
    }
    if ("parentSessionId" in patch) {
      const p = patch.parentSessionId;
      merged.parentSessionId =
        p == null || String(p).trim() === "" ? null : String(p).trim();
    }
    if ("goal" in patch) {
      const g = patch.goal;
      merged.goal =
        g == null || String(g).trim() === "" ? null : String(g).trim();
    }
    if ("subagentProfile" in patch) {
      const p = patch.subagentProfile;
      merged.subagentProfile =
        p == null || String(p).trim() === "" ? null : String(p).trim();
    }
    if ("subagentDepth" in patch) {
      const d = patch.subagentDepth;
      merged.subagentDepth =
        d == null || Number.isNaN(Number(d)) ? undefined : Number(d);
    }
    return merged;
  });
  return hit ? next : sessions;
}

type SessionIdentityPatch = {
  model?: string;
  providerId?: string;
  status?: string;
  parentSessionId?: string | null;
  goal?: string | null;
  subagentProfile?: string | null;
  subagentDepth?: number;
};

/** Extract model/provider + subagent fields from open/snapshot info or session.meta events. */
function sessionIdentityFrom(
  source: Record<string, unknown> | SessionInfo | null | undefined,
): SessionIdentityPatch {
  if (!source) return {};
  const rec = source as Record<string, unknown>;
  const nested =
    rec.info && typeof rec.info === "object"
      ? (rec.info as Record<string, unknown>)
      : rec.session && typeof rec.session === "object"
        ? (rec.session as Record<string, unknown>)
        : null;
  const modelRaw = rec.model ?? nested?.model;
  const providerRaw =
    rec.providerId ??
    rec.provider ??
    nested?.providerId ??
    nested?.provider;
  const statusRaw = rec.status ?? nested?.status;
  const parentRaw = rec.parentSessionId ?? nested?.parentSessionId;
  const goalRaw = rec.goal ?? nested?.goal;
  const profileRaw = rec.subagentProfile ?? nested?.subagentProfile;
  const depthRaw = rec.subagentDepth ?? nested?.subagentDepth;
  const out: SessionIdentityPatch = {};
  if (modelRaw != null) out.model = String(modelRaw).trim();
  if (providerRaw != null) out.providerId = String(providerRaw).trim();
  if (statusRaw != null) out.status = String(statusRaw);
  if (parentRaw != null) {
    const p = String(parentRaw).trim();
    out.parentSessionId = p || null;
  }
  if (goalRaw != null) {
    const g = String(goalRaw).trim();
    out.goal = g || null;
  }
  if (profileRaw != null) {
    const p = String(profileRaw).trim();
    out.subagentProfile = p || null;
  }
  if (depthRaw != null && depthRaw !== "") {
    const n = Number(depthRaw);
    if (!Number.isNaN(n)) out.subagentDepth = n;
  }
  return out;
}

/** Prefer list values; keep previously known subagent / model identity when list omits them. */
function mergeSessionListItem(
  prev: SessionInfo | undefined,
  listed: SessionInfo,
): SessionInfo {
  if (!prev) return listed;
  const listModel = listed.model != null ? String(listed.model).trim() : "";
  const listProvider =
    listed.providerId != null ? String(listed.providerId).trim() : "";
  const listParent =
    listed.parentSessionId != null
      ? String(listed.parentSessionId).trim()
      : "";
  const listGoal = listed.goal != null ? String(listed.goal).trim() : "";
  const listProfile =
    listed.subagentProfile != null
      ? String(listed.subagentProfile).trim()
      : "";
  const listDepth =
    listed.subagentDepth != null && listed.subagentDepth !== ("" as unknown)
      ? Number(listed.subagentDepth)
      : NaN;
  const listPermMode = String(listed.permissionMode ?? "").trim();
  return {
    ...prev,
    ...listed,
    model: listModel || prev.model,
    providerId: listProvider || prev.providerId,
    parentSessionId: listParent || prev.parentSessionId || null,
    goal: listGoal || prev.goal || null,
    subagentProfile: listProfile || prev.subagentProfile || null,
    subagentDepth: !Number.isNaN(listDepth)
      ? listDepth
      : prev.subagentDepth,
    permissionMode: listPermMode || prev.permissionMode,
    planMode:
      listed.planMode !== undefined
        ? listed.planMode
        : prev.planMode,
  };
}

/** Poll snapshot if UI still thinks a turn is live (heals missed session.completed). */
let runningReconcileTimer: number | null = null;

function clearRunningReconcile() {
  if (runningReconcileTimer != null) {
    window.clearTimeout(runningReconcileTimer);
    runningReconcileTimer = null;
  }
}

function scheduleRunningReconcile(get: () => AppState, set: (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void) {
  clearRunningReconcile();
  runningReconcileTimer = window.setTimeout(() => {
    runningReconcileTimer = null;
    void (async () => {
      const { running, activeSessionId } = get();
      if (!running || !activeSessionId || !hasHfq()) return;
      try {
        const snap = normalizeSnapshot(await getHfq().getSessionSnapshot(activeSessionId));
        const status = snap?.info?.status ?? snap?.session?.status;
        if (status != null && !isLiveSessionStatus(status)) {
          set((s) => ({
            running: false,
            streamingText: "",
            streamingThinking: "",
            streamingThinkingId: null,
            sessions: patchSessionStatus(s.sessions, activeSessionId, String(status) || "idle"),
          }));
          return;
        }
        // Still live (or unknown) — check again later while flag stays true
        if (get().running) scheduleRunningReconcile(get, set);
      } catch {
        if (get().running) scheduleRunningReconcile(get, set);
      }
    })();
  }, 2500);
}

function markTurnLive(
  set: (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
  sessionId?: string | null,
) {
  const id = sessionId || get().activeSessionId;
  set((s) => ({
    running: true,
    sessions: patchSessionStatus(s.sessions, id, "running"),
  }));
  scheduleRunningReconcile(get, set);
}

function markTurnIdle(
  set: (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  sessionId?: string | null,
  status = "idle",
) {
  clearRunningReconcile();
  set((s) => ({
    running: false,
    streamingText: "",
    streamingThinking: "",
    streamingThinkingId: null,
    sessions: patchSessionStatus(s.sessions, sessionId || s.activeSessionId, status),
  }));
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  info: null,
  bootRoute: null,
  workspace: null,
  paths: null,
  sessions: [],
  activeSessionId: null,
  messages: [],
  changes: [],
  running: false,
  streamingText: "",
  streamingThinking: "",
  streamingThinkingId: null,
  pendingPermissions: [],
  permissionMode: "confirm_before_change",
  planMode: false,
  statusLine: "Starting…",
  tasks: [],
  composerDraft: null,

  consumeBootRoute: () => {
    const r = get().bootRoute;
    if (r) set({ bootRoute: null });
    return r;
  },

  setComposerDraft: (text) => {
    const t = text == null ? null : String(text);
    set({ composerDraft: t && t.trim() ? t : null });
  },

  consumeComposerDraft: () => {
    const d = get().composerDraft;
    if (d) set({ composerDraft: null });
    return d;
  },

  bootstrap: async () => {
    if (!hasHfq()) {
      set({
        ready: true,
        error: "window.hfq unavailable — open via Electron shell",
        statusLine: "No IPC",
      });
      return;
    }
    const hfq = getHfq();
    const alreadyReady = get().ready;
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        p.then(
          (v) => v,
          () => null,
        ),
        new Promise<null>((r) => window.setTimeout(() => r(null), ms)),
      ]);
    try {
      const [info, workspaceRaw, paths] = await Promise.all([
        withTimeout(hfq.getInfo(), 5000),
        withTimeout(hfq.getWorkspace(), 3000),
        withTimeout(hfq.getAppPaths(), 3000),
      ]);
      const workspace = normalizeWorkspace(workspaceRaw);
      const bootRoute =
        typeof (info as { bootRoute?: unknown } | null)?.bootRoute === "string"
          ? String((info as { bootRoute?: string }).bootRoute).replace(/^\/+/, "")
          : null;
      set({
        info: info ?? get().info ?? { version: "?", name: "HFQ Code" },
        bootRoute: alreadyReady ? get().bootRoute : bootRoute || get().bootRoute,
        workspace: workspace ?? get().workspace,
        paths: paths ?? get().paths,
        statusLine:
          (workspace ?? get().workspace)?.path
            ? String((workspace ?? get().workspace)?.path)
            : "No workspace",
      });
      await withTimeout(get().refreshSessions(), 4000);

      // Subscribe once on first boot.
      if (!alreadyReady) {
        hfq.onWorkspaceChanged((ws) => {
          const next = normalizeWorkspace(ws);
          set({
            workspace: next,
            statusLine: next?.path ? String(next.path) : "No workspace",
          });
        });

        hfq.onSessionEvent((ev) => {
          get().applySessionEvent(ev as Record<string, unknown>);
        });
      }
    } catch (e) {
      set({
        error: errMessage(e),
        statusLine: alreadyReady ? get().statusLine : "Bootstrap failed",
      });
    } finally {
      // Always leave splash — never block chrome paint on IPC.
      set({ ready: true });
    }

    // Auto-open most recent session after first paint only.
    if (!alreadyReady) {
      const list = get().sessions;
      if (list[0]?.id) {
        void get()
          .selectSession(list[0].id)
          .catch(() => null);
      }
    }
  },

  refreshSessions: async () => {
    if (!hasHfq()) return;
    const hfq = getHfq();
    const raw = await hfq.listSessions({});
    const listed = asList<SessionInfo>(raw).sort((a, b) => {
      const ta = Date.parse(a.updatedAt ?? a.createdAt ?? "") || 0;
      const tb = Date.parse(b.updatedAt ?? b.createdAt ?? "") || 0;
      return tb - ta;
    });
    // Always write model/providerId (even "") so identity is never null/undefined.
    // backend commit edb991f guarantees keys exist; "" means unbound.
    const prevById = new Map(get().sessions.map((s) => [s.id, s]));
    const sessions = listed.map((s) => {
      const merged = mergeSessionListItem(prevById.get(s.id), s);
      return {
        ...merged,
        model: sessionModel(merged),
        providerId: sessionProviderId(merged),
      };
    });
    set({ sessions });
  },

  openWorkspace: async () => {
    try {
      const hfq = getHfq();
      const raw = await hfq.openWorkspace();
      const ws = normalizeWorkspace(raw);
      // User cancelled dialog → ok:false, keep previous if any.
      if (raw && (raw as { ok?: boolean }).ok === false && !ws?.path) {
        return;
      }
      set({
        workspace: ws,
        statusLine: ws?.path ? String(ws.path) : "No workspace",
      });
      if (ws?.path) {
        toast.success("工作区已绑定");
        await get().refreshSessions();
      }
    } catch (e) {
      const msg = errMessage(e);
      set({ error: msg });
      toast.error(msg);
    }
  },

  createSession: async () => {
    const { workspace, info } = get();
    if (!workspace?.path) {
      toast.error("请先打开工作区");
      await get().openWorkspace();
      if (!get().workspace?.path) return;
    }
    const activeProvider = String(info?.activeProviderId ?? "").trim();
    const activeModel = String(info?.activeModel ?? "").trim();
    if (!activeProvider || !activeModel) {
      set({ error: EMPTY_PROVIDER_MSG });
      toast.error(EMPTY_PROVIDER_MSG);
      throw new Error(EMPTY_PROVIDER_MSG);
    }
    try {
      const hfq = getHfq();
      const session = await hfq.createSession({});
      await get().refreshSessions();
      if (session?.id) {
        await get().selectSession(session.id);
      }
    } catch (e) {
      const msg = humanizeProviderError(errMessage(e));
      set({ error: msg });
      toast.error(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
  },

  selectSession: async (sessionId) => {
    const hfq = getHfq();
    clearRunningReconcile();
    // Clear permission queue for the old session when switching.
    const { activeSessionId, pendingPermissions } = get();
    if (activeSessionId && activeSessionId !== sessionId) {
      set((s) => ({
        pendingPermissions: s.pendingPermissions.filter(
          (p) => String(p.sessionId ?? "") !== activeSessionId,
        ),
      }));
    }
    set({
      activeSessionId: sessionId,
      streamingText: "",
      streamingThinking: "",
      streamingThinkingId: null,
      running: false,
      messages: [],
      changes: [],
      tasks: [],
      pendingPermissions: [],
      permissionMode: "confirm_before_change",
      planMode: false,
    });
    try {
      // Prefer open (loads + activates); fall back to snapshot.
      const opened = await Promise.race([
        hfq.openSession({ sessionId }),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 6000)),
      ]);
      let snap = normalizeSnapshot(opened);
      if (!snap || !snap.messages) {
        const fallback = await Promise.race([
          hfq.getSessionSnapshot(sessionId),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4000)),
        ]);
        snap = normalizeSnapshot(fallback) ?? snap;
      }
      if (!snap) return;

      const messages = normalizeMessages(snap.messages);
      const changes = normalizeChanges(snap.changes);
      const info = snap.info ?? snap.session;
      const running = isLiveSessionStatus(info?.status);

      // Sync workspace if session carries one.
      if (info?.workspacePath) {
        const ws = normalizeWorkspace({ workspacePath: info.workspacePath, ok: true });
        if (ws?.path) {
          set({
            workspace: ws,
            statusLine: String(ws.path),
          });
        }
      }

      const snapRec = snap as Record<string, unknown>;
      const infoRec = (info ?? {}) as Record<string, unknown>;
      const modeRaw =
        snapRec.permissionMode ??
        infoRec.permissionMode ??
        (infoRec.planMode || snapRec.planMode ? "plan" : null);
      const plan =
        typeof infoRec.planMode === "boolean"
          ? infoRec.planMode
          : typeof snapRec.planMode === "boolean"
            ? snapRec.planMode
            : modeRaw === "plan";
      const permissionMode =
        typeof modeRaw === "string" && modeRaw
          ? String(modeRaw)
          : plan
            ? "plan"
            : "confirm_before_change";

      const identity = sessionIdentityFrom(
        (info as SessionInfo | undefined) ??
          (snapRec as Record<string, unknown>),
      );
      const nextStatus =
        identity.status ||
        String(info?.status ?? (running ? "running" : "idle"));

      // Normalize F1 goal tasks from snapshot (authoritative for this session).
      const snapTasks = asList<UiTask>(snap.tasks ?? (snap as Record<string, unknown>).tasks, [
        "tasks",
        "items",
      ])
        .map((t) => ({
          ...t,
          taskId: String(t.taskId ?? (t as { id?: string }).id ?? "").trim(),
          title: String(t.title ?? t.objective ?? "").trim(),
          status: String(t.status ?? "pending"),
          kind: t.kind != null ? String(t.kind) : undefined,
          progress:
            t.progress != null && Number.isFinite(Number(t.progress))
              ? Math.max(0, Math.min(100, Number(t.progress)))
              : undefined,
          updatedAt: t.updatedAt
            ? String(t.updatedAt)
            : (t as { at?: string }).at
              ? String((t as { at?: string }).at)
              : undefined,
        }))
        .filter((t) => t.taskId && t.title);

      set((s) => ({
        messages,
        changes,
        running: Boolean(running),
        permissionMode,
        planMode: Boolean(plan),
        streamingThinking: "",
        streamingThinkingId: null,
        // Always replace — empty snapshot must not keep previous session's goals.
        tasks: snapTasks,
        // open/snapshot is authoritative for model + subagent identity.
        sessions: patchSessionFields(s.sessions, sessionId, {
          status: nextStatus,
          ...(identity.model !== undefined ? { model: identity.model } : {}),
          ...(identity.providerId !== undefined
            ? { providerId: identity.providerId }
            : {}),
          ...(identity.parentSessionId !== undefined
            ? { parentSessionId: identity.parentSessionId }
            : {}),
          ...(identity.goal !== undefined ? { goal: identity.goal } : {}),
          ...(identity.subagentProfile !== undefined
            ? { subagentProfile: identity.subagentProfile }
            : {}),
          ...(identity.subagentDepth !== undefined
            ? { subagentDepth: identity.subagentDepth }
            : {}),
        }),
      }));
      if (running) scheduleRunningReconcile(get, set);
      else clearRunningReconcile();

      // Consume permissionMode/planMode from session:list enrichment if available,
      // avoiding an extra getPermissionMode IPC round-trip.
      const listPermMode = String(
        (info as SessionInfo | null)?.permissionMode ?? "",
      ).trim();
      if (listPermMode) {
        set({
          permissionMode: listPermMode,
          planMode: listPermMode === "plan",
        });
      } else {
        void (async () => {
          try {
            const r = await hfq.getPermissionMode({ sessionId });
            const live =
              (r as { permissionMode?: string; mode?: string })?.permissionMode ||
              (r as { mode?: string })?.mode;
            if (live) {
              set({
                permissionMode: String(live),
                planMode: String(live) === "plan",
              });
            }
          } catch {
            /* optional */
          }
        })();
      }
    } catch (e) {
      set({
        error: errMessage(e),
        messages: [],
        changes: [],
      });
    }
  },

  deleteSession: async (sessionId) => {
    const hfq = getHfq();
    await hfq.deleteSession({ sessionId });
    const { activeSessionId } = get();
    if (activeSessionId === sessionId) {
      set({
        activeSessionId: null,
        messages: [],
        changes: [],
        running: false,
        streamingText: "",
        streamingThinking: "",
        streamingThinkingId: null,
      });
    }
    await get().refreshSessions();
  },

  renameSession: async (sessionId, title) => {
    const hfq = getHfq();
    await hfq.renameSession({ sessionId, title });
    await get().refreshSessions();
  },

  sendMessage: async (content) => {
    const text = content.trim();
    if (!text) return;

    const hfq = getHfq();
    let { activeSessionId, workspace, info } = get();

    if (!workspace?.path) {
      toast.error("请先打开工作区");
      await get().openWorkspace();
      workspace = get().workspace;
      if (!workspace?.path) return;
    }

    // Fail-closed when no active provider/model (matches createSession + empty providers product decision).
    const globalModel = String(info?.activeModel ?? "").trim();
    const globalProvider = String(info?.activeProviderId ?? "").trim();
    if (!globalModel || !globalProvider) {
      set({ error: EMPTY_PROVIDER_MSG });
      toast.error(EMPTY_PROVIDER_MSG);
      return;
    }

    try {
      if (!activeSessionId) {
        const session = await hfq.createSession({});
        activeSessionId = session.id;
        set({ activeSessionId });
        await get().refreshSessions();
      }
      if (!activeSessionId) return;

      // Backend rebinds session → global active on each send; pin UI identity early.
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: `local-${Date.now()}`,
            role: "user",
            text,
            content: text,
            createdAt: new Date().toISOString(),
          },
        ],
        running: true,
        streamingText: "",
        streamingThinking: "",
        streamingThinkingId: null,
        error: null,
        sessions: patchSessionFields(s.sessions, activeSessionId, {
          status: "running",
          model: globalModel,
          providerId: globalProvider,
        }),
      }));
      scheduleRunningReconcile(get, set);

      // IPC contract: payload.text (main.cjs session:send) — returns before turn ends
      await hfq.sendMessage({ sessionId: activeSessionId, text });
    } catch (e) {
      const msg = humanizeProviderError(errMessage(e));
      markTurnIdle(set, get().activeSessionId, "idle");
      set({ error: msg });
      toast.error(msg);
    }
  },

  abortSession: async () => {
    const { activeSessionId, pendingPermissions } = get();
    if (!activeSessionId) return;
    // Clear permission queue for this session only (abort isolation).
    const remaining = pendingPermissions.filter(
      (p) => String(p.sessionId ?? "") !== activeSessionId,
    );
    set({ pendingPermissions: remaining });
    try {
      await getHfq().abortSession({ sessionId: activeSessionId });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      markTurnIdle(set, activeSessionId, "idle");
      void get().refreshSessions();
    }
  },

  resolvePermission: async (allow, remember = false) => {
    const { pendingPermissions } = get();
    const perm = pendingPermissions[0];
    if (!perm?.requestId) return;
    const decision: PermissionDecision = !allow
      ? "deny"
      : remember
        ? "allow_session"
        : "allow";
    try {
      const r = await getHfq().resolvePermission({
        requestId: perm.requestId,
        decision,
      });
      const ok = (r as { ok?: boolean } | null)?.ok !== false;
      if (!ok) {
        toast.message("权限请求已失效（已超时/已中止）");
      }
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      // Remove resolved request from queue (regardless of ok).
      set((s) => ({
        pendingPermissions: s.pendingPermissions.filter(
          (p) => p.requestId !== perm.requestId,
        ),
      }));
    }
  },

  setSessionPermissionMode: async (mode) => {
    const { activeSessionId } = get();
    if (!activeSessionId) {
      toast.error("请先选择会话");
      return;
    }
    const next = String(mode || "confirm_before_change");

    // Full_access requires explicit confirmation.
    if (next === "full_access") {
      const ok = window.confirm(
        "将自动允许所有操作，包括危险命令（如删除文件）。\n请仅在信任的工作区使用。\n\n确定切换到「完全访问」模式？",
      );
      if (!ok) return;
    }

    try {
      const r = await getHfq().setPermissionMode({
        sessionId: activeSessionId,
        mode: next,
      });
      const live =
        (r as { permissionMode?: string })?.permissionMode ||
        (typeof r === "string" ? r : null) ||
        next;
      const planMode = String(live) === "plan";
      if (planMode) {
        try {
          await getHfq().setPlanMode({ sessionId: activeSessionId, enabled: true });
        } catch {
          /* setPermissionMode plan is enough on most hosts */
        }
      }
      set({ permissionMode: String(live), planMode });
      toast.success(
        planMode
          ? "已切换为计划模式"
          : live === "full_access"
            ? "已切换为完全访问"
            : live === "auto_edit"
              ? "已切换为自动编辑"
              : "已切换为变更前确认",
      );
    } catch (e) {
      toast.error(errMessage(e));
    }
  },

  applySessionEvent: (ev) => {
    const type = String(ev.type ?? "");
    const sessionId = (ev.sessionId as string | undefined) ?? null;
    const active = get().activeSessionId;

    // Cross-session bookkeeping (list / tree)
    if (sessionId && active && sessionId !== active) {
      if (type === "session.meta") {
        // Keep model/provider + subagent meta in list even for non-active sessions.
        const idPatch = sessionIdentityFrom(ev);
        if (Object.keys(idPatch).length > 0) {
          set((s) => ({
            sessions: patchSessionFields(s.sessions, sessionId, idPatch),
          }));
        }
      }
      if (
        type === "session.created" ||
        type === "session.updated" ||
        type === "session.deleted" ||
        type === "session.meta" ||
        type === "session.completed" ||
        type === "session.failed" ||
        type === "session.aborted" ||
        type === "subagent.updated"
      ) {
        void get().refreshSessions();
      }
      return;
    }

    // Streaming assistant text (agent-core: message.delta + text)
    if (type === "message.delta" || type === "assistant.delta" || type === "stream.delta") {
      const delta = String(ev.text ?? ev.delta ?? ev.content ?? "");
      if (delta) {
        set((s) => ({
          streamingText: s.streamingText + delta,
          running: true,
          sessions: patchSessionStatus(s.sessions, sessionId || active, "running"),
        }));
        scheduleRunningReconcile(get, set);
      }
      return;
    }

    // Chain-of-thought / extended thinking (agent-core: thinking.delta)
    if (type === "thinking.delta") {
      const delta = String(ev.text ?? ev.delta ?? "");
      const messageId = String(ev.messageId ?? ev.id ?? "");
      if (!delta) return;
      set((s) => {
        const same =
          messageId && s.streamingThinkingId && messageId === s.streamingThinkingId;
        return {
          running: true,
          streamingThinkingId: messageId || s.streamingThinkingId,
          streamingThinking: same ? s.streamingThinking + delta : delta,
          sessions: patchSessionStatus(s.sessions, sessionId || active, "running"),
        };
      });
      scheduleRunningReconcile(get, set);
      return;
    }

    // Durable CoT block (history role=thinking; live UI collapses)
    if (type === "thinking.completed") {
      const body = String(ev.text ?? "");
      const messageId = String(ev.messageId ?? ev.id ?? `think-${Date.now()}`);
      if (!body.trim()) {
        set({ streamingThinking: "", streamingThinkingId: null });
        return;
      }
      set((s) => {
        const exists = s.messages.some(
          (m) =>
            m.role === "thinking" &&
            (m.id === messageId || String(m.messageId ?? "") === messageId),
        );
        if (exists) {
          return { streamingThinking: "", streamingThinkingId: null };
        }
        return {
          messages: [
            ...s.messages,
            {
              id: messageId,
              messageId,
              role: "thinking",
              text: body,
              content: body,
              thinking: true,
              createdAt: String(ev.at ?? new Date().toISOString()),
            },
          ],
          streamingThinking: "",
          streamingThinkingId: null,
        };
      });
      return;
    }

    // Completed user/assistant message (agent-core: message.completed + text)
    if (
      type === "message.completed" ||
      type === "message.done" ||
      type === "assistant.message" ||
      type === "message"
    ) {
      const body = String(ev.text ?? messageText(ev.content) ?? ev.message ?? "");
      const role = String(ev.role ?? "assistant");
      const messageId = String(ev.messageId ?? ev.id ?? `ev-${Date.now()}`);

      // Skip duplicate user echo if we already optimistic-appended locally.
      if (role === "user") {
        set((s) => {
          const last = s.messages[s.messages.length - 1];
          if (last?.role === "user" && messageBody(last) === body) {
            return { streamingText: "" };
          }
          return {
            messages: [
              ...s.messages,
              {
                id: messageId,
                role,
                text: body,
                content: body,
                createdAt: String(ev.at ?? ev.createdAt ?? new Date().toISOString()),
              },
            ],
            streamingText: "",
          };
        });
        return;
      }

      if (body || role === "assistant") {
        set((s) => {
          // Prefer streaming buffer if event text is empty (some providers only stream).
          const finalText = body || s.streamingText;
          if (!finalText) return { streamingText: "", running: true };
          return {
            messages: [
              ...s.messages,
              {
                id: messageId,
                role,
                text: finalText,
                content: finalText,
                createdAt: String(ev.at ?? ev.createdAt ?? new Date().toISOString()),
              },
            ],
            streamingText: "",
            streamingThinking:
              s.streamingThinkingId && s.streamingThinkingId === messageId
                ? ""
                : s.streamingThinking,
            streamingThinkingId:
              s.streamingThinkingId && s.streamingThinkingId === messageId
                ? null
                : s.streamingThinkingId,
          };
        });
      }
      return;
    }

    if (type === "session.started" || type === "session.running" || type === "agent.running") {
      markTurnLive(set, get, sessionId || active);
      return;
    }

    if (type === "session.completed" || type === "session.aborted") {
      const sid = sessionId || active;
      markTurnIdle(set, sid, "idle");
      // Clear permission queue for this session (abort isolation).
      if (sid) {
        set((s) => ({
          pendingPermissions: s.pendingPermissions.filter(
            (p) => String(p.sessionId ?? "") !== sid,
          ),
        }));
      }
      if (active) {
        void get()
          .selectSession(active)
          .finally(() => {
            if (get().activeSessionId === active) markTurnIdle(set, active, "idle");
          });
      }
      void get().refreshSessions();
      return;
    }

    if (type === "session.failed") {
      const error = String(ev.error ?? "Session failed");
      const sid = sessionId || active;
      markTurnIdle(set, sid, "failed");
      // Clear permission queue for this session.
      if (sid) {
        set((s) => ({
          pendingPermissions: s.pendingPermissions.filter(
            (p) => String(p.sessionId ?? "") !== sid,
          ),
        }));
      }
      set({ error });
      toast.error(error);
      void get().refreshSessions();
      return;
    }

    if (
      type === "session.idle" ||
      type === "session.done" ||
      type === "agent.done" ||
      type === "turn.completed" ||
      type === "run.completed"
    ) {
      markTurnIdle(set, sessionId || active, "idle");
      if (active) {
        void get()
          .selectSession(active)
          .finally(() => {
            if (get().activeSessionId === active) markTurnIdle(set, active, "idle");
          });
      }
      void get().refreshSessions();
      return;
    }

    // agent-core permission.requested — push to queue (multi-session FIFO).
    if (
      type === "permission.requested" ||
      type === "permission.request" ||
      type === "permission.required"
    ) {
      const req: PermissionRequest = {
        requestId: String(ev.requestId ?? ev.id ?? ""),
        sessionId: sessionId ?? undefined,
        toolName: String(ev.toolName ?? ev.tool ?? ""),
        description: String(ev.summary ?? ev.description ?? ""),
        risk: String(ev.risk ?? ""),
        args: ev.args ?? ev.input,
      };
      set((s) => ({
        pendingPermissions: [...s.pendingPermissions, req],
        running: true,
        sessions: patchSessionStatus(
          s.sessions,
          sessionId || active,
          "waiting_permission",
        ),
      }));
      scheduleRunningReconcile(get, set);
      return;
    }

    if (type === "permission.resolved") {
      const resolvedId = String(ev.requestId ?? "");
      set((s) => ({
        pendingPermissions: s.pendingPermissions.filter(
          (p) => p.requestId !== resolvedId,
        ),
      }));
      return;
    }

    // F1 task.updated — upsert by taskId.
    if (type === "task.updated") {
      const task = ev as Record<string, unknown>;
      const taskId = String(task.taskId ?? task.id ?? "");
      if (!taskId) {
        // Schedule full refresh from snapshot on next selectSession.
        void get().refreshSessions();
        return;
      }
      set((s) => {
        const idx = s.tasks.findIndex((t) => t.taskId === taskId);
        const partial: UiTask = {
          taskId,
          title: String(task.title ?? task.objective ?? taskId).slice(0, 120),
          status: String(task.status ?? "in_progress"),
          // Do not default missing kind to "goal" — tool tasks would pollute Goals list.
          kind: task.kind != null ? String(task.kind) : undefined,
          detail: task.detail ? String(task.detail) : undefined,
          objective: task.objective ? String(task.objective) : undefined,
          progress:
            task.progress != null && Number.isFinite(Number(task.progress))
              ? Math.max(0, Math.min(100, Number(task.progress)))
              : undefined,
          budget: task.budget as UiTask["budget"] | undefined,
          parentTaskId: task.parentTaskId ? String(task.parentTaskId) : undefined,
          blockedReason: task.blockedReason ? String(task.blockedReason) : undefined,
          acceptance: task.acceptance ? String(task.acceptance) : undefined,
          updatedAt: String(task.at ?? task.updatedAt ?? new Date().toISOString()),
        };
        const next =
          idx >= 0
            ? s.tasks.map((t, i) => (i === idx ? { ...t, ...partial } : t))
            : [...s.tasks, partial];
        return { tasks: next };
      });
      return;
    }

    // Single-path diff.updated from agent-core
    if (type === "diff.updated" || type === "changes.updated") {
      const path = typeof ev.path === "string" ? ev.path : "";
      if (path) {
        set((s) => {
          const rest = s.changes.filter((c) => c.path !== path);
          const next: SessionChange = {
            path,
            kind: (ev.kind as SessionChange["kind"]) ?? "modify",
            before: typeof ev.before === "string" ? ev.before : undefined,
            after: typeof ev.after === "string" ? ev.after : undefined,
            at: String(ev.at ?? new Date().toISOString()),
            id: path,
          };
          return { changes: [...rest, next] };
        });
      } else {
        const changes = normalizeChanges(ev.changes ?? ev.items);
        if (changes.length) set({ changes });
        else if (active) void get().selectSession(active);
      }
      return;
    }

    if (type === "tool.started") {
      const name = String(ev.name ?? "tool");
      const callId = String(ev.callId ?? `tool-${Date.now()}`);
      set((s) => ({
        running: true,
        sessions: patchSessionStatus(s.sessions, sessionId || active, "running"),
        messages: [
          ...s.messages,
          {
            id: callId,
            role: "tool",
            name,
            toolName: name,
            text: `▶ ${name}`,
            content: `▶ ${name}`,
            callId,
            phase: "running",
            createdAt: String(ev.at ?? new Date().toISOString()),
          },
        ],
      }));
      scheduleRunningReconcile(get, set);
      return;
    }

    if (type === "tool.completed" || type === "tool.result") {
      const name = String(ev.name ?? ev.toolName ?? "tool");
      const callId = String(ev.callId ?? ev.id ?? `tool-${Date.now()}`);
      const ok = ev.ok !== false;
      const summary = messageText(ev.output ?? ev.result ?? ev.summary ?? "");
      const body = summary
        ? summary.length > 4000
          ? `${summary.slice(0, 4000)}…`
          : summary
        : ok
          ? "完成"
          : "失败";

      set((s) => {
        const idx = s.messages.findIndex(
          (m) => m.role === "tool" && (m.id === callId || m.callId === callId),
        );
        if (idx >= 0) {
          const next = [...s.messages];
          next[idx] = {
            ...next[idx],
            text: body,
            content: body,
            phase: "done",
            ok,
            toolName: name,
            name,
          };
          return { messages: next };
        }
        return {
          messages: [
            ...s.messages,
            {
              id: callId,
              role: "tool",
              name,
              toolName: name,
              text: body,
              content: body,
              callId,
              phase: "done",
              ok,
              createdAt: String(ev.at ?? new Date().toISOString()),
            },
          ],
        };
      });
      return;
    }

    if (type === "session.meta") {
      const idPatch = sessionIdentityFrom(ev);
      if (Object.keys(idPatch).length > 0) {
        set((s) => ({
          sessions: patchSessionFields(
            s.sessions,
            sessionId || active,
            idPatch,
          ),
        }));
      }
      // Soft refresh list for title/status fields listSessions may carry.
      void get().refreshSessions();
      return;
    }

    if (type === "subagent.updated" || type === "task.updated") {
      void get().refreshSessions();
      return;
    }

    if (type.startsWith("session.")) {
      void get().refreshSessions();
    }
  },
}));
