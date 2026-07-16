import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  FilePenLine,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBanner, SectionHeader } from "@/components/ui/page-states";
import {
  asList,
  getHfq,
  hasHfq,
  type GitLogEntry,
  type GitStatus,
  type GitStatusEntry,
  type SessionChange,
} from "@/lib/hfq";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export function ChangesPanel({ compact = false }: { compact?: boolean }) {
  const workspace = useAppStore((s) => s.workspace);
  const agentChanges = useAppStore((s) => s.changes);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState("");
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Human file editor (writeChangeContent / writeWorkspaceText)
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editOriginal, setEditOriginal] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasHfq() || !workspace?.path) {
      setStatus(null);
      setLog([]);
      return;
    }
    try {
      const st = await getHfq().gitStatus({ includeLog: true, maxEntries: 100 });
      setStatus(st);
      setError(null);
      const logRes = await getHfq().gitLog({ max: 20 });
      setLog(asList<GitLogEntry>(logRes, ["entries", "items"]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [workspace?.path]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadDiff = async (path: string, staged: boolean) => {
    setSelected(path);
    setEditPath(null);
    try {
      const res = await getHfq().gitDiff({ path, staged });
      setDiff(String(res?.diff ?? (res as { content?: string })?.content ?? JSON.stringify(res, null, 2)));
    } catch (e) {
      setDiff(e instanceof Error ? e.message : String(e));
    }
  };

  const openEditor = async (path: string, seed?: SessionChange) => {
    if (!workspace?.path) {
      toast.error("请先打开工作区");
      return;
    }
    setEditPath(path);
    setSelected(path);
    setEditLoading(true);
    setDiff("");
    try {
      let content = "";
      if (seed?.after != null && String(seed.after).length > 0) {
        content = String(seed.after);
      } else if (hasHfq()) {
        const r = await getHfq().readWorkspaceText({ path });
        if (r && typeof r === "object" && "error" in r && r.error) {
          throw new Error(String(r.error));
        }
        content = String(r?.content ?? "");
      }
      setEditContent(content);
      setEditOriginal(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEditContent("");
      setEditOriginal("");
      toast.error(msg);
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditor = () => {
    if (editSaving) return;
    if (editContent !== editOriginal) {
      const ok = window.confirm("有未保存修改，确定关闭？");
      if (!ok) return;
    }
    setEditPath(null);
    setEditContent("");
    setEditOriginal("");
  };

  const saveEditor = async () => {
    if (!editPath || !workspace?.path) return;
    setEditSaving(true);
    try {
      if (activeSessionId) {
        await getHfq().writeChangeContent({
          sessionId: activeSessionId,
          path: editPath,
          content: editContent,
        });
      } else {
        await getHfq().writeWorkspaceText({
          path: editPath,
          content: editContent,
        });
      }
      setEditOriginal(editContent);
      if (activeSessionId) {
        await useAppStore.getState().selectSession(activeSessionId);
      }
      await refresh();
      toast.success(`已写入 ${editPath}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEditSaving(false);
    }
  };

  const stage = async (paths: string[], unstage = false) => {
    setBusy(true);
    try {
      if (unstage) await getHfq().gitUnstage({ paths });
      else await getHfq().gitStage({ paths });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    const msg = message.trim();
    if (!msg) return;
    setBusy(true);
    try {
      await getHfq().gitCommit({ message: msg });
      setMessage("");
      await refresh();
      toast.success("已提交");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setError(err);
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const revertAgent = async (path: string) => {
    if (!activeSessionId) return;
    setBusy(true);
    try {
      await getHfq().revertChange({ sessionId: activeSessionId, path });
      await useAppStore.getState().selectSession(activeSessionId);
      if (editPath === path) {
        setEditPath(null);
        setEditContent("");
        setEditOriginal("");
      }
      toast.success("已还原");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const entries = status?.entries ?? [];
  const dirtyEdit = editPath != null && editContent !== editOriginal;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">
          {status?.isRepo ? (
            <>
              <span className="font-mono text-[11px]">{status.branch}</span>
              {status.dirty ? (
                <Badge variant="warning" className="ml-1.5 font-normal">
                  dirty
                </Badge>
              ) : (
                <Badge variant="success" className="ml-1.5 font-normal">
                  clean
                </Badge>
              )}
            </>
          ) : workspace?.path ? (
            "非 Git 仓库"
          ) : (
            "未绑定工作区"
          )}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8"
          disabled={busy}
          onClick={() => void refresh()}
          title="刷新"
          aria-label="刷新"
        >
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="px-2 pt-2">
          <ErrorBanner message={error} onRetry={() => void refresh()} className="mb-0" />
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {!workspace?.path ? (
            <EmptyState
              icon={GitBranch}
              title="未绑定工作区"
              description="打开工作区后可查看 Agent 改动与 git 状态"
              className="py-10"
            />
          ) : (
            <>
              {agentChanges.length > 0 && (
                <>
                  <SectionHeader title="Agent 改动" count={agentChanges.length} />
                  <div className="mb-3 flex flex-col gap-0.5">
                    {agentChanges.map((c) => (
                      <div
                        key={c.id ?? c.path}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs hover:bg-muted/50",
                          editPath === c.path && "bg-muted",
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left font-mono hover:underline"
                          title="人工编辑"
                          onClick={() => void openEditor(c.path, c)}
                        >
                          {c.path}
                        </button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="人工编辑"
                          aria-label={`编辑 ${c.path}`}
                          disabled={busy || editLoading}
                          onClick={() => void openEditor(c.path, c)}
                        >
                          <FilePenLine className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="在编辑器打开"
                          aria-label={`打开 ${c.path}`}
                          disabled={busy}
                          onClick={async () => {
                            try {
                              await getHfq().openInEditor({ path: c.path });
                            } catch {
                              try {
                                await getHfq().openWorkspaceFile({ path: c.path });
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : String(e));
                              }
                            }
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="还原"
                          aria-label={`还原 ${c.path}`}
                          disabled={busy}
                          onClick={() => void revertAgent(c.path)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Separator className="mb-2" />
                </>
              )}

              <SectionHeader title="工作区文件" count={entries.length} />
              {entries.length === 0 ? (
                <EmptyState
                  title="工作区干净"
                  description="Agent 改动与 git status 会显示在这里；也可从 Agent 改动进入人工编辑"
                  className="py-8"
                />
              ) : (
                <div className="flex flex-col gap-0.5">
                  {entries.map((e: GitStatusEntry) => {
                    const staged = e.xy?.[0] && e.xy[0] !== " " && e.xy[0] !== "?";
                    return (
                      <div
                        key={`${e.xy}-${e.path}`}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs hover:bg-muted/50",
                          (selected === e.path || editPath === e.path) && "bg-muted",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void loadDiff(e.path, !!staged)}
                          className="interactive flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                            {e.xy}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono">{e.path}</span>
                        </button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="人工编辑"
                          aria-label={`编辑 ${e.path}`}
                          disabled={busy || editLoading}
                          onClick={() => void openEditor(e.path)}
                        >
                          <FilePenLine className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={busy}
                          onClick={() => void stage([e.path], !!staged)}
                        >
                          {staged ? "unstage" : "stage"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {editPath && (
                <>
                  <Separator className="my-2" />
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <FilePenLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs" title={editPath}>
                      {editPath}
                    </span>
                    {dirtyEdit && (
                      <Badge variant="warning" className="font-normal">
                        未保存
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={editSaving}
                      onClick={closeEditor}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={editSaving || editLoading || !dirtyEdit}
                      onClick={() => void saveEditor()}
                    >
                      {editSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      保存
                    </Button>
                  </div>
                  {editLoading ? (
                    <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      读取文件…
                    </div>
                  ) : (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[200px] max-h-[min(50vh,420px)] resize-y font-mono text-xs leading-relaxed"
                      spellCheck={false}
                      disabled={editSaving}
                      placeholder="文件内容…"
                    />
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    {activeSessionId
                      ? "保存经 writeChangeContent（会话上下文）写入工作区"
                      : "无活动会话 · 保存经 writeWorkspaceText 直写"}
                  </p>
                </>
              )}

              {!compact && !editPath && selected && (
                <>
                  <Separator className="my-2" />
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 flex-1 truncate font-mono">{selected}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => void openEditor(selected)}
                    >
                      <FilePenLine className="h-3 w-3" />
                      编辑
                    </Button>
                  </div>
                  <pre className="selectable max-h-56 overflow-auto rounded-md border border-border/50 bg-muted/30 p-2 font-mono text-xs leading-relaxed">
                    {diff || "（无 diff）"}
                  </pre>
                </>
              )}

              {!compact && log.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <SectionHeader title="最近提交" count={log.length} />
                  <div className="flex flex-col gap-1">
                    {log.map((e) => (
                      <button
                        key={e.sha}
                        type="button"
                        className="interactive w-full rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted/50"
                        title="查看提交内容 (git show)"
                        onClick={async () => {
                          setEditPath(null);
                          try {
                            const r = await getHfq().gitShow({ object: e.sha });
                            const text =
                              typeof r === "string"
                                ? r
                                : String(
                                    (r as { content?: string; diff?: string })?.content ??
                                      (r as { diff?: string })?.diff ??
                                      JSON.stringify(r, null, 2),
                                  );
                            setSelected(e.shortSha ?? e.sha.slice(0, 7));
                            setDiff(text);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : String(err));
                          }
                        }}
                      >
                        <span className="font-mono text-muted-foreground">
                          {e.shortSha ?? e.sha.slice(0, 7)}
                        </span>{" "}
                        <span className="text-foreground">{e.subject}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {status?.isRepo && (status.dirty || entries.length > 0 || message.trim()) && (
        <div className="border-t border-border/70 p-2">
          <div className="flex gap-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="提交说明"
              className="h-8 text-xs"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && message.trim()) {
                  e.preventDefault();
                  void commit();
                }
              }}
            />
            <Button
              size="sm"
              className="h-8 shrink-0"
              disabled={busy || !message.trim()}
              onClick={() => void commit()}
              title="提交"
              aria-label="提交"
            >
              <GitCommitHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
