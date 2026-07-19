import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Copy,
  ListTree,
  Loader2,
  Plus,
  RefreshCw,
  ExternalLink,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState, ErrorBanner, SectionHeader } from "@/components/ui/page-states";
import {
  asList,
  getHfq,
  hasHfq,
  sessionModel,
  sessionProviderId,
  type SessionInfo,
  type SpawnAttempt,
} from "@/lib/hfq";
import { type UiTask } from "@/lib/hfq";
import { useAppStore } from "@/store/app-store";
import { cn, formatRelativeTime } from "@/lib/utils";

function statusVariant(
  status?: string,
): "success" | "warning" | "destructive" | "muted" | "secondary" {
  const s = (status ?? "").toLowerCase();
  if (s === "failed" || s === "error") return "destructive";
  if (s === "running" || s === "active" || s === "streaming" || s === "busy") {
    return "warning";
  }
  if (s === "completed" || s === "done" || s === "idle") return "success";
  if (s === "aborted" || s === "cancelled") return "muted";
  return "secondary";
}

/** B3-3: map backend errorCode to short Chinese label. */
function errorCodeLabel(code?: string | null): string | null {
  if (!code) return null;
  const c = String(code).toLowerCase();
  if (c === "depth" || c.includes("depth")) return "嵌套深度超限";
  if (c === "goal_required" || c.includes("goal")) return "缺少目标";
  if (c === "create_failed") return "创建子会话失败";
  if (c === "run_failed") return "子会话运行失败";
  if (c === "busy") return "父会话忙碌";
  if (c === "no_session" || c === "session_not_found") return "会话不存在";
  return code;
}

/** Goal task card (F1) — reused for top-level and child goals. */
function GoalCard({ task: t, compact, sub }: { task: UiTask; compact?: boolean; sub?: boolean }) {
  return (
    <div className="rounded-md border border-border/70 bg-card/40 px-2.5 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <Target className="h-3.5 w-3.5 shrink-0 text-workbench" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {t.objective || t.title}
        </span>
        <Badge variant={statusVariant(t.status)} className="shrink-0 font-normal capitalize">
          {t.status}
        </Badge>
      </div>
      {typeof t.progress === "number" && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-workbench transition-all duration-300"
              style={{ width: `${Math.min(100, t.progress)}%` }}
            />
          </div>
          <span className="tabular-nums text-muted-foreground">{Math.round(t.progress)}%</span>
        </div>
      )}
      {!compact && t.objective && sub && (
        <p className="mt-1 selectable whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
          {t.objective}
        </p>
      )}
      {t.blockedReason && (
        <div className="mt-1 rounded border border-destructive/30 bg-destructive/5 px-1.5 py-1 text-destructive">
          阻塞：{t.blockedReason}
        </div>
      )}
      {t.budget && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {t.budget.maxRounds != null && `最多 ${t.budget.maxRounds} 轮`}
          {t.budget.maxRounds != null && t.budget.maxToolCalls != null && " · "}
          {t.budget.maxToolCalls != null && `最多 ${t.budget.maxToolCalls} 次工具调用`}
        </div>
      )}
      {sub && <div className="mt-1 text-[10px] font-mono text-muted-foreground/60">子任务</div>}
    </div>
  );
}

function attemptKey(a: SpawnAttempt, i: number): string {
  return String(
    a.attemptId ??
      (a as Record<string, unknown>).id ??
      `${a.childSessionId ?? ""}-${a.at ?? a.createdAt ?? a.updatedAt ?? i}`,
  );
}

async function copyText(text: string, okMsg = "已复制") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMsg);
  } catch {
    toast.error("复制失败");
  }
}

