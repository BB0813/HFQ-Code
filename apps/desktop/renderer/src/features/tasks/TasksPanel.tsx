import { useCallback, useEffect, useState } from "react";
import { ListTree, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState, ErrorBanner, SectionHeader } from "@/components/ui/page-states";
import { asList, getHfq, hasHfq, type SessionInfo, type SpawnAttempt } from "@/lib/hfq";
import { useAppStore } from "@/store/app-store";
import { cn, formatRelativeTime } from "@/lib/utils";

function statusVariant(
  status?: string,
): "success" | "warning" | "destructive" | "muted" | "secondary" {
  const s = (status ?? "").toLowerCase();
  if (s === "failed" || s === "error") return "destructive";
  if (s === "running" || s === "active") return "warning";
  if (s === "completed" || s === "done") return "success";
  if (s === "aborted") return "muted";
  return "secondary";
}

export function TasksPanel({ compact = false }: { compact?: boolean }) {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const [children, setChildren] = useState<SessionInfo[]>([]);
  const [attempts, setAttempts] = useState<SpawnAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState("");
  const [profile, setProfile] = useState<"explore" | "edit" | "shell">("explore");
  const [spawning, setSpawning] = useState(false);

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
      setChildren(asList<SessionInfo>(c));
      setAttempts(asList<SpawnAttempt>(a, ["attempts", "items"]));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeSessionId]);

  useEffect(() => {
    void refresh();
    if (!hasHfq()) return;
    const off = getHfq().onSessionEvent((ev) => {
      if (ev.type === "subagent.updated" || String(ev.type).startsWith("session.")) {
        void refresh();
      }
    });
    return off;
  }, [refresh]);

  const failedAttempts = attempts.filter((a) => a.status === "failed" || a.error);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 text-sm font-semibold">子任务 / 子会话</div>
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
                  void (async () => {
                    setSpawning(true);
                    try {
                      const r = await getHfq().spawnSubagent({
                        sessionId: activeSessionId,
                        goal: goal.trim(),
                        profile,
                      });
                      if (r && r.ok === false) {
                        toast.error(r.error || r.errorCode || "spawn 失败");
                      } else {
                        toast.success("已派生子会话");
                        setGoal("");
                        await refresh();
                      }
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : String(err));
                    } finally {
                      setSpawning(false);
                    }
                  })();
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
                onClick={async () => {
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
                      toast.error(r.error || r.errorCode || "spawn 失败");
                    } else {
                      toast.success("已派生子会话");
                      setGoal("");
                      await refresh();
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : String(err));
                  } finally {
                    setSpawning(false);
                  }
                }}
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

              {failedAttempts.length > 0 && (
                <>
                  <SectionHeader title="失败尝试" count={failedAttempts.length} />
                  <div className="mb-3 flex flex-col gap-1">
                    {failedAttempts.map((a, i) => (
                      <div
                        key={a.id ?? i}
                        className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs"
                      >
                        <div className="font-medium">{a.goal || "spawn"}</div>
                        <div className="mt-0.5 text-xs text-destructive">
                          {a.errorCode ? `[${a.errorCode}] ` : ""}
                          {a.error || a.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <SectionHeader title="子会话" count={children.length} />
              {children.length === 0 ? (
                <EmptyState
                  title="暂无子会话"
                  description="Agent 派生子任务后会出现在这里"
                  className="py-8"
                />
              ) : (
                <div className="flex flex-col gap-1">
                  {children.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-md border border-border/70 bg-card/40 px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-1">
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {c.title || c.goal || c.id}
                        </span>
                        {c.status && (
                          <Badge variant={statusVariant(c.status)} className="font-normal capitalize">
                            {c.status}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {c.subagentProfile ? `${c.subagentProfile} · ` : ""}
                        {formatRelativeTime(c.updatedAt ?? c.createdAt)}
                      </div>
                      {!compact && c.goal && (
                        <div className="mt-1 selectable text-xs text-muted-foreground">{c.goal}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
