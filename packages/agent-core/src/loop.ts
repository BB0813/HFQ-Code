import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  defaultPolicyConfig,
  grantSessionAllow,
  listSessionAllows,
  normalizePermissionMode,
  revokeSessionAllow,
  resolvePermission,
  type PermissionMode,
  type PolicyConfig,
} from "@hfq/policy";
import { toAssistantToolCalls, type ChatMessage, type ModelProvider } from "@hfq/providers";
import type { SessionEvent, SessionInfo } from "@hfq/shared";
import { formatMatchedSkillBodies, loadSkills, matchSkills } from "@hfq/skills";
import { createToolHub, type ToolHub } from "@hfq/tools";
import type { ToolDefinition } from "@hfq/shared";
import type { ToolHandler } from "@hfq/tools";
import { JsonlTranscript } from "@hfq/transcript";
import { createScopedMemory, formatMemoryForPrompt } from "@hfq/memory";
import { compactChatMessagesMaybeLlm } from "./compact.js";
import { buildSystemPrompt, loadProjectRules } from "./context.js";

/**
 * Soft-redact prior assistant self-claims that name a different model id.
 * Request-only; transcript UI keeps the original text.
 */
export function redactStaleModelSelfClaims(text: string, currentModel: string): string {
  const current = currentModel.trim();
  if (!current || !text) return text;
  let out = text;
  // **model-id** or `model-id` after 模型是 / model is / powered by
  out = out.replace(
    /(模型是|背后模型是|模型为|model is|powered by|using model)\s*(\*\*|`)?([a-zA-Z0-9][\w.+\/-]{1,64})(\*\*|`)?/gi,
    (full, lead: string, open: string | undefined, id: string, close: string | undefined) => {
      if (id === current) return full;
      const o = open || "";
      const c = close || open || "";
      return `${lead} ${o}${current}${c}`;
    },
  );
  // Bare common wrong brands when current is clearly not them
  const brands = ["grok-4.5", "grok-4", "gpt-4.1", "gpt-4o", "claude-sonnet-4", "claude-3"];
  for (const b of brands) {
    if (b === current) continue;
    if (out.includes(b)) {
      out = out.split(b).join(current);
    }
  }
  return out;
}
import {
  buildSessionSnapshot,
  type SessionSnapshot,
  type UiChange,
  type UiMessage,
  type UiTask,
  type UiTerminalLine,
} from "./history.js";
import {
  formatCompactUserContent,
  formatGoalUserContent,
  GOAL_MAX_ROUNDS,
  GOAL_MAX_TOOL_CALLS,
  parseUserSlash,
} from "./slash.js";
import {
  loadGoalsFromDisk,
  mergeTasksWithGoals,
} from "./goals-store.js";
import { ensureDataDirs } from "./paths.js";
import { redactJsonValue } from "./redact.js";
import {
  defaultBudget,
  toolsForProfile,
  type SubagentProfile,
} from "./subagent.js";