export function TasksPanel({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const selectSession = useAppStore((s) => s.selectSession);
  const refreshSessions = useAppStore((s) => s.refreshSessions);

  const [children, setChildren] = useState<SessionInfo[]>([]);
  const [attempts, setAttempts] = useState<SpawnAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState("");
  const [profile, setProfile] = useState<"explore" | "edit" | "shell">("explore");
  const [spawning, setSpawning] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  /** B3-2: local parent stack for「返回父会话」. */
  const [parentStack, setParentStack] = useState<string[]>([]);

  const tasks = useAppStore((s) => s.tasks);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );
  const goalTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.kind === "goal" || (!t.kind && t.title?.toLowerCase().startsWith("goal:")),
      ),
    [tasks],
  );
  // Top-level: no parent, or parent missing (orphan still visible).
  const topGoals = useMemo(() => {
    const ids = new Set(goalTasks.map((t) => t.taskId));
    return goalTasks.filter((t) => !t.parentTaskId || !ids.has(t.parentTaskId));
  }, [goalTasks]);
  const childGoalsByParent = useMemo(() => {
    const ids = new Set(goalTasks.map((t) => t.taskId));
    const map = new Map<string, typeof goalTasks>();
    for (const t of goalTasks) {
      if (t.parentTaskId && ids.has(t.parentTaskId)) {
        const list = map.get(t.parentTaskId) ?? [];
        list.push(t);
        map.set(t.parentTaskId, list);
      }
    }
    return map;
  }, [goalTasks]);

  // Prefer explicit navigation stack (open from Tasks); fall back to session.parentSessionId
  // so return works after sidebar switch / cold open of a child.
  const stackParentId = parentStack.length
    ? parentStack[parentStack.length - 1]
    : null;
  const metaParentId =
    activeSession?.parentSessionId != null
      ? String(activeSession.parentSessionId).trim()
      : "";
  const parentId = stackParentId || metaParentId || null;
  const parentSession = useMemo(
    () => (parentId ? sessions.find((s) => s.id === parentId) ?? null : null),
    [sessions, parentId],
  );
  const canReturnParent = Boolean(parentId);

  const refresh = useCallback(async () => {
    if (!hasHfq() || !activeSessionId) {
      setChildren([]);
      setAttempts([]);
      return;
    }
    setLoading(true);
    try {
      const [c, a] = await Promise.all([
        getHfq().listChildSessions({ sessionId: activeSessionId }),
        getHfq().listSpawnAttempts({ sessionId: activeSessionId }),
      ]);
      let nextChildren = asList<SessionInfo>(c, [
        "sessions",
        "items",
        "children",
      ]);
      // Cold-start fallback: backend now merges disk JSONL, but keep defensive
      // fallback to listSessions parentSessionId for older backends.
      if (nextChildren.length === 0) {
        const fromList = sessions.filter(
          (s) =>
            s.id !== activeSessionId &&
            s.parentSessionId != null &&
            String(s.parentSessionId).trim() === activeSessionId,
        );
        if (fromList.length) nextChildren = fromList;
      } else {
        // Merge richer meta from store (model/providerId may be "" in list)
        const byId = new Map(sessions.map((s) => [s.id, s]));
        nextChildren = nextChildren.map((ch) => {
          const prev = byId.get(ch.id);
          if (!prev) return ch;
          return {
            ...prev,
            ...ch,
            parentSessionId:
              ch.parentSessionId || prev.parentSessionId || activeSessionId,
            goal: ch.goal || prev.goal,
            subagentProfile: ch.subagentProfile || prev.subagentProfile,
            subagentDepth:
              ch.subagentDepth != null ? ch.subagentDepth : prev.subagentDepth,
            // Always use string-normalized identity; "" means unbound.
            model: sessionModel(ch) || sessionModel(prev),
            providerId: sessionProviderId(ch) || sessionProviderId(prev),
          };
        });
      }
      setChildren(nextChildren);
      setAttempts(asList<SpawnAttempt>(a, ["attempts", "items"]));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    void refresh();
    if (!hasHfq() || !activeSessionId) return;
    const off = getHfq().onSessionEvent((ev) => {
      const type = String(ev.type ?? "");
      const sid = String(ev.sessionId ?? "");
      const parentSid = String(ev.parentSessionId ?? "");
      // Parent stream: subagent.updated.sessionId === parentId
      if (
        type === "subagent.updated" &&
        (sid === activeSessionId ||
          parentSid === activeSessionId ||
          !sid)
      ) {
        void refresh();
        return;
      }
      if (
        type.startsWith("session.") &&
        (sid === activeSessionId || !sid)
      ) {
        void refresh();
      }
    });
    return off;
  }, [refresh, activeSessionId]);

  const failedAttempts = attempts.filter(
    (a) =>
      String(a.status ?? "").toLowerCase() === "failed" ||
      String(a.status ?? "").toLowerCase() === "error" ||
      Boolean(a.error) ||
      Boolean(a.errorCode),
  );

  const doSpawn = async () => {
    if (!activeSessionId) return;
    const g = goal.trim();
    if (!g) {
      toast.message("请先填写子任务目标");
      return;
    }
    setSpawning(true);
    try {
      const r = await getHfq().spawnSubagent({
        sessionId: activeSessionId,
        goal: g,
        profile,
      });
      if (r && r.ok === false) {
        const label = errorCodeLabel(r.errorCode);
        toast.error(
          [label, r.error || r.errorCode || "spawn 失败"].filter(Boolean).join(" · "),
        );
        await refresh();
      } else {
        toast.success(
          r?.childSessionId
            ? `已派生子会话 ${String(r.childSessionId).slice(0, 8)}…`
            : "已派生子会话",
        );
        setGoal("");
        // Pull child into sidebar list (listSessions may lag; open path fills meta).
        try {
          await refreshSessions();
        } catch {
          /* optional */
        }
        if (r?.childSessionId) {
          // Warm parent/profile fields if list omitted them.
          useAppStore.setState((s) => ({
            sessions: s.sessions.map((sess) =>
              sess.id === r.childSessionId
                ? {
                    ...sess,
                    parentSessionId: activeSessionId,
                    subagentProfile: profile,
                    goal: g,
                    subagentDepth:
                      typeof sess.subagentDepth === "number"
                        ? sess.subagentDepth
                        : (activeSession?.subagentDepth ?? 0) + 1,
                  }
                : sess,
            ),
          }));
        }
        await refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      await refresh();
    } finally {
      setSpawning(false);
    }
  };

  /** B3-2: open child transcript; push current session as parent. */
  const openChild = async (childId: string) => {
    if (!childId || !activeSessionId) return;
    const fromId = activeSessionId;
    setOpeningId(childId);
    let pushed = false;
    try {
      setParentStack((stack) => {
        if (stack[stack.length - 1] === fromId) return stack;
        pushed = true;
        return [...stack, fromId];
      });
      await selectSession(childId);
      navigate("/chat");
      toast.message("已打开子会话 · 可用「返回父会话」回到上层");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      if (pushed) {
        setParentStack((stack) =>
          stack[stack.length - 1] === fromId ? stack.slice(0, -1) : stack,
        );
      }
    } finally {
      setOpeningId(null);
    }
  };

  const returnToParent = async () => {
    if (!parentId) return;
    const next = parentId;
    const usedStack = Boolean(stackParentId);
    setOpeningId(next);
    try {
      if (usedStack) {
        setParentStack((stack) => stack.slice(0, -1));
      }
      await selectSession(next);
      navigate("/chat");
      toast.message("已返回父会话");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      // restore stack only if we popped it
      if (usedStack) {
        setParentStack((stack) =>
          stack[stack.length - 1] === next ? stack : [...stack, next],
        );
      }
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 text-sm font-semibold">子任务 / 子会话</div>
          {canReturnParent && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={Boolean(openingId)}
              title={
                parentSession
                  ? `返回 ${parentSession.title || parentSession.goal || parentId}`
                  : `返回父会话 ${parentId?.slice(0, 8) ?? ""}`
              }
              onClick={() => void returnToParent()}
            >
              {openingId === parentId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowLeft className="h-3 w-3" />
              )}
              返回父会话
              {parentStack.length > 1 ? (
                <span className="tabular-nums opacity-70">·{parentStack.length}</span>
              ) : !stackParentId && metaParentId ? (
                <span className="opacity-70">·meta</span>
              ) : null}
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => void refresh()}
            title="刷新"
            aria-label="刷新"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
        {activeSessionId && (
          <div className="flex flex-col gap-1.5">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="子任务目标…"
              className="h-8 text-xs"
              disabled={spawning}
              onKeyDown={(e) => {
                if (e.key === "Enter" && goal.trim()) {
                  e.preventDefault();
                  void doSpawn();
                }
              }}
            />
            <div className="flex items-center gap-1">
              {(["explore", "edit", "shell"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={profile === p ? "secondary" : "ghost"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setProfile(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                size="sm"
                className="ml-auto h-7 gap-1 px-2 text-xs"
                disabled={spawning || !activeSessionId}
                title={
                  !goal.trim()
                    ? "先填写子任务目标"
                    : `以 ${profile} 配置派生子会话`
                }
                onClick={() => void doSpawn()}
              >
                {spawning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                派生
              </Button>
            </div>
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {!activeSessionId ? (
            <EmptyState
              icon={ListTree}
              title="选择会话以查看任务"
              description="子会话与失败 spawn 会显示在这里"
              className="py-10"
            />
          ) : (
            <>
              {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

              {/* F1 · goal tasks */}
              <SectionHeader title="目标任务" count={goalTasks.length} />
              {goalTasks.length === 0 ? (
                <p className="mb-3 px-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  暂无目标任务，可在 Chat 输入{" "}
                  <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10px]">
                    /goal …
                  </code>
                </p>
              ) : (
                <div className="mb-3 flex flex-col gap-1.5">
                  {topGoals.map((t) => (
                    <div key={t.taskId}>
                      <GoalCard task={t} compact={compact} />
                      {childGoalsByParent.has(t.taskId) && (
                        <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-border/50 pl-3">
                          {childGoalsByParent.get(t.taskId)!.map((child) => (
                            <GoalCard key={child.taskId} task={child} compact={compact} sub />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* B3-1 · root node: current session goal */}
              <SectionHeader title="当前会话" count={1} />
              <div className="mb-3 rounded-md border border-workbench/25 bg-workbench/5 px-2.5 py-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="status-dot-running" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {activeSession?.title ||
                      activeSession?.goal ||
                      activeSessionId.slice(0, 12)}
                  </span>
                  {activeSession?.status && (
                    <Badge
                      variant={statusVariant(activeSession.status)}
                      className="font-normal capitalize"
                    >
                      {activeSession.status}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {activeSessionId}
                  {activeSession?.subagentProfile
                    ? ` · ${activeSession.subagentProfile}`
                    : ""}
                  {typeof activeSession?.subagentDepth === "number"
                    ? ` · depth ${activeSession.subagentDepth}`
                    : ""}
                </div>
                {(activeSession?.goal || goal) && (
                  <div className="mt-1.5 selectable text-[11px] leading-relaxed text-muted-foreground">
                    目标：{activeSession?.goal || "（未设置会话 goal）"}
                  </div>
                )}
              </div>

              {/* B3-3 · failed attempts */}
              {failedAttempts.length > 0 && (
                <>
                  <SectionHeader title="失败尝试" count={failedAttempts.length} />
                  <div className="mb-3 flex flex-col gap-1">
                    {failedAttempts.map((a, i) => {
                      const code = errorCodeLabel(a.errorCode) || a.errorCode;
                      const detail = String(a.error || a.status || "failed");
                      const goalLabel = a.goal || "（无目标）";
                      const blob = [
                        `goal: ${goalLabel}`,
                        a.attemptId ? `attemptId: ${a.attemptId}` : null,
                        code ? `code: ${a.errorCode || code}` : null,
                        `error: ${detail}`,
                        a.childSessionId
                          ? `child: ${a.childSessionId}`
                          : null,
                        a.profile ? `profile: ${a.profile}` : null,
                      ]
                        .filter(Boolean)
                        .join("\n");
                      return (
                        <div
                          key={attemptKey(a, i)}
                          className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs"
                        >
                          <div className="flex items-start gap-1">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">
                                {a.goal || "（无目标）"}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                {code && (
                                  <Badge
                                    variant="destructive"
                                    className="h-5 font-mono text-[10px] font-normal"
                                  >
                                    {String(a.errorCode || code)}
                                  </Badge>
                                )}
                                {a.profile && (
                                  <Badge
                                    variant="outline"
                                    className="h-5 font-normal capitalize"
                                  >
                                    {a.profile}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 selectable text-xs text-destructive">
                                {code && code !== a.errorCode
                                  ? `${code} · `
                                  : ""}
                                {detail}
                              </div>
                              {(a.at || a.createdAt || a.updatedAt) && (
                                <div className="mt-0.5 text-[10px] text-muted-foreground">
                                  {formatRelativeTime(
                                    String(
                                      a.updatedAt ?? a.at ?? a.createdAt ?? "",
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              title="复制错误信息"
                              aria-label="复制错误信息"
                              onClick={() =>
                                void copyText(blob, "已复制失败详情")
                              }
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* B3-1 / B3-2 · children tree + open */}
              <SectionHeader title="子会话" count={children.length} />
              {children.length === 0 ? (
                <EmptyState
                  title="暂无子会话"
                  description="填写目标后点「派生」，或由 Agent 工具 spawn_subagent 创建"
                  className="py-8"
                />
              ) : (
                <>
                  {/* Group by status: running first, then idle/completed, then failed */}
                  {(["running", "idle", "completed", "failed"] as const).map((g) => {
                    const group = children.filter(
                      (c) => String(c.status ?? "").toLowerCase() === g,
                    );
                    if (!group.length) return null;
                    return (
                      <div key={g} className="mb-2">
                        {children.length > 3 && (
                          <div className="mb-1 px-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                            {g === "running" && "进行中"}
                            {g === "idle" && "空闲"}
                            {g === "completed" && "已完成"}
                            {g === "failed" && "失败"}
                          </div>
                        )}
                        <div
                          className={`flex flex-col gap-1 ${
                            g === "failed"
                              ? "border-l border-destructive/30 pl-2"
                              : "border-l border-border/60 pl-2"
                          }`}
                        >
                          {group.map((c) => {
                            const title = c.title || c.goal || c.id;
                            const isOpening = openingId === c.id;
                            return (
                              <div
                                key={c.id}
                                className="rounded-md border border-border/70 bg-card/40 px-2.5 py-2 text-xs"
                              >
                                <div className="flex items-center gap-1">
                                  {g === "running" && (
                                    <span className="status-dot-running status-pulse shrink-0" />
                                  )}
                                  <span className="min-w-0 flex-1 truncate font-medium">
                                    {title}
                                  </span>
                                  {c.status && (
                                    <Badge
                                      variant={statusVariant(c.status)}
                                      className="font-normal capitalize"
                                    >
                                      {c.status}
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 gap-1 px-2 text-[11px]"
                                    disabled={isOpening}
                                    title="打开子会话 transcript"
                                    onClick={() => void openChild(c.id)}
                                  >
                                    {isOpening ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <ExternalLink className="h-3 w-3" />
                                    )}
                                    打开
                                  </Button>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                  {c.subagentProfile && (
                                    <span className="rounded border border-border/50 px-1 font-mono text-[10px] uppercase">
                                      {c.subagentProfile}
                                    </span>
                                  )}
                                  {typeof c.subagentDepth === "number" && (
                                    <span className="font-mono text-[10px] opacity-70">
                                      d{c.subagentDepth}
                                    </span>
                                  )}
                                  <span>{formatRelativeTime(c.updatedAt ?? c.createdAt)}</span>
                                  {sessionModel(c) && (
                                    <span className="font-mono text-[10px] opacity-70">
                                      {sessionModel(c).slice(0, 16)}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                                  {c.id.slice(0, 12)}…
                                  {c.parentSessionId
                                    ? ` · ↳ ${String(c.parentSessionId).slice(0, 6)}…`
                                    : ""}
                                </div>
                                {!compact && c.goal && (
                                  <div className="mt-1 selectable text-xs text-muted-foreground">
                                    {c.goal}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
