import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageScaffold } from "./PageScaffold";
import { useAppStore } from "@/store/app-store";
import { cn, formatRelativeTime, shortPath } from "@/lib/utils";

export function HomePage() {
  const navigate = useNavigate();
  const info = useAppStore((s) => s.info);
  const workspace = useAppStore((s) => s.workspace);
  const sessions = useAppStore((s) => s.sessions);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const createSession = useAppStore((s) => s.createSession);
  const selectSession = useAppStore((s) => s.selectSession);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createSession();
      navigate("/chat");
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageScaffold
      title="主页"
      description="HFQ Code · 多 Agent 编码工作台"
      hideTitle
      actions={
        <Button size="sm" disabled={creating} onClick={() => void handleCreate()}>
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="h-4 w-4" />
          )}
          新会话
        </Button>
      }
    >
      <div className="mb-5 overflow-hidden rounded-xl border border-workbench/20 bg-gradient-to-br from-workbench/[0.08] via-white/[0.02] to-transparent shadow-sm shadow-black/20">
        <div className="flex items-start gap-3.5 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-workbench/30 bg-workbench/15 shadow-inner">
            <Sparkles className="h-5 w-5 text-workbench" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold tracking-tight">多 Agent 编码工作台</div>
              {info?.version && (
                <Badge variant="muted" className="font-mono font-normal">
                  v{String(info.version)}
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-balance">
              {workspace?.path
                ? `工作区 ${shortPath(String(workspace.path), 48)} · 会话 / 子 Agent / 技能 / MCP 同屏协作。从最近会话继续，或新建编码任务。`
                : "绑定工作区后打开会话。主 Agent 可 spawn 子任务，技能与 MCP 扩展工具面，改动在右侧检视。"}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {!workspace?.path && (
                <Button size="sm" variant="secondary" onClick={() => void openWorkspace()}>
                  <FolderOpen className="h-4 w-4" />
                  打开工作区
                </Button>
              )}
              <Button
                size="sm"
                variant={workspace?.path ? "default" : "outline"}
                disabled={creating}
                onClick={() => void handleCreate()}
              >
                <MessageSquarePlus className="h-4 w-4" />
                开始会话
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/70 bg-card/70 shadow-none">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">状态</CardTitle>
            <CardDescription>运行时摘要</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 pb-4 text-sm">
            {[
              ["版本", info?.version ? String(info.version) : "—"],
              [
                "模型",
                info?.activeModel && String(info.activeModel).trim()
                  ? String(info.activeModel)
                  : "未配置模型",
              ],
              [
                "提供商",
                info?.activeProviderId && String(info.activeProviderId).trim()
                  ? String(info.activeProviderId)
                  : "—",
              ],
              [
                "工作区",
                workspace?.path ? shortPath(String(workspace.path), 36) : "未绑定",
              ],
            ].map(([k, v], i, arr) => (
              <div
                key={k}
                className={
                  i < arr.length - 1
                    ? "flex justify-between gap-2 border-b border-border/40 py-2"
                    : "flex justify-between gap-2 py-2"
                }
              >
                <span className="text-muted-foreground">{k}</span>
                <span
                  className={cn(
                    "truncate font-medium",
                    k === "模型" && "font-mono",
                    k === "工作区" && !workspace?.path && "text-warning",
                  )}
                  title={String(v)}
                >
                  {v}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70 shadow-none">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm">最近会话</CardTitle>
                <CardDescription>点击继续</CardDescription>
              </div>
              {sessions.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => navigate("/chat")}
                >
                  全部
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-0.5 pb-3.5">
            {sessions.slice(0, 6).map((s) => {
              const running = String(s.status || "").toLowerCase() === "running";
              return (
                <button
                  key={s.id}
                  type="button"
                  className="interactive flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/[0.05]"
                  onClick={async () => {
                    await selectSession(s.id);
                    navigate("/chat");
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {running && <span className="status-dot-running status-pulse" aria-hidden />}
                    <span className="truncate font-medium">{s.title || s.goal || s.id}</span>
                  </span>
                  <span className="shrink-0 pl-2 text-xs text-muted-foreground">
                    {formatRelativeTime(s.updatedAt ?? s.createdAt)}
                  </span>
                </button>
              );
            })}
            {sessions.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                暂无会话
                <div className="mt-3">
                  <Button size="sm" variant="outline" disabled={creating} onClick={() => void handleCreate()}>
                    <MessageSquarePlus className="h-4 w-4" />
                    新建
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageScaffold>
  );
}
