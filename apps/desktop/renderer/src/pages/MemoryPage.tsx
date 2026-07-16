import { useEffect, useState } from "react";
import { Database, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  RefreshButton,
} from "@/components/ui/page-states";
import { asList, getHfq, hasHfq } from "@/lib/hfq";
import { formatRelativeTime } from "@/lib/utils";
import { PageScaffold } from "./PageScaffold";

interface MemoryItem {
  id?: string;
  key?: string;
  content?: string;
  text?: string;
  updatedAt?: string;
  at?: string;
  [key: string]: unknown;
}

export function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async (query?: string) => {
    if (!hasHfq()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = query?.trim()
        ? await getHfq().searchMemory({ query: query.trim() })
        : await getHfq().listMemory({});
      setItems(asList<MemoryItem>(raw, ["items", "memories", "results"]));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <PageScaffold
      hideTitle
      title="记忆"
      description="长期记忆条目"
      actions={
        <div className="flex gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索…"
              aria-label="搜索记忆"
              className="h-8 w-48 pl-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void refresh(q);
              }}
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => void refresh(q)}>
            搜索
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            添加
          </Button>
          <RefreshButton onClick={() => void refresh()} loading={loading} />
        </div>
      }
    >
      {error && <ErrorBanner message={error} onRetry={() => void refresh(q)} />}
      {loading && items.length === 0 ? (
        <LoadingBlock label="加载记忆…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Database}
          title={q.trim() ? "无匹配记忆" : "暂无记忆"}
          description={
            q.trim()
              ? "换个关键词试试，或清空搜索查看全部"
              : "Agent 在启用记忆后会写入可检索条目"
          }
          action={
            q.trim() ? (
              <Button
                size="sm"
                variant="outline"
               
                onClick={() => {
                  setQ("");
                  void refresh();
                }}
              >
                清空搜索
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-2">
          {items.map((m, i) => (
            <Card key={m.id ?? m.key ?? i} className="border-border/70 bg-card/70 shadow-none">
              <CardContent className="p-3 text-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="truncate font-medium">{m.key || m.id || `memory-${i}`}</div>
                  <div className="flex shrink-0 items-center gap-1">
                    {(m.updatedAt != null || m.at != null) && (
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(String(m.updatedAt ?? m.at))}
                      </span>
                    )}
                    {m.id && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={busyId === String(m.id)}
                        title="删除记忆"
                        aria-label="删除记忆"
                        onClick={async () => {
                          const id = String(m.id);
                          if (!window.confirm("删除这条记忆？")) return;
                          setBusyId(id);
                          try {
                            await getHfq().removeMemory({ id });
                            await refresh(q);
                            toast.success("已删除");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : String(e));
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="selectable whitespace-pre-wrap leading-relaxed text-muted-foreground">
                  {m.content || m.text || "—"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加记忆</DialogTitle>
            <DialogDescription>写入项目作用域记忆（source=user）。</DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="要记住的内容…"
            className="min-h-[100px] text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!text.trim() || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await getHfq().upsertMemory({ text: text.trim(), source: "user", scope: "project" });
                  setText("");
                  setAddOpen(false);
                  await refresh(q);
                  toast.success("已保存记忆");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScaffold>
  );
}
