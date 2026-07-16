import { useEffect, useState } from "react";
import { BarChart3, Download, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  RefreshButton,
} from "@/components/ui/page-states";
import { getHfq, hasHfq } from "@/lib/hfq";
import { PageScaffold } from "./PageScaffold";

function pickNum(obj: Record<string, unknown> | null, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  // nested totals
  const totals = obj.totals as Record<string, unknown> | undefined;
  if (totals) {
    for (const k of keys) {
      const v = totals[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
  }
  return null;
}

function formatTokens(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function UsagePage() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [exportDir, setExportDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!hasHfq()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = (await getHfq().usageSummary()) as Record<string, unknown>;
      setSummary(s);
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

  const input = pickNum(summary, ["inputTokens", "input", "promptTokens"]);
  const output = pickNum(summary, ["outputTokens", "output", "completionTokens"]);
  const total = pickNum(summary, ["totalTokens", "total"]) ?? (input != null && output != null ? input + output : null);
  const cost = pickNum(summary, ["estimatedCostUsd", "costUsd", "cost"]);

  return (
    <PageScaffold
      hideTitle
      title="用量"
      description="Token / 费用摘要与 CSV 导出"
      actions={
        <div className="flex gap-1.5">
          <RefreshButton onClick={() => void refresh()} loading={loading} />
          <Button
            size="sm"
           
            disabled={busy}
            onClick={async () => {
              if (!hasHfq()) return;
              setBusy(true);
              try {
                const res = await getHfq().usageExport();
                const dir = res?.dir ? String(res.dir) : null;
                setExportDir(dir);
                if (dir) await getHfq().revealInFolder({ path: dir });
                setError(null);
                toast.success("已导出用量");
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                toast.error(msg);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            导出
          </Button>
        </div>
      }
    >
      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {loading && !summary ? (
        <LoadingBlock label="加载用量…" />
      ) : !summary ? (
        <EmptyState
          icon={BarChart3}
          title="暂无用量数据"
          description="发送消息后会累计 token 与费用摘要"
        />
      ) : (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            {[
              ["Input", formatTokens(input)],
              ["Output", formatTokens(output)],
              ["Total", formatTokens(total)],
              ["Cost", cost != null ? `$${cost.toFixed(4)}` : "—"],
            ].map(([label, value]) => (
              <Card key={label} className="border-border/70 bg-card/70 shadow-none">
                <CardContent className="p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="mt-1 font-mono text-sm font-medium tabular-nums">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-3 border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">原始摘要</CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-1.5">
              <pre className="selectable max-h-96 overflow-auto rounded-md border border-border/50 bg-muted/30 p-2 font-mono text-xs leading-relaxed">
                {JSON.stringify(summary, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {exportDir && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground">
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="selectable min-w-0 flex-1 truncate" title={exportDir}>
            {exportDir}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 shrink-0"
            onClick={() => void getHfq().revealInFolder({ path: exportDir })}
          >
            在文件夹中显示
          </Button>
        </div>
      )}
    </PageScaffold>
  );
}
