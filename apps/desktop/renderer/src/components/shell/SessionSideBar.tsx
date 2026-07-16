import { useMemo, useState } from "react";
import { FolderOpen, Plus, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatRelativeTime, shortPath } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

export function SessionSideBar() {
  const navigate = useNavigate();
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const createSession = useAppStore((s) => s.createSession);
  const selectSession = useAppStore((s) => s.selectSession);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const workspace = useAppStore((s) => s.workspace);
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((s) => {
      const title = (s.title || s.goal || s.id || "").toLowerCase();
      return title.includes(needle);
    });
  }, [sessions, q]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSession(pendingDelete.id);
      toast.success("会话已删除");
      setPendingDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createSession();
      navigate("/chat");
      toast.success("已创建新会话");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col bg-[hsl(var(--sidebar))]">
      {/* dock-style panel title — Athena sessions pane */}
      <div className="dock-pane-header">
        <div className="dock-pane-title">Agent 会话</div>
        <span className="text-xs tabular-nums text-muted-foreground/70">{sessions.length}</span>
        <div className="ml-auto">
          <Button
            size="icon-sm"
            variant="secondary"
            title="新建会话 (Ctrl+N)"
            aria-label="新建会话"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="h-9 border-border/60 bg-white/[0.03] pl-9 text-sm shadow-none placeholder:text-muted-foreground/55"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void openWorkspace()}
        className={cn(
          "interactive mx-3 mb-2 flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm",
          workspace?.path
            ? "border-border/70 bg-white/[0.02] hover:border-border hover:bg-white/[0.04]"
            : "border-warning/35 bg-warning/[0.07] hover:border-warning/50 hover:bg-warning/[0.12]",
        )}
        title={workspace?.path ? String(workspace.path) : "打开工作区 (Ctrl+O)"}
        aria-label={workspace?.path ? `工作区 ${workspace.path}` : "打开工作区"}
      >
        <FolderOpen
          className={cn(
            "h-4 w-4 shrink-0",
            workspace?.path ? "text-muted-foreground" : "text-warning",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            workspace?.path ? "text-muted-foreground" : "font-medium text-warning",
          )}
        >
          {workspace?.path ? shortPath(String(workspace.path), 32) : "打开工作区"}
        </span>
      </button>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-2.5 pb-3" role="list" aria-label="会话列表">
          {filtered.length === 0 && (
            <div className="px-2 py-14 text-center text-sm text-muted-foreground">
              {q.trim() ? "无匹配会话" : "暂无会话"}
              {!q.trim() && (
                <div className="mt-4">
                  <Button size="sm" variant="outline" disabled={creating} onClick={() => void handleCreate()}>
                    <Plus className="h-4 w-4" />
                    新建会话
                  </Button>
                </div>
              )}
            </div>
          )}
          {filtered.map((s) => {
            const active = s.id === activeSessionId;
            const title = s.title || s.goal || "未命名会话";
            const running = String(s.status || "").toLowerCase() === "running";
            return (
              <div
                key={s.id}
                role="listitem"
                className={cn(
                  "group relative flex items-start gap-1 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150",
                  active
                    ? "bg-white/[0.08] text-foreground ring-1 ring-white/[0.06]"
                    : "text-sidebar-foreground/90 hover:bg-white/[0.04]",
                )}
              >
                {active && (
                  <span
                    className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r bg-zinc-100"
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  className="interactive min-w-0 flex-1 rounded-sm pl-1 text-left"
                  aria-current={active ? "true" : undefined}
                  onClick={async () => {
                    await selectSession(s.id);
                    navigate("/chat");
                  }}
                >
                  <div className="flex items-center gap-2">
                    {running && (
                      <span className="status-dot-running status-pulse" aria-label="运行中" />
                    )}
                    <span className="truncate text-sm font-medium leading-snug">{title}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(s.updatedAt ?? s.createdAt)}
                    {s.status ? ` · ${s.status}` : ""}
                  </div>
                </button>
                <button
                  type="button"
                  className="interactive mt-0.5 rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  title="删除会话"
                  aria-label={`删除 ${title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete({ id: s.id, title });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-sm gap-4 border-border/80 bg-[hsl(240_8%_6%)] p-5">
          <DialogHeader>
            <DialogTitle className="text-base">删除会话</DialogTitle>
            <DialogDescription className="text-sm">
              确定删除「{pendingDelete?.title}」？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "删除中…" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
