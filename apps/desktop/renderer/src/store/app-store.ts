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
  type AppInfo,
  type AppPaths,
  type PermissionDecision,
  type PermissionRequest,
  type SessionChange,
  type SessionInfo,
  type SessionMessage,
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
  permission: PermissionRequest | null;
  /** Active session permission mode (main.cjs setPermissionMode). */
  permissionMode: string;
  planMode: boolean;
  statusLine: string;

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
  permission: null,
  permissionMode: "confirm_before_change",
  planMode: false,
  statusLine: "Starting…",

  consumeBootRoute: () => {
    const r = get().bootRoute;
    if (r) set({ bootRoute: null });
    return r;
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
    const sessions = asList<SessionInfo>(raw).sort((a, b) => {
      const ta = Date.parse(a.updatedAt ?? a.createdAt ?? "") || 0;
      const tb = Date.parse(b.updatedAt ?? b.createdAt ?? "") || 0;
      return tb - ta;
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
    const { workspace } = get();
    if (!workspace?.path) {
      toast.error("请先打开工作区");
      await get().openWorkspace();
      if (!get().workspace?.path) return;
    }
    try {
      const hfq = getHfq();
      const session = await hfq.createSession({});
      await get().refreshSessions();
      if (session?.id) {
        await get().selectSession(session.id);
      }
    } catch (e) {
      const msg = errMessage(e);
      set({ error: msg });
      toast.error(msg);
    }
  },

  selectSession: async (sessionId) => {
    const hfq = getHfq();
    set({
      activeSessionId: sessionId,
      streamingText: "",
      streamingThinking: "",
      streamingThinkingId: null,
      running: false,
      messages: [],
      changes: [],
      permission: null,
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
      const running =
        info?.status === "running" ||
        info?.status === "streaming" ||
        String(info?.status ?? "") === "busy";

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

      set({
        messages,
        changes,
        running: Boolean(running),
        permissionMode,
        planMode: Boolean(plan),
        streamingThinking: "",
        streamingThinkingId: null,
      });

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
    let { activeSessionId, workspace } = get();

    if (!workspace?.path) {
      toast.error("请先打开工作区");
      await get().openWorkspace();
      workspace = get().workspace;
      if (!workspace?.path) return;
    }

    try {
      if (!activeSessionId) {
        const session = await hfq.createSession({});
        activeSessionId = session.id;
        set({ activeSessionId });
        await get().refreshSessions();
      }
      if (!activeSessionId) return;

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
      }));

      // IPC contract: payload.text (main.cjs session:send)
      await hfq.sendMessage({ sessionId: activeSessionId, text });
    } catch (e) {
      const msg = errMessage(e);
      set({ running: false, error: msg });
      toast.error(msg);
    }
  },

  abortSession: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    try {
      await getHfq().abortSession({ sessionId: activeSessionId });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      set({ running: false });
    }
  },

  resolvePermission: async (allow, remember = false) => {
    const { permission } = get();
    if (!permission?.requestId) return;
    const decision: PermissionDecision = !allow
      ? "deny"
      : remember
        ? "allow_session"
        : "allow";
    try {
      await getHfq().resolvePermission({
        requestId: permission.requestId,
        decision,
      });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      set({ permission: null });
    }
  },

  setSessionPermissionMode: async (mode) => {
    const { activeSessionId } = get();
    if (!activeSessionId) {
      toast.error("请先选择会话");
      return;
    }
    const next = String(mode || "confirm_before_change");
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
      if (delta) set((s) => ({ streamingText: s.streamingText + delta, running: true }));
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
        };
      });
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
      set({ running: true });
      return;
    }

    if (type === "session.completed" || type === "session.aborted") {
      set({
        running: false,
        streamingText: "",
        streamingThinking: "",
        streamingThinkingId: null,
      });
      if (active) {
        // Soft refresh snapshot so tool cards / changes land.
        void get().selectSession(active);
      }
      void get().refreshSessions();
      return;
    }

    if (type === "session.failed") {
      const error = String(ev.error ?? "Session failed");
      set({
        running: false,
        streamingText: "",
        streamingThinking: "",
        streamingThinkingId: null,
        error,
      });
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
      set({
        running: false,
        streamingText: "",
        streamingThinking: "",
        streamingThinkingId: null,
      });
      if (active) void get().selectSession(active);
      void get().refreshSessions();
      return;
    }

    // agent-core permission.requested (summary, not description)
    if (
      type === "permission.requested" ||
      type === "permission.request" ||
      type === "permission.required"
    ) {
      set({
        permission: {
          requestId: String(ev.requestId ?? ev.id ?? ""),
          sessionId: sessionId ?? undefined,
          toolName: String(ev.toolName ?? ev.tool ?? ""),
          description: String(ev.summary ?? ev.description ?? ""),
          risk: String(ev.risk ?? ""),
          args: ev.args ?? ev.input,
        },
        running: true,
      });
      return;
    }

    if (type === "permission.resolved") {
      set({ permission: null });
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

    if (type === "session.meta" || type === "subagent.updated" || type === "task.updated") {
      void get().refreshSessions();
      return;
    }

    if (type.startsWith("session.")) {
      void get().refreshSessions();
    }
  },
}));
