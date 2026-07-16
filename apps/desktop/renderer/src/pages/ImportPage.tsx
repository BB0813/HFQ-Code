import { useState } from "react";
import { Download, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBanner } from "@/components/ui/page-states";
import { asList, getHfq, hasHfq } from "@/lib/hfq";
import { PageScaffold } from "./PageScaffold";

export function ImportPage() {
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);

  const scan = async () => {
    if (!hasHfq()) return;
    setScanning(true);
    try {
      const raw = await getHfq().importScan({});
      // agent-core scanImportSources → { candidates, roots }
      const list = asList<Record<string, unknown>>(raw, [
        "candidates",
        "items",
        "apps",
        "results",
      ]);
      setResults(list);
      setError(null);
      toast.success(list.length ? `扫描完成 · ${list.length} 项` : "扫描完成 · 未发现可导入项");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const apply = async () => {
    if (!hasHfq() || results.length === 0) return;
    setApplying(true);
    try {
      // import:apply expects items: { id, conflict? }[]; candidates optional (main re-scans if empty)
      const items = results
        .map((r) => {
          const id = r.id != null ? String(r.id) : "";
          if (!id) return null;
          return { id, conflict: "skip" as const };
        })
        .filter((x): x is { id: string; conflict: "skip" } => x != null);
      if (items.length === 0) {
        toast.error("无可应用项（缺少 id）");
        return;
      }
      // applyImport → { copied, skipped, errors }
      const res = (await getHfq().importApply({
        items,
        candidates: results,
      })) as {
        copied?: unknown[];
        skipped?: unknown[];
        errors?: Array<{ id?: string; error?: string }>;
      };
      const copied = Array.isArray(res?.copied) ? res.copied.length : 0;
      const skipped = Array.isArray(res?.skipped) ? res.skipped.length : 0;
      const errors = Array.isArray(res?.errors) ? res.errors : [];
      if (errors.length > 0 && copied === 0) {
        const msg = errors.map((e) => e.error || e.id || "error").join("; ");
        setError(msg);
        toast.error(msg || "导入失败");
        return;
      }
      setError(null);
      toast.success(`导入完成 · 复制 ${copied} · 跳过 ${skipped}${errors.length ? ` · 错误 ${errors.length}` : ""}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  return (
    <PageScaffold
      hideTitle
      title="导入"
      description="从其他工具扫描并导入配置 / 会话"
      actions={
        <div className="flex gap-1.5">
          <Button size="sm" disabled={scanning || applying} onClick={() => void scan()}>
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4" />
            )}
            扫描
          </Button>
          <Button
            size="sm"
            variant="outline"
           
            disabled={scanning || applying || results.length === 0}
            onClick={() => void apply()}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            应用
          </Button>
        </div>
      }
    >
      {error && <ErrorBanner message={error} onRetry={() => void scan()} />}
      {results.length === 0 ? (
        <EmptyState
          icon={ScanSearch}
          title="尚未扫描"
          description="点击扫描以发现本机可导入的应用配置与会话"
          action={
            <Button size="sm" disabled={scanning} onClick={() => void scan()}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              开始扫描
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2">
          <div className="mb-1 text-xs text-muted-foreground">发现 {results.length} 项</div>
          {results.map((r, i) => (
            <Card key={i} className="border-border/70 bg-card/70 shadow-none">
              <CardHeader className="p-3.5 pb-1.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="truncate">{String(r.name ?? r.app ?? r.id ?? `item-${i}`)}</span>
                  {r.kind != null && (
                    <Badge variant="muted" className="font-normal">
                      {String(r.kind)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-1.5">
                <pre className="selectable max-h-48 overflow-auto rounded-md border border-border/50 bg-muted/25 p-2 font-mono text-xs leading-relaxed text-muted-foreground">
                  {JSON.stringify(r, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageScaffold>
  );
}
