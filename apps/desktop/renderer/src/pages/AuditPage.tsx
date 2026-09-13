import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page-states";
import { getHfq, hasHfq, type SessionEvent } from "@/lib/hfq";
import { cn } from "@/lib/utils";
import { PageScaffold } from "./PageScaffold";

function typeVariant(
  type: string,
): "success" | "warning" | "destructive" | "muted" | "outline" | "secondary" {
  if (type.includes("failed") || type.includes("error")) return "destructive";
  if (type.includes("permission")) return "warning";
  if (type.includes("completed") || type.includes("resolved")) return "success";
  if (type.startsWith("tool.")) return "secondary";
  if (type.startsWith("message.")) return "outline";
  return "muted";
}

export function AuditPage() {
  const [events, setEvents] = useState<(SessionEvent & { _ts?: number })[]>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!hasHfq()) return;
    const off = getHfq().onSessionEvent((ev) => {
      if (paused) return;
      setEvents((prev) => [{ ...ev, _ts: Date.now() }, ...prev].slice(0, 200));
    });
    return off;
  }, [paused]);

  return (
    <PageScaffold
      hideTitle
      title="审计"
      description="实时 session 事件流（本窗口内）"
      actions={
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={paused ? "default" : "outline"}
           
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "继续" : "暂停"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEvents([])}>
            清空
          </Button>
        </div>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={paused ? "已暂停采集" : "等待 session 事件…"}
          description="发送消息或运行工具后，事件会实时出现在此列表"
        />
      ) : (
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">
            {events.length} 条{paused ? " · 已暂停" : " · 实时"}
          </div>
          <div className="overflow-hidden rounded-md border border-border/60">
            {events.map((ev, i) => {
              const type = String(ev.type ?? "event");
              const sessionId = ev.sessionId ? String(ev.sessionId) : "";
              return (
                <div
                  key={`${type}-${i}-${ev._ts ?? i}`}
                  className={cn(
                    "border-b border-border/40 px-2.5 py-1.5 text-xs last:border-0",
                    i % 2 === 1 && "bg-muted/15",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={typeVariant(type)} className="font-mono font-normal">
                      {type}
                    </Badge>
                    {sessionId && (
                      <span className="font-mono text-muted-foreground">
                        {sessionId.slice(0, 8)}
                      </span>
                    )}
                    {ev._ts && (
                      <span className="text-muted-foreground/70">
                        {new Date(ev._ts).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <pre
                    className={cn(
                      "selectable mt-1 max-h-20 overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground",
                    )}
                  >
                    {JSON.stringify(ev, null, 0)}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageScaffold>
  );
}