function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [truncated ${text.length - max} chars]`;
}

export type EventHandler = (event: SessionEvent) => void | Promise<void>;
export type PermissionHandler = (req: {
  requestId: string;
  toolName: string;
  risk: "low" | "medium" | "high";
  summary: string;
}) => Promise<"allow" | "deny" | "allow_session">;

export interface ExtraToolsBundle {
  defs: ToolDefinition[];
  handlers: Record<string, ToolHandler>;
}

export interface AgentSessionOptions {
  workspacePath: string;
  provider: ModelProvider;
  model: string;
  sessionId?: string;
  title?: string;
  /** Open existing JSONL and rebuild context instead of starting fresh. */
  resume?: boolean;
  bundledSkillsDir?: string;
  sharedAgentsDir?: string;
  onEvent?: EventHandler;
  onPermission?: PermissionHandler;
  maxRounds?: number;
  /** Dynamic tools (e.g. live MCP) refreshed each agent round. */
  getExtraTools?: () => ExtraToolsBundle | null | undefined;
  /** Plan mode: deny mutating tools (write/patch/shell). */
  planMode?: boolean;
  /**
   * Access mode (Claude Code / ZCode style).
   * When set, overrides planMode boolean for initial state.
   */
  permissionMode?: PermissionMode;
  /** Soft character budget for compaction (prefs). */
  compactMaxChars?: number;
  /** Inject memory into system prompt (prefs). */
  memoryEnabled?: boolean;
  /** Parent session id when this is a sub-agent. */
  parentSessionId?: string;
  /** Nesting depth (0 = root). */
  subagentDepth?: number;
  /** Tool profile for sub-agents. */
  subagentProfile?: SubagentProfile;
  /** Short goal text for sub-agent children (Tasks tree). */
  goal?: string;
  /** Hard cap on tool executions this turn/session life. */
  maxToolCalls?: number;
  /** Optional handler for spawn_subagent tool (wired by SessionManager). */
  onSpawnSubagent?: (params: {
    goal: string;
    profile: SubagentProfile;
    parentSessionId: string;
  }) => Promise<{ childSessionId: string; summary: string; ok: boolean; error?: string }>;
  /** Coding profile system addon text. */
  codingProfileAddon?: string;
  /** Preferred skill names from active coding profile. */
  codingProfileSkillIds?: string[];
  /** Progressive skill match prefs. */
  skillMatch?: {
    enabled?: boolean;
    maxBodies?: number;
    maxBodyChars?: number;
  };
  /**
   * Optional title model role (Kivio-style). When set, first-message title may use this
   * provider/model; otherwise heuristic title remains.
   */
  titleModelRole?: { provider?: ModelProvider; model?: string };
  /** Optional compression model role for future summarizer path (reserved). */
  compressionModelRole?: { provider?: ModelProvider; model?: string };
}

export class AgentSession {
  readonly info: SessionInfo;
  private messages: ChatMessage[] = [];
  private transcript!: JsonlTranscript;
  private tools: ToolHub = createToolHub();
  private policy: PolicyConfig = defaultPolicyConfig();
  private systemPrompt = "";
  /** Live provider/model — may be swapped when user changes Models settings. */
  private provider: ModelProvider;
  private model: string;
  private readonly maxRounds: number;
  private uiMessages: UiMessage[] = [];
  private uiChanges: UiChange[] = [];
  private uiTerminal: UiTerminalLine[] = [];
  private uiTasks: UiTask[] = [];
  private usage = { inputTokens: 0, outputTokens: 0 };
  /** Durable transcript events for audit restore (no message.delta). Newest last. */
  private eventLog: SessionEvent[] = [];
  private titleLocked = false;
  private abortRequested = false;
  private planMode: boolean;
  private permissionMode: PermissionMode;
  /** Non-plan mode to restore when leaving plan mode. */
  private previousNonPlanMode: PermissionMode = "confirm_before_change";
  private toolCallCount = 0;
  private readonly maxToolCalls: number;
  /** Per-turn overrides (e.g. elevated /goal budgets). Cleared after each send. */
  private turnMaxRounds: number | null = null;
  private turnMaxToolCalls: number | null = null;
  /** Latest user text for progressive skill match (cleared after rebuild). */
  private pendingSkillQuery: string | null = null;
  private static readonly EVENT_LOG_MAX = 500;

  constructor(private readonly opts: AgentSessionOptions) {
    const now = new Date().toISOString();
    this.provider = opts.provider;
    this.model = opts.model;
    this.info = {
      id: opts.sessionId ?? randomUUID(),
      workspacePath: opts.workspacePath,
      title: opts.title ?? "New session",
      // UX1: always present on SessionInfo ("" if provider has no id yet).
      model: opts.model != null ? String(opts.model) : "",
      providerId: opts.provider?.id != null ? String(opts.provider.id) : "",
      createdAt: now,
      updatedAt: now,
      status: "idle",
      parentSessionId: opts.parentSessionId,
      subagentProfile: opts.subagentProfile,
      subagentDepth: opts.subagentDepth,
      goal: opts.goal,
    };
    const initialMode = normalizePermissionMode(
      opts.permissionMode ?? (opts.planMode ? "plan" : "confirm_before_change"),
    );
    this.permissionMode = initialMode;
    this.planMode = initialMode === "plan";
    if (initialMode !== "plan") this.previousNonPlanMode = initialMode;
    if (opts.subagentProfile) {
      const budget = defaultBudget(opts.subagentProfile, opts.subagentDepth ?? 1);
      this.maxRounds = opts.maxRounds ?? budget.maxRounds;
      this.maxToolCalls = opts.maxToolCalls ?? budget.maxToolCalls;
    } else {
      this.maxRounds = opts.maxRounds ?? 12;
      this.maxToolCalls = opts.maxToolCalls ?? 200;
    }
  }

  setPlanMode(enabled: boolean): void {
    if (enabled) {
      if (this.permissionMode !== "plan") {
        this.previousNonPlanMode = this.permissionMode;
      }
      this.permissionMode = "plan";
      this.planMode = true;
    } else {
      const restore =
        this.previousNonPlanMode === "plan"
          ? "confirm_before_change"
          : this.previousNonPlanMode;
      this.permissionMode = restore;
      this.planMode = false;
    }
  }

  getPlanMode(): boolean {
    return this.planMode;
  }

  setPermissionMode(mode: PermissionMode | string): PermissionMode {
    const next = normalizePermissionMode(mode);
    if (next === "plan") {
      if (this.permissionMode !== "plan") {
        this.previousNonPlanMode = this.permissionMode;
      }
      this.permissionMode = "plan";
      this.planMode = true;
    } else {
      this.previousNonPlanMode = next;
      this.permissionMode = next;
      this.planMode = false;
    }
    return this.permissionMode;
  }

  getPermissionMode(): PermissionMode {
    return this.permissionMode;
  }

  getParentSessionId(): string | undefined {
    return this.opts.parentSessionId;
  }

  getSubagentDepth(): number {
    return this.opts.subagentDepth ?? 0;
  }

  /**
   * Cooperative cancel: checked between model rounds and tools.
   * Does not kill an in-flight HTTP/provider call mid-body.
   */
  requestAbort(): boolean {
    if (this.info.status !== "running" && this.info.status !== "waiting_permission") {
      return false;
    }
    this.abortRequested = true;
    return true;
  }

  listSessionAllows(): string[] {
    return listSessionAllows(this.policy);
  }

  grantSessionTool(toolName: string): string[] {
    grantSessionAllow(this.policy, toolName);
    return this.listSessionAllows();
  }

  revokeSessionTool(toolName: string): string[] {
    revokeSessionAllow(this.policy, toolName);
    return this.listSessionAllows();
  }

  private assertNotAborted(): void {
    if (!this.abortRequested) return;
    const err = new Error("session aborted by user");
    (err as Error & { code?: string }).code = "ABORTED";
    throw err;
  }

  getSnapshot(): SessionSnapshot {
    return {
      info: { ...this.info },
      messages: [...this.uiMessages],
      chatMessages: [...this.messages],
      changes: [...this.uiChanges],
      terminal: [...this.uiTerminal],
      tasks: [...this.uiTasks],
      usage: { ...this.usage },
      events: [...this.eventLog],
    };
  }

  private pushEventLog(event: SessionEvent): void {
    // Live-only streams — completed thinking row is enough for resume.
    if (event.type === "message.delta" || event.type === "thinking.delta") return;
    this.eventLog.push(event);
    if (this.eventLog.length > AgentSession.EVENT_LOG_MAX) {
      this.eventLog.splice(0, this.eventLog.length - AgentSession.EVENT_LOG_MAX);
    }
  }

  /**
   * Persist a user-facing title into the JSONL transcript (session.meta).
   */
  async setTitle(title: string): Promise<SessionInfo> {
    const next = title.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!next) throw new Error("title required");
    this.info.title = next;
    this.titleLocked = true;
    this.info.updatedAt = new Date().toISOString();
    // Keep identity keys present ("" if unknown) for list/sidebar consumers.
    if (this.info.model == null) this.info.model = "";
    if (this.info.providerId == null) {
      this.info.providerId = this.provider?.id != null ? String(this.provider.id) : "";
    }
    await this.emit({
      type: "session.meta",
      sessionId: this.info.id,
      title: next,
      model: this.info.model || undefined,
      providerId: this.info.providerId || this.provider?.id || undefined,
      at: this.info.updatedAt,
    });
    return { ...this.info };
  }

  /**
   * Hot-swap provider/model for subsequent turns (Models UI / setActive / open rebind).
   * Rebuilds the system prompt so identity lines match the new model id.
   * Inserts an in-chat system note so prior "I am model X" turns do not stick.
   * Throws while a turn is running (caller should wait for idle).
   */
  async setProviderModel(provider: ModelProvider, model: string): Promise<SessionInfo> {
    if (this.info.status === "running" || this.info.status === "waiting_permission") {
      throw new Error("cannot change model while session is busy");
    }
    const nextModel = String(model || "").trim();
    if (!nextModel) throw new Error("model required");
    if (!provider) throw new Error("provider required");
    const prevModel = this.model;
    const prevProviderId = this.provider?.id;
    const sameBinding =
      prevModel === nextModel && prevProviderId === provider.id;
    // Always swap the live provider instance (new object each resolve is normal).
    this.provider = provider;
    this.model = nextModel;
    this.info.model = nextModel;
    this.info.providerId = provider.id;
    this.info.updatedAt = new Date().toISOString();
    if (sameBinding) {
      // No meta spam / switch notes on every session:send re-pin.
      return { ...this.info };
    }
    // Refresh identity lines without dropping workspace rules / skills / memory.
    await this.rebuildSystemPrompt();
    // Break conversation continuity on the old model name (models copy prior self-intros).
    this.appendModelSwitchNote(prevModel, nextModel, provider.id);
    await this.emit({
      type: "session.meta",
      sessionId: this.info.id,
      title: this.info.title,
      model: nextModel,
      providerId: provider.id,
      at: this.info.updatedAt,
    });
    return { ...this.info };
  }

  /** In-context note after system prompt so later turns see the switch. */
  private appendModelSwitchNote(
    prevModel: string,
    nextModel: string,
    providerId?: string,
  ): void {
    const note =
      prevModel && prevModel !== nextModel
        ? `[HFQ] Model switched from "${prevModel}" to "${nextModel}"${providerId ? ` (provider: ${providerId})` : ""}. Earlier assistant messages that named another model are obsolete. If asked who you are, use "${nextModel}" only.`
        : `[HFQ] Active model is now "${nextModel}"${providerId ? ` (provider: ${providerId})` : ""}. Use this id for identity answers.`;
    // Keep messages[0] as the full system prompt; insert note as a second system message.
    if (this.messages.length > 0 && this.messages[0]?.role === "system") {
      // Drop prior HFQ model-switch notes to avoid stacking.
      this.messages = [
        this.messages[0],
        { role: "system", content: note },
        ...this.messages
          .slice(1)
          .filter(
            (m) =>
              !(
                m.role === "system" &&
                typeof m.content === "string" &&
                m.content.startsWith("[HFQ] ")
              ),
          ),
      ];
    } else {
      this.messages = [
        { role: "system", content: this.systemPrompt },
        { role: "system", content: note },
        ...this.messages,
      ];
    }
  }

  /**
   * Build the message list sent to the provider for one chat call.
   * Does **not** mutate durable this.messages / transcript.
   * Pins identity at the end (recency) so older "I am grok-…" turns lose the fight.
   */
  private messagesForProvider(): ChatMessage[] {
    const model = String(this.model || "").trim();
    const providerId = this.provider?.id;
    // Always re-sync leading system prompt (compaction / resume can leave a stale copy).
    const base: ChatMessage[] = [...this.messages];
    if (base.length > 0 && base[0]?.role === "system") {
      base[0] = { role: "system", content: this.systemPrompt };
    } else {
      base.unshift({ role: "system", content: this.systemPrompt });
    }
    if (!model) return base;

    // Soft-redact stale model self-claims in prior assistant turns for this request only.
    for (let i = 0; i < base.length; i++) {
      const m = base[i];
      if (m?.role !== "assistant" || typeof m.content !== "string" || !m.content) continue;
      const redacted = redactStaleModelSelfClaims(m.content, model);
      if (redacted !== m.content) {
        base[i] = { ...m, content: redacted };
      }
    }

    const pin = [
      `[HFQ identity pin — runtime, not the user]`,
      `You are HFQ Code. The active model id for THIS reply is exactly "${model}"${providerId ? ` (provider: ${providerId})` : ""}.`,
      `If any earlier assistant message (or your own thinking) named a different model, ignore it — that was a previous configuration.`,
      `When the user asks who you are / which model: answer HFQ Code + "${model}" only. Never say grok / gpt / claude unless that string equals "${model}".`,
    ].join(" ");
    base.push({ role: "system", content: pin });
    return base;
  }

  getProviderId(): string | undefined {
    return this.provider?.id;
  }

  getModel(): string {
    return this.model;
  }

  private async rebuildSystemPrompt(): Promise<void> {
    const dirs = await ensureDataDirs();
    const skills = await loadSkills({
      workspacePath: this.opts.workspacePath,
      userSkillsDir: dirs.skills,
      sharedAgentsDir: this.opts.sharedAgentsDir,
      bundledDir: this.opts.bundledSkillsDir,
    });
    const projectRules = await loadProjectRules(this.opts.workspacePath);
    let memoryBlock = "";
    if (this.opts.memoryEnabled !== false) {
      try {
        const brain = createScopedMemory({
          rootDir: dirs.memory,
          workspacePath: this.opts.workspacePath,
        });
        const base = path.basename(this.opts.workspacePath || "") || "project";
        const hits = await brain.search(base, 6);
        const recent = hits.length
          ? hits
          : (await brain.list(5)).map((d) => ({
              id: d.id,
              text: d.text,
              score: 1,
              source: d.source,
              updatedAt: d.updatedAt,
              scope: d.scope,
            }));
        memoryBlock = formatMemoryForPrompt(recent, 1_800);
      } catch {
        memoryBlock = "";
      }
    }
    if (this.planMode) {
      memoryBlock = `${memoryBlock ? `${memoryBlock}\n\n` : ""}## Plan mode\nYou are in plan mode: do not modify files or run shell. Use read-only tools and produce a clear plan.`;
    }
    if (this.opts.subagentProfile) {
      memoryBlock = `${memoryBlock ? `${memoryBlock}\n\n` : ""}## Sub-agent\nProfile: ${this.opts.subagentProfile}. Stay focused on the assigned goal; parent will receive your final summary.`;
    }

    let matchedSkillsBlock = "";
    const skillMatch = this.opts.skillMatch;
    const matchEnabled = skillMatch?.enabled !== false;
    if (matchEnabled && this.pendingSkillQuery?.trim()) {
      try {
        const matches = matchSkills(this.pendingSkillQuery, skills, {
          limit: skillMatch?.maxBodies ?? 2,
          preferNames: this.opts.codingProfileSkillIds,
        });
        matchedSkillsBlock = formatMatchedSkillBodies(
          matches,
          skillMatch?.maxBodyChars ?? 6_000,
        );
      } catch {
        matchedSkillsBlock = "";
      }
    }

    this.systemPrompt = buildSystemPrompt({
      workspacePath: this.opts.workspacePath,
      projectRules,
      skills,
      memoryBlock,
      model: this.model,
      providerId: this.provider?.id,
      profileAddon: this.opts.codingProfileAddon,
      matchedSkillsBlock,
    });
    // Keep chat history system message in sync for subsequent model calls.
    if (this.messages.length > 0 && this.messages[0]?.role === "system") {
      this.messages[0] = { role: "system", content: this.systemPrompt };
    } else if (this.messages.length === 0) {
      this.messages = [{ role: "system", content: this.systemPrompt }];
    }
  }

  async init(): Promise<SessionSnapshot | null> {
    const dirs = await ensureDataDirs();
    await this.rebuildSystemPrompt();

    if (this.opts.resume) {
      const existing = await JsonlTranscript.openExisting(dirs.sessions, this.info.id);
      if (!existing) throw new Error(`session transcript not found: ${this.info.id}`);
      this.transcript = existing;
      const events = await existing.readEvents();
      const snap = buildSessionSnapshot(events, {
        id: this.info.id,
        workspacePath: this.opts.workspacePath,
        title: this.opts.title,
        model: this.model,
      });
      // Capture transcript model BEFORE live open params overwrite info.model.
      const transcriptModel = String(snap.info.model ?? "").trim();
      Object.assign(this.info, snap.info);
      // Prefer live model (hot-swap / open params) over stale transcript meta.
      this.info.model = this.model || snap.info.model;
      this.uiMessages = snap.messages;
      this.uiChanges = snap.changes;
      this.uiTerminal = snap.terminal;
      // Merge JSONL tasks with goals sidecar (cold-start survival for /goal fields).
      try {
        const diskGoals = await loadGoalsFromDisk(this.info.id);
        this.uiTasks = mergeTasksWithGoals(snap.tasks, diskGoals);
      } catch {
        this.uiTasks = snap.tasks;
      }
      this.usage = { ...snap.usage };
      this.eventLog = events
        .filter((ev) => ev.type !== "message.delta")
        .slice(-AgentSession.EVENT_LOG_MAX);
      this.titleLocked = events.some(
        (ev) => ev.type === "session.meta" && Boolean(ev.title?.trim()),
      );
      this.messages = [
        { role: "system", content: this.systemPrompt },
        ...snap.chatMessages.filter((m) => m.role !== "system"),
      ];
      // If open rebound to a different model than last transcript meta, break identity stickiness.
      // Keep providerId in live info; persist if missing from transcript or rebind changed model.
      const transcriptProviderId = String(snap.info.providerId ?? "").trim();
      const liveProviderId = String(this.provider?.id ?? "").trim();
      if (liveProviderId) {
        this.info.providerId = liveProviderId;
      }
      if (this.model && transcriptModel && transcriptModel !== this.model) {
        this.appendModelSwitchNote(transcriptModel, this.model, this.provider?.id);
        // Persist rebind so listAll / next cold open see the new model (not only in-memory).
        await this.emit({
          type: "session.meta",
          sessionId: this.info.id,
          title: this.info.title,
          model: this.model,
          providerId: liveProviderId || undefined,
          at: new Date().toISOString(),
        });
      } else if (liveProviderId && liveProviderId !== transcriptProviderId) {
        await this.emit({
          type: "session.meta",
          sessionId: this.info.id,
          model: this.model,
          providerId: liveProviderId,
          at: new Date().toISOString(),
        });
      }
      // Re-apply session allows from prior permission.resolved(allow_session) events.
      // toolName is on the matching permission.requested.
      const requestTool = new Map<string, string>();
      for (const ev of events) {
        if (ev.type === "permission.requested") {
          requestTool.set(ev.requestId, ev.toolName);
        } else if (ev.type === "permission.resolved" && ev.decision === "allow_session") {
          const tool = requestTool.get(ev.requestId);
          if (tool) grantSessionAllow(this.policy, tool);
        }
      }
      return this.getSnapshot();
    }

    this.transcript = await JsonlTranscript.create(dirs.sessions, this.info.id);
    this.messages = [{ role: "system", content: this.systemPrompt }];
    this.uiMessages = [];
    this.uiChanges = [];
    this.uiTerminal = [];
    this.uiTasks = [];
    this.usage = { inputTokens: 0, outputTokens: 0 };
    this.eventLog = [];
    this.titleLocked = Boolean(
      this.opts.title && this.opts.title !== "New session" && this.opts.title !== "Session",
    );

    await this.emit({
      type: "session.started",
      sessionId: this.info.id,
      workspacePath: this.info.workspacePath,
      at: new Date().toISOString(),
    });
    // Always persist model on create so listAll / resume / UI know the binding.
    // Only include title when already locked (user-provided); otherwise first
    // user message still auto-titles without fighting this meta event.
    const hasSubMeta = Boolean(
      this.opts.parentSessionId || this.opts.subagentProfile || this.opts.goal,
    );
    await this.emit({
      type: "session.meta",
      sessionId: this.info.id,
      ...(this.titleLocked || hasSubMeta ? { title: this.info.title } : {}),
      model: this.info.model,
      providerId: this.info.providerId ?? this.provider?.id,
      parentSessionId: this.opts.parentSessionId,
      subagentProfile: this.opts.subagentProfile,
      subagentDepth: this.opts.subagentDepth,
      goal: this.opts.goal,
      at: new Date().toISOString(),
    });
    return null;
  }

  private trackUi(event: SessionEvent): void {
    switch (event.type) {
      case "message.completed":
        this.uiMessages.push({
          role: event.role,
          text: event.text,
          messageId: event.messageId,
        });
        break;
      case "thinking.completed":
        if (event.text?.trim()) {
          this.uiMessages.push({
            role: "thinking",
            text: event.text,
            messageId: event.messageId,
            thinking: true,
          });
        }
        break;
      case "tool.started":
        this.uiMessages.push({
          role: "tool",
          name: event.name,
          text: `开始执行 ${event.name}`,
          detail: event.input,
          callId: event.callId,
          phase: "running",
          input: event.input,
        });
        break;
      case "tool.completed": {
        const idx = event.callId
          ? this.uiMessages.findIndex(
              (m) =>
                m &&
                m.role === "tool" &&
                m.callId === event.callId &&
                m.phase === "running",
            )
          : -1;
        const row = {
          role: "tool" as const,
          name: event.name,
          text: event.ok ? `完成 ${event.name}` : `失败 ${event.name}`,
          detail: event.output,
          callId: event.callId,
          phase: "done" as const,
          ok: event.ok,
          input: idx >= 0 ? this.uiMessages[idx]?.input : undefined,
          output: event.output,
        };
        if (idx >= 0) this.uiMessages[idx] = { ...this.uiMessages[idx], ...row };
        else this.uiMessages.push(row);
        break;
      }
      case "permission.resolved": {
        const map: Record<string, string> = {
          allow: "允许一次",
          deny: "拒绝",
          allow_session: "本会话允许",
        };
        this.uiMessages.push({
          role: "system",
          text: `权限决策: ${map[event.decision] || event.decision} · ${event.requestId.slice(0, 8)}`,
        });
        break;
      }
      case "diff.updated": {
        const next = {
          path: event.path,
          kind: event.kind,
          before: event.before,
          after: event.after,
          at: event.at,
        };
        const idx = this.uiChanges.findIndex((c) => c.path === event.path);
        if (idx >= 0) this.uiChanges[idx] = { ...this.uiChanges[idx], ...next };
        else this.uiChanges.unshift(next);
        break;
      }
      case "terminal.output":
        this.uiTerminal.unshift({
          callId: event.callId,
          command: event.command,
          stdout: event.stdout,
          stderr: event.stderr,
          code: event.code,
          ok: event.ok,
          at: event.at,
        });
        if (this.uiTerminal.length > 80) this.uiTerminal.length = 80;
        break;
      case "task.updated": {
        const next: UiTask = {
          taskId: event.taskId,
          title: event.title,
          status: event.status,
          detail: event.detail,
          at: event.at,
          kind: event.kind,
          objective: event.objective,
          progress: event.progress,
          budget: event.budget,
          parentTaskId: event.parentTaskId,
          blockedReason: event.blockedReason,
          acceptance: event.acceptance,
        };
        const idx = this.uiTasks.findIndex((t) => t.taskId === event.taskId);
        if (idx >= 0) this.uiTasks[idx] = next;
        else this.uiTasks.unshift(next);
        if (this.uiTasks.length > 100) this.uiTasks.length = 100;
        break;
      }
      case "session.failed":
        this.uiMessages.push({ role: "error", text: event.error });
        break;
      case "session.aborted":
        this.uiMessages.push({ role: "system", text: "会话已由用户停止" });
        break;
      case "session.meta":
        if (event.title?.trim()) {
          this.info.title = event.title.trim();
          this.titleLocked = true;
        }
        if (event.model?.trim()) this.info.model = event.model.trim();
        if (event.parentSessionId) this.info.parentSessionId = event.parentSessionId;
        if (event.subagentProfile) this.info.subagentProfile = event.subagentProfile;
        if (event.subagentDepth != null) this.info.subagentDepth = event.subagentDepth;
        if (event.goal?.trim()) this.info.goal = event.goal.trim();
        break;
      case "subagent.updated":
        // Parent-only observability; no local uiTasks mutation required.
        break;
      case "usage.updated":
        this.usage.inputTokens += Number(event.inputTokens) || 0;
        this.usage.outputTokens += Number(event.outputTokens) || 0;
        break;
      default:
        break;
    }
  }

  private sanitizeEvent(event: SessionEvent): SessionEvent {
    try {
      return redactJsonValue(event) as SessionEvent;
    } catch {
      return event;
    }
  }

  private async emit(event: SessionEvent): Promise<void> {
    const safe = this.sanitizeEvent(event);
    this.trackUi(safe);
    this.pushEventLog(safe);
    await this.transcript.append(safe);
    await this.opts.onEvent?.(safe);
  }

  private toolAllowedByProfile(name: string): boolean {
    if (name === "spawn_subagent" && (this.opts.subagentDepth ?? 0) >= 1) {
      return false;
    }
    if (!this.opts.subagentProfile) return true;
    const { allow, deny } = toolsForProfile(this.opts.subagentProfile);
    if (deny.has(name)) return false;
    if (allow && !allow.has(name) && !name.startsWith("mcp__")) return false;
    return true;
  }

  private isMutatingTool(name: string): boolean {
    return (
      name === "write_file" ||
      name === "apply_patch" ||
      name === "shell" ||
      name === "git_commit" ||
      name === "memory_save" ||
      name === "spawn_subagent"
    );
  }

  async sendUserMessage(text: string): Promise<void> {
    this.abortRequested = false;
    this.info.status = "running";
    this.info.updatedAt = new Date().toISOString();
    this.turnMaxRounds = null;
    this.turnMaxToolCalls = null;

    const parsed = parseUserSlash(text);
    const messageId = randomUUID();
    const at = new Date().toISOString();
    let goalTaskId: string | null = null;

    if (parsed.kind === "goal" && !parsed.body) {
      this.info.status = "idle";
      await this.emit({
        type: "message.completed",
        sessionId: this.info.id,
        messageId,
        role: "system",
        text: "用法：/goal <目标描述>。例如：/goal 梳理 packages 结构并写一份摘要到 docs/overview.md",
        at,
      });
      return;
    }

    // Transcript / UI shows the slash form; model may receive expanded instructions.
    const displayText = parsed.displayText || parsed.raw;
    let modelContent = displayText;
    if (parsed.kind === "goal") {
      modelContent = formatGoalUserContent(parsed.body);
      this.turnMaxRounds = GOAL_MAX_ROUNDS;
      // Remaining budget this turn, not lifetime reset (preserve prior tool accounting).
      this.turnMaxToolCalls = this.toolCallCount + GOAL_MAX_TOOL_CALLS;
      goalTaskId = `goal_${messageId.slice(0, 8)}`;
    } else if (parsed.kind === "compact") {
      modelContent = formatCompactUserContent(parsed.body);
    }

    // Progressive skill match on this turn's user text (rebuild system before model call).
    this.pendingSkillQuery =
      parsed.kind === "goal"
        ? parsed.body
        : parsed.kind === "compact"
          ? parsed.body || displayText
          : displayText;
    try {
      await this.rebuildSystemPrompt();
    } catch {
      /* keep previous system prompt */
    }

    this.messages.push({ role: "user", content: modelContent });
    await this.emit({
      type: "message.completed",
      sessionId: this.info.id,
      messageId,
      role: "user",
      text: displayText,
      at,
    });

    if (goalTaskId) {
      await this.emit({
        type: "task.updated",
        sessionId: this.info.id,
        taskId: goalTaskId,
        title: `goal: ${parsed.body.slice(0, 80)}`,
        status: "in_progress",
        detail: `long-run · up to ${GOAL_MAX_ROUNDS} rounds / ${GOAL_MAX_TOOL_CALLS} tools`,
        kind: "goal",
        objective: parsed.body,
        progress: 0,
        budget: { maxRounds: GOAL_MAX_ROUNDS, maxToolCalls: GOAL_MAX_TOOL_CALLS },
        at: new Date().toISOString(),
      });
    }

    // Auto-title from first user message unless user already set one.
    if (!this.titleLocked) {
      const titleSource =
        parsed.kind === "goal"
          ? parsed.body
          : displayText.replace(/^\/\w+\s*/i, "").trim() || displayText;
      let short = titleSource.replace(/\s+/g, " ").trim().slice(0, 48);
      // Optional title model role (cheap LLM); fall back to heuristic on any failure.
      const titleRole = this.opts.titleModelRole;
      if (titleRole?.provider && titleRole.model && titleSource.trim()) {
        try {
          const res = await titleRole.provider.chat({
            model: titleRole.model,
            messages: [
              {
                role: "system",
                content:
                  "Return a short session title (max 48 chars). No quotes. Same language as the user text.",
              },
              { role: "user", content: titleSource.slice(0, 500) },
            ],
            tools: [],
          });
          const candidate = String(res?.message ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 48);
          if (candidate) short = candidate;
        } catch {
          /* heuristic short already set */
        }
      }
      if (short) {
        this.info.title = short;
        this.titleLocked = true;
        await this.emit({
          type: "session.meta",
          sessionId: this.info.id,
          title: short,
          model: this.info.model,
          providerId: this.info.providerId ?? this.provider?.id,
          at: new Date().toISOString(),
        });
      }
    }

    try {
      await this.runLoop();
      if (this.abortRequested) {
        this.info.status = "idle";
        if (goalTaskId) {
          await this.emit({
            type: "task.updated",
            sessionId: this.info.id,
            taskId: goalTaskId,
            title: `goal: ${parsed.body.slice(0, 80)}`,
            status: "cancelled",
            detail: "user_stop",
            kind: "goal",
            objective: parsed.body,
            progress: 0,
            budget: { maxRounds: GOAL_MAX_ROUNDS, maxToolCalls: GOAL_MAX_TOOL_CALLS },
            blockedReason: "user_stop",
            at: new Date().toISOString(),
          });
        }
        await this.emit({
          type: "session.aborted",
          sessionId: this.info.id,
          reason: "user_stop",
          at: new Date().toISOString(),
        });
        return;
      }
      this.info.status = "idle";
      if (goalTaskId) {
        await this.emit({
          type: "task.updated",
          sessionId: this.info.id,
          taskId: goalTaskId,
          title: `goal: ${parsed.body.slice(0, 80)}`,
          status: "completed",
          detail: `goal turn finished · rounds≤${GOAL_MAX_ROUNDS} tools≤${GOAL_MAX_TOOL_CALLS}`,
          kind: "goal",
          objective: parsed.body,
          progress: 100,
          budget: { maxRounds: GOAL_MAX_ROUNDS, maxToolCalls: GOAL_MAX_TOOL_CALLS },
          at: new Date().toISOString(),
        });
      }
      await this.emit({
        type: "session.completed",
        sessionId: this.info.id,
        at: new Date().toISOString(),
      });
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "ABORTED" || this.abortRequested) {
        this.info.status = "idle";
        if (goalTaskId) {
          await this.emit({
            type: "task.updated",
            sessionId: this.info.id,
            taskId: goalTaskId,
            title: `goal: ${parsed.body.slice(0, 80)}`,
            status: "cancelled",
            detail: "user_stop",
            kind: "goal",
            objective: parsed.body,
            progress: 0,
            budget: { maxRounds: GOAL_MAX_ROUNDS, maxToolCalls: GOAL_MAX_TOOL_CALLS },
            blockedReason: "user_stop",
            at: new Date().toISOString(),
          });
        }
        await this.emit({
          type: "session.aborted",
          sessionId: this.info.id,
          reason: "user_stop",
          at: new Date().toISOString(),
        });
        return;
      }
      this.info.status = "failed";
      const error = err instanceof Error ? err.message : String(err);
      if (goalTaskId) {
        await this.emit({
          type: "task.updated",
          sessionId: this.info.id,
          taskId: goalTaskId,
          title: `goal: ${parsed.body.slice(0, 80)}`,
          status: "failed",
          detail: error.slice(0, 200),
          kind: "goal",
          objective: parsed.body,
          progress: 0,
          budget: { maxRounds: GOAL_MAX_ROUNDS, maxToolCalls: GOAL_MAX_TOOL_CALLS },
          blockedReason: error.slice(0, 200),
          at: new Date().toISOString(),
        });
      }
      await this.emit({
        type: "session.failed",
        sessionId: this.info.id,
        error,
        at: new Date().toISOString(),
      });
      throw err;
    } finally {
      this.turnMaxRounds = null;
      this.turnMaxToolCalls = null;
    }
  }

  private refreshTools(): void {
    const extra = this.opts.getExtraTools?.();
    if (!extra?.defs?.length) {
      this.tools = createToolHub();
      return;
    }
    this.tools = createToolHub({
      extraDefs: extra.defs,
      handlers: extra.handlers ?? {},
    });
  }

  private async runLoop(): Promise<void> {
    const maxRounds = this.turnMaxRounds ?? this.maxRounds;
    const maxToolCalls = this.turnMaxToolCalls ?? this.maxToolCalls;
    let lastRound = -1;
    for (let round = 0; round < maxRounds; round++) {
      lastRound = round;
      this.assertNotAborted();
      this.refreshTools();
      // Soft-compact long histories so multi-turn sessions stay within model budgets.
      // Optional compression model summarizes dropped head turns; failures fall back to heuristic.
      const compression = this.opts.compressionModelRole;
      const packed = await compactChatMessagesMaybeLlm(this.messages, {
        maxChars: this.opts.compactMaxChars,
        compression:
          compression?.provider && compression.model
            ? { provider: compression.provider, model: compression.model }
            : undefined,
      });
      if (packed.compacted) {
        this.messages = packed.messages;
        // Surface observability for UI when LLM path ran (system note already in messages).
        if (packed.mode === "llm") {
          await this.emit({
            type: "message.completed",
            sessionId: this.info.id,
            messageId: randomUUID(),
            role: "system",
            text: `[context compacted · llm] older turns summarized (${packed.beforeChars}→${packed.afterChars} chars)`,
            at: new Date().toISOString(),
          });
        }
      }
      const streamMessageId = randomUUID();
      let streamedAny = false;
      let thinkingStreamed = false;
      const result = await this.provider.chat({
        model: this.model,
        messages: this.messagesForProvider(),
        tools: this.tools.list().map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        })),
        onDelta: async (text) => {
          if (!text) return;
          streamedAny = true;
          // Live UI only — do not append deltas to JSONL (completed row is enough).
          await this.opts.onEvent?.({
            type: "message.delta",
            sessionId: this.info.id,
            messageId: streamMessageId,
            role: "assistant",
            text,
            at: new Date().toISOString(),
          });
        },
        onThinkingDelta: async (text) => {
          if (!text) return;
          thinkingStreamed = true;
          await this.opts.onEvent?.({
            type: "thinking.delta",
            sessionId: this.info.id,
            messageId: streamMessageId,
            text,
            at: new Date().toISOString(),
          });
        },
      });
      this.assertNotAborted();

      if (result.usage) {
        await this.emit({
          type: "usage.updated",
          sessionId: this.info.id,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          at: new Date().toISOString(),
        });
      }

      // Durable CoT for resume / collapsed UI; not re-injected into model history.
      const reasoningText = typeof result.reasoning === "string" ? result.reasoning.trim() : "";
      if (reasoningText) {
        await this.emit({
          type: "thinking.completed",
          sessionId: this.info.id,
          messageId: streamMessageId,
          text: reasoningText,
          at: new Date().toISOString(),
        });
      }

      // OpenAI-compatible history requires assistant.tool_calls before any role:tool rows.
      const hasTools = result.toolCalls.length > 0;
      if (result.message || hasTools) {
        this.messages.push({
          role: "assistant",
          content: result.message || "",
          ...(hasTools ? { tool_calls: toAssistantToolCalls(result.toolCalls) } : {}),
        });
      }

      if (result.message) {
        await this.emit({
          type: "message.completed",
          sessionId: this.info.id,
          messageId: streamedAny || thinkingStreamed || reasoningText ? streamMessageId : randomUUID(),
          role: "assistant",
          text: result.message,
          at: new Date().toISOString(),
        });
      }

      if (!hasTools) {
        return;
      }

      for (const call of result.toolCalls) {
        this.assertNotAborted();
        if (this.toolCallCount >= maxToolCalls) {
          const output = { error: `tool call budget exceeded (${maxToolCalls})` };
          this.messages.push({
            role: "tool",
            tool_call_id: call.id || randomUUID(),
            name: call.name,
            content: JSON.stringify(output),
          });
          continue;
        }
        const risk = this.tools.riskOf(call.name);
        const summary =
          call.name === "shell"
            ? `shell: ${String(call.arguments.command ?? "")}`
            : call.name === "spawn_subagent"
              ? `subagent: ${String(call.arguments.goal ?? "").slice(0, 80)}`
              : call.name === "git_commit"
                ? `git_commit message: ${String(call.arguments.message ?? "").slice(0, 200)}`
                : `${call.name} ${JSON.stringify(call.arguments).slice(0, 200)}`;

        if (!this.toolAllowedByProfile(call.name)) {
          const callId = call.id || randomUUID();
          const output = { error: `tool denied by sub-agent profile: ${call.name}` };
          this.messages.push({
            role: "tool",
            tool_call_id: callId,
            name: call.name,
            content: JSON.stringify(output),
          });
          await this.emit({
            type: "tool.completed",
            sessionId: this.info.id,
            callId,
            name: call.name,
            ok: false,
            output,
            at: new Date().toISOString(),
          });
          continue;
        }

        if (this.planMode && this.isMutatingTool(call.name)) {
          const callId = call.id || randomUUID();
          const output = {
            error:
              "plan mode is active — mutating tools are disabled (write/patch/shell/git_commit/memory_save/spawn_subagent)",
          };
          this.messages.push({
            role: "tool",
            tool_call_id: callId,
            name: call.name,
            content: JSON.stringify(output),
          });
          await this.emit({
            type: "tool.completed",
            sessionId: this.info.id,
            callId,
            name: call.name,
            ok: false,
            output,
            at: new Date().toISOString(),
          });
          continue;
        }

        let decision = resolvePermission(this.policy, call.name, risk, {
          command: call.name === "shell" ? String(call.arguments.command ?? "") : undefined,
          permissionMode: this.permissionMode,
        });

        if (decision === "ask") {
          this.info.status = "waiting_permission";
          const requestId = randomUUID();
          // Register waiter before broadcasting so UI/auto-resolvers can settle it.
          const permissionPromise =
            this.opts.onPermission?.({
              requestId,
              toolName: call.name,
              risk,
              summary,
            }) ?? Promise.resolve<"allow" | "deny" | "allow_session">("deny");

          await this.emit({
            type: "permission.requested",
            sessionId: this.info.id,
            requestId,
            toolName: call.name,
            risk,
            summary,
            at: new Date().toISOString(),
          });

          const resolved = await permissionPromise;

          await this.emit({
            type: "permission.resolved",
            sessionId: this.info.id,
            requestId,
            decision: resolved,
            at: new Date().toISOString(),
          });

          if (resolved === "allow_session") {
            grantSessionAllow(this.policy, call.name);
            decision = "allow";
          } else if (resolved === "allow") {
            decision = "allow";
          } else {
            decision = "deny";
          }
          this.info.status = "running";
        }

        const callId = call.id || randomUUID();
        await this.emit({
          type: "tool.started",
          sessionId: this.info.id,
          callId,
          name: call.name,
          input: call.arguments,
          at: new Date().toISOString(),
        });

        const taskTitle =
          call.name === "shell"
            ? `shell: ${String(call.arguments.command ?? "").slice(0, 80)}`
            : call.name === "write_file"
              ? `write ${String(call.arguments.path ?? "")}`
              : call.name === "apply_patch"
                ? `patch ${String(call.arguments.patch ?? "").match(/\*\*\* (?:Add|Update|Delete) File:\s*(\S+)/)?.[1] ?? "files"}`
                : call.name === "read_file"
                  ? `read ${String(call.arguments.path ?? "")}`
                  : call.name === "list_dir"
                    ? `list ${String(call.arguments.path ?? ".")}`
                    : call.name === "grep"
                      ? `grep ${String(call.arguments.pattern ?? "").slice(0, 40)}`
                      : call.name === "network_fetch"
                        ? `fetch ${String(call.arguments.url ?? "").slice(0, 60)}`
                        : call.name === "git_status"
                          ? `git status ${String(call.arguments.path ?? ".").slice(0, 40)}`
                          : call.name === "memory_search"
                            ? `memory search ${String(call.arguments.query ?? "").slice(0, 40)}`
                            : call.name === "memory_save"
                              ? `memory save`
                              : call.name === "git_diff"
                                ? `git diff ${String(call.arguments.path ?? ".").slice(0, 40)}`
                                : call.name === "git_show"
                                  ? `git show ${String(call.arguments.object ?? "HEAD").slice(0, 40)}`
                                  : call.name === "git_commit"
                                    ? `git commit ${String(call.arguments.message ?? "").slice(0, 40)}`
                                    : call.name === "spawn_subagent"
                                      ? `subagent ${String(call.arguments.profile ?? "explore")}`
                                  : call.name;

        if (decision === "deny") {
          const output = { error: "permission denied by policy/user" };
          this.messages.push({
            role: "tool",
            tool_call_id: callId,
            name: call.name,
            content: JSON.stringify(output),
          });
          await this.emit({
            type: "tool.completed",
            sessionId: this.info.id,
            callId,
            name: call.name,
            ok: false,
            output,
            at: new Date().toISOString(),
          });
          await this.emit({
            type: "task.updated",
            sessionId: this.info.id,
            taskId: callId,
            title: taskTitle,
            status: "cancelled",
            detail: "用户或策略拒绝执行",
            at: new Date().toISOString(),
          });
          continue;
        }

        await this.emit({
          type: "task.updated",
          sessionId: this.info.id,
          taskId: callId,
          title: taskTitle,
          status: "in_progress",
          detail: summary,
          at: new Date().toISOString(),
        });

        try {
          this.toolCallCount += 1;
          let output: unknown;
          if (call.name === "spawn_subagent") {
            const goal = String(call.arguments.goal ?? "").trim();
            if (!goal) throw new Error("goal required");
            const profile = (String(call.arguments.profile ?? "explore") ||
              "explore") as SubagentProfile;
            if (!["explore", "edit", "shell"].includes(profile)) {
              throw new Error(`invalid subagent profile: ${profile}`);
            }
            if (!this.opts.onSpawnSubagent) {
              throw new Error("spawn_subagent not available in this runtime");
            }
            if ((this.opts.subagentDepth ?? 0) >= 2) {
              throw new Error("sub-agent nesting depth exceeded");
            }
            const spawned = await this.opts.onSpawnSubagent({
              goal,
              profile,
              parentSessionId: this.info.id,
            });
            output = {
              ok: spawned.ok,
              childSessionId: spawned.childSessionId,
              summary: spawned.summary,
              error: spawned.error,
            };
            await this.emit({
              type: "task.updated",
              sessionId: this.info.id,
              taskId: `sub_${spawned.childSessionId.slice(0, 8)}`,
              title: `子代理 · ${profile}: ${goal.slice(0, 60)}`,
              status: spawned.ok ? "completed" : "failed",
              detail: spawned.summary.slice(0, 500),
              at: new Date().toISOString(),
            });
          } else {
            output = await this.tools.execute(
              call.name,
              this.opts.workspacePath,
              call.arguments,
            );
          }

          if (call.name === "write_file" && typeof call.arguments.path === "string") {
            const writeOut = output as {
              path?: string;
              kind?: "create" | "modify";
              previous?: string | null;
              content?: string;
            };
            const after =
              typeof writeOut.content === "string"
                ? writeOut.content
                : String(call.arguments.content ?? "");
            const before =
              typeof writeOut.previous === "string"
                ? writeOut.previous
                : writeOut.previous === null
                  ? ""
                  : undefined;
            await this.emit({
              type: "diff.updated",
              sessionId: this.info.id,
              path: call.arguments.path,
              kind: writeOut.kind ?? (before ? "modify" : "create"),
              before: before !== undefined ? clipText(before, 12_000) : undefined,
              after: clipText(after, 12_000),
              at: new Date().toISOString(),
            });
          }

          if (call.name === "apply_patch") {
            const patchOut = output as {
              changes?: Array<{
                path: string;
                kind: "create" | "modify" | "delete";
                previous: string | null;
                content: string | null;
              }>;
            };
            for (const ch of patchOut.changes ?? []) {
              await this.emit({
                type: "diff.updated",
                sessionId: this.info.id,
                path: ch.path,
                kind: ch.kind,
                before:
                  ch.previous !== null && ch.previous !== undefined
                    ? clipText(ch.previous, 12_000)
                    : ch.kind === "create"
                      ? ""
                      : undefined,
                after:
                  ch.content !== null && ch.content !== undefined
                    ? clipText(ch.content, 12_000)
                    : ch.kind === "delete"
                      ? ""
                      : undefined,
                at: new Date().toISOString(),
              });
            }
          }

          if (call.name === "shell") {
            const shellOut = output as {
              code?: number | null;
              stdout?: string;
              stderr?: string;
            };
            await this.emit({
              type: "terminal.output",
              sessionId: this.info.id,
              callId,
              command: String(call.arguments.command ?? ""),
              stdout: clipText(String(shellOut.stdout ?? ""), 20_000),
              stderr: clipText(String(shellOut.stderr ?? ""), 8_000),
              code: shellOut.code ?? null,
              ok: (shellOut.code ?? 0) === 0,
              at: new Date().toISOString(),
            });
          }

          const toolContent =
            call.name === "write_file"
              ? JSON.stringify({
                  path: (output as { path?: string }).path,
                  bytes: (output as { bytes?: number }).bytes,
                  kind: (output as { kind?: string }).kind,
                })
              : call.name === "apply_patch"
                ? JSON.stringify({
                    ok: true,
                    changeCount: (output as { changeCount?: number }).changeCount,
                    paths: (
                      (output as { changes?: Array<{ path: string; kind: string }> }).changes ?? []
                    ).map((c) => `${c.kind}:${c.path}`),
                  })
                : JSON.stringify(output);

          this.messages.push({
            role: "tool",
            tool_call_id: callId,
            name: call.name,
            content: toolContent,
          });
          await this.emit({
            type: "tool.completed",
            sessionId: this.info.id,
            callId,
            name: call.name,
            ok: true,
            output:
              call.name === "write_file"
                ? {
                    path: (output as { path?: string }).path,
                    bytes: (output as { bytes?: number }).bytes,
                    kind: (output as { kind?: string }).kind,
                  }
                : call.name === "apply_patch"
                  ? {
                      changeCount: (output as { changeCount?: number }).changeCount,
                      paths: (
                        (output as { changes?: Array<{ path: string; kind: string }> }).changes ??
                        []
                      ).map((c) => `${c.kind}:${c.path}`),
                    }
                  : output,
            at: new Date().toISOString(),
          });
          await this.emit({
            type: "task.updated",
            sessionId: this.info.id,
            taskId: callId,
            title: taskTitle,
            status: "completed",
            detail: summary,
            at: new Date().toISOString(),
          });
        } catch (err) {
          const output = {
            error: err instanceof Error ? err.message : String(err),
          };
          this.messages.push({
            role: "tool",
            tool_call_id: callId,
            name: call.name,
            content: JSON.stringify(output),
          });
          await this.emit({
            type: "tool.completed",
            sessionId: this.info.id,
            callId,
            name: call.name,
            ok: false,
            output,
            at: new Date().toISOString(),
          });
          await this.emit({
            type: "task.updated",
            sessionId: this.info.id,
            taskId: callId,
            title: taskTitle,
            status: "failed",
            detail: output.error,
            at: new Date().toISOString(),
          });
        }
      }
    }

    // Exhausted elevated / default round budget without a clean assistant stop.
    if (lastRound >= maxRounds - 1 && maxRounds > 0) {
      await this.emit({
        type: "message.completed",
        sessionId: this.info.id,
        messageId: randomUUID(),
        role: "system",
        text: `本轮达到轮次上限（${maxRounds} 轮）。可用停止中断后，用 /goal 续写目标，或拆成更小步骤继续。`,
        at: new Date().toISOString(),
      });
    }
  }
}
