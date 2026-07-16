import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        <div className="grid gap-1.5">
          <div className="mb-1 text-xs text-muted-foreground">
            {events.length} 条{paused ? " · 已暂停" : " · 实时"}
          </div>
          {events.map((ev, i) => {
            const type = String(ev.type ?? "event");
            const sessionId = ev.sessionId ? String(ev.sessionId) : "";
            return (
              <Card
                key={`${type}-${i}-${ev._ts ?? i}`}
                className="border-border/60 bg-card/60 shadow-none"
              >
                <CardContent className="flex gap-2 p-2 text-xs">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={typeVariant(type)} className="font-mono font-normal">
                        {type}
                      </Badge>
                      {sessionId && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {sessionId.slice(0, 8)}
                        </span>
                      )}
                      {ev._ts && (
                        <span className="text-xs text-muted-foreground/70">
                          {new Date(ev._ts).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <pre
                      className={cn(
                        "selectable max-h-24 overflow-auto rounded border border-border/40 bg-muted/25 p-1.5 font-mono text-xs leading-relaxed text-muted-foreground",
                      )}
                    >
                      {JSON.stringify(ev, null, 0)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageScaffold>
  );
}
