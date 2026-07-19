import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  RefreshButton,
  SectionHeader,
} from "@/components/ui/page-states";
import { asList, getHfq, hasHfq } from "@/lib/hfq";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { PageScaffold } from "./PageScaffold";

interface MatrixRow {
  toolName?: string;
  name?: string;
  risk?: string;
  decision?: string;
  effectiveDecision?: string;
  [key: string]: unknown;
}

function decisionVariant(d: string): "success" | "warning" | "destructive" | "muted" | "outline" {
  const v = d.toLowerCase();
  if (v === "allow") return "success";
  if (v === "ask") return "warning";
  if (v === "deny") return "destructive";
  return "muted";
}

export function PermissionsPage() {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const [matrix, setMatrix] = useState<unknown>(null);
  const [allows, setAllows] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [grantTool, setGrantTool] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);

  const refresh = async () => {
    if (!hasHfq()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [m, a] = await Promise.all([
        getHfq().getPolicyMatrix({}),
        activeSessionId
          ? getHfq().getSessionAllows({ sessionId: activeSessionId })
          : Promise.resolve(null),
      ]);
      setMatrix(m);
      setAllows(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [activeSessionId]);

  const rows = useMemo(() => {
    return asList<MatrixRow>(matrix, ["matrix", "items", "rules", "tools"]);
  }, [matrix]);

  const allowList = useMemo(() => {
    // policy:sessionAllows → { sessionId, sessionAllows: string[] }
    if (Array.isArray(allows)) {
      return allows.map((x) =>
        typeof x === "string" ? { toolName: x } : (x as Record<string, unknown>),
      );
    }
    if (allows && typeof allows === "object") {
      const o = allows as Record<string, unknown>;
      const raw = o.sessionAllows ?? o.allows ?? o.items ?? o.tools;
      if (Array.isArray(raw)) {
        return raw.map((x) =>
          typeof x === "string" ? { toolName: x } : (x as Record<string, unknown>),
        );
      }
    }
    return asList<Record<string, unknown>>(allows, ["sessionAllows", "allows", "items", "tools"]);
  }, [allows]);

  return (
    <PageScaffold
      hideTitle
      title="权限"
      description="策略矩阵与当前会话允许项"
      actions={<RefreshButton onClick={() => void refresh()} loading={loading} />}
    >
      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {loading && !matrix ? (
        <LoadingBlock label="加载权限…" />
      ) : (
        <div className="grid gap-3">
          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">策略矩阵</CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1.5">
              {rows.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-border/60">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>工具</span>
                    <span>风险</span>
                    <span>决策</span>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {rows.map((r, i) => {
                      const name = String(r.toolName ?? r.name ?? `tool-${i}`);
                      const risk = String(r.risk ?? "—");
                      const decision = String(r.effectiveDecision ?? r.decision ?? "—");
                      return (
                        <div
                          key={`${name}-${i}`}
                          className={cn(
                            "grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border/40 px-2.5 py-1.5 text-xs last:border-0",
                            i % 2 === 1 && "bg-muted/15",
                          )}
                        >
                          <span className="truncate font-mono text-[11px]">{name}</span>
                          <Badge variant="outline" className="font-normal capitalize">
                            {risk}
                          </Badge>
                          <Badge variant={decisionVariant(decision)} className="font-normal capitalize">
                            {decision}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : matrix ? (
                <pre className="selectable max-h-96 overflow-auto rounded-md border border-border/50 bg-muted/30 p-2 font-mono text-xs">
                  {JSON.stringify(matrix, null, 2)}
                </pre>
              ) : (
                <EmptyState
                  icon={Shield}
                  title="无策略数据"
                  description="使用模型后，Agent 权限矩阵会在此显示。可在 Settings 调整默认权限模式。"
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">
                会话允许{" "}
                {activeSessionId ? (
                  <span className="font-mono font-normal text-muted-foreground">
                    ({activeSessionId.slice(0, 8)}…)
                  </span>
                ) : (
                  <span className="font-normal text-muted-foreground">(无会话)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1.5">
              {!activeSessionId ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  选择会话后可查看本会话 allow_session 项
                </div>
              ) : (
                <>
                  <div className="mb-3 flex gap-1.5">
                    <Input
                      value={grantTool}
                      onChange={(e) => setGrantTool(e.target.value)}
                      placeholder="工具名，如 write_file"
                      className="h-8 font-mono text-xs"
                      disabled={!activeSessionId || grantBusy}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && grantTool.trim()) {
                          e.preventDefault();
                          void (async () => {
                            if (!activeSessionId) return;
                            setGrantBusy(true);
                            try {
                              await getHfq().grantSessionAllow({
                                sessionId: activeSessionId,
                                toolName: grantTool.trim(),
                              });
                              setGrantTool("");
                              await refresh();
                              toast.success("已授予会话允许");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : String(err));
                            } finally {
                              setGrantBusy(false);
                            }
                          })();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={!activeSessionId || !grantTool.trim() || grantBusy}
                      onClick={async () => {
                        if (!activeSessionId || !grantTool.trim()) return;
                        setGrantBusy(true);
                        try {
                          await getHfq().grantSessionAllow({
                            sessionId: activeSessionId,
                            toolName: grantTool.trim(),
                          });
                          setGrantTool("");
                          await refresh();
                          toast.success("已授予会话允许");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : String(err));
                        } finally {
                          setGrantBusy(false);
                        }
                      }}
                    >
                      {grantBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      授予
                    </Button>
                  </div>
                  {allowList.length > 0 ? (
                <>
                  <SectionHeader title="允许的工具" count={allowList.length} />
                  <div className="flex flex-wrap gap-1.5">
                    {allowList.map((a, i) => {
                      const tool = String(a.toolName ?? a.name ?? a.tool ?? JSON.stringify(a));
                      return (
                        <Badge
                          key={i}
                          variant="success"
                          className="gap-1 font-mono font-normal"
                        >
                          {tool}
                          <button
                            type="button"
                            className="ml-0.5 rounded-sm hover:bg-black/20"
                            title="撤销"
                            aria-label={`撤销 ${tool}`}
                            onClick={async () => {
                              if (!activeSessionId) return;
                              try {
                                await getHfq().revokeSessionAllow({
                                  sessionId: activeSessionId,
                                  toolName: tool,
                                });
                                await refresh();
                                toast.success("已撤销");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : String(err));
                              }
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </>
              ) : allows ? (
                <pre className="selectable max-h-72 overflow-auto rounded-md border border-border/50 bg-muted/30 p-2 font-mono text-xs">
                  {JSON.stringify(allows, null, 2)}
                </pre>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  本会话暂无额外允许项
                </div>
              )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageScaffold>
  );
}
