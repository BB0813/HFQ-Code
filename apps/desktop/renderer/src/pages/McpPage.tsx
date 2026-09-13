import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Plug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CapabilityCard,
  ChipButton,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  MetricStrip,
  RefreshButton,
} from "@/components/ui/page-states";
import { asList, getHfq, hasHfq } from "@/lib/hfq";
import { PageScaffold } from "./PageScaffold";

interface McpServer {
  id?: string;
  name?: string;
  enabled?: boolean;
  /** Legacy UI field — prefer status === "connected" from packages/mcp */
  connected?: boolean;
  status?: string;
  toolCount?: number;
  tools?: unknown[];
  capabilities?: string[];
  lastError?: string;
  [key: string]: unknown;
}

/** packages/mcp McpServerState uses status, not connected boolean */
function isMcpConnected(s: McpServer): boolean {
  if (s.connected === true) return true;
  return String(s.status || "").toLowerCase() === "connected";
}

function mcpTags(s: McpServer): string[] {
  const tags: string[] = [];
  if (Array.isArray(s.capabilities)) {
    for (const c of s.capabilities) {
      const t = String(c).trim();
      if (t) tags.push(t);
    }
  }
  const toolCount =
    typeof s.toolCount === "number"
      ? s.toolCount
      : Array.isArray(s.tools)
        ? s.tools.length
        : 0;
  if (toolCount > 0) tags.push(`${toolCount} tools`);
  if (s.status) tags.push(String(s.status));
  if (tags.length === 0) tags.push("mcp", isMcpConnected(s) ? "live" : "offline");
  return tags.slice(0, 6);
}

export function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    transport: "stdio" as "stdio" | "http",
    command: "",
    argsText: "",
    url: "",
  });
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const refresh = async () => {
    if (!hasHfq()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await getHfq().listMcp();
      setServers(asList<McpServer>(raw, ["servers", "items", "mcp"]));
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

  const metrics = useMemo(() => {
    const enabled = servers.filter((s) => s.enabled).length;
    const connected = servers.filter((s) => isMcpConnected(s)).length;
    const offline = servers.filter((s) => !isMcpConnected(s)).length;
    return [
      { label: "服务器", value: servers.length },
      { label: "已启用", value: enabled },
      { label: "已连接", value: connected },
      { label: "未连接", value: offline },
    ];
  }, [servers]);

  return (
    <PageScaffold
      hideTitle
      title="MCP"
      description="Model Context Protocol · Agent 工具通道"
      actions={
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            添加
          </Button>
          <RefreshButton onClick={() => void refresh()} loading={loading} />
        </div>
      }
    >
      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}
      {loading && servers.length === 0 ? (
        <LoadingBlock label="加载 MCP…" />
      ) : servers.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="暂无 MCP 服务器"
          description="在配置中添加 MCP server 后，可在此启停、连接，扩展 Agent 工具面。"
        />
      ) : (
        <>
          <MetricStrip items={metrics} />
          <div className="grid gap-2.5">
            {servers.map((s, i) => {
              const id = String(s.id ?? s.name ?? i);
              const busy = busyId === id;
              const connected = isMcpConnected(s);
              const status = connected ? "running" : s.enabled ? "warn" : "off";
              return (
                <CapabilityCard
                  key={id}
                  title={String(s.name || id)}
                  description={
                    s.lastError
                      ? String(s.lastError)
                      : id !== s.name
                        ? id
                        : undefined
                  }
                  status={status}
                  tags={mcpTags(s)}
                  badges={
                    <>
                      {connected && (
                        <Badge variant="success" className="font-normal">
                          connected
                        </Badge>
                      )}
                      {s.enabled ? (
                        <Badge variant="secondary" className="font-normal">
                          enabled
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="font-normal">
                          disabled
                        </Badge>
                      )}
                    </>
                  }
                  trailing={
                    <>
                      <Switch
                        checked={!!s.enabled}
                        disabled={busy}
                        aria-label={`${s.name || id} 启用`}
                        onCheckedChange={async (checked) => {
                          setBusyId(id);
                          try {
                            await getHfq().setMcpEnabled({ id, enabled: checked, name: s.name });
                            await refresh();
                            toast.success(checked ? "已启用" : "已禁用");
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            setError(msg);
                            toast.error(msg);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        title="Ping / 探测连接"
                        onClick={async () => {
                          setBusyId(id);
                          try {
                            const r = (await getHfq().pingMcp({ id })) as {
                              ok?: boolean;
                              latencyMs?: number;
                              status?: string;
                              lastError?: string;
                            };
                            if (r?.ok === false) {
                              toast.error(r.lastError || r.status || "ping 失败");
                            } else {
                              toast.success(
                                `ping ok${r?.latencyMs != null ? ` · ${r.latencyMs}ms` : ""}`,
                              );
                            }
                            await refresh();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : String(e));
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        Ping
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusyId(id);
                          try {
                            if (connected) await getHfq().disconnectMcp({ id, name: s.name });
                            else await getHfq().connectMcp({ id, name: s.name });
                            await refresh();
                            toast.success(connected ? "已断开" : "已连接");
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            setError(msg);
                            toast.error(msg);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {connected ? "断开" : "连接"}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={busy}
                        title="移除服务器"
                        aria-label={`移除 ${s.name || id}`}
                        onClick={() => setRemoveTarget({ id, name: String(s.name || id) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  }
                />
              );
            })}
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加 MCP 服务器</DialogTitle>
            <DialogDescription>stdio 填 command/args；http 填 URL。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5 text-sm">
            <label className="grid grid-cols-[88px_1fr] items-center gap-2">
              <span className="text-xs text-muted-foreground">名称</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="grid grid-cols-[88px_1fr] items-center gap-2">
              <span className="text-xs text-muted-foreground">ID（可选）</span>
              <Input
                className="font-mono text-xs"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              />
            </label>
            <label className="grid grid-cols-[88px_1fr] items-center gap-2">
              <span className="text-xs text-muted-foreground">传输</span>
              <span className="flex gap-1.5">
                <ChipButton active={form.transport === "stdio"} onClick={() => setForm((f) => ({ ...f, transport: "stdio" }))}>
                  stdio
                </ChipButton>
                <ChipButton active={form.transport === "http"} onClick={() => setForm((f) => ({ ...f, transport: "http" }))}>
                  http
                </ChipButton>
              </span>
            </label>
            {form.transport === "stdio" ? (
              <>
                <label className="grid grid-cols-[88px_1fr] items-center gap-2">
                  <span className="text-xs text-muted-foreground">command</span>
                  <Input
                    placeholder="如 npx"
                    className="font-mono text-xs"
                    value={form.command}
                    onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                  />
                </label>
                <label className="grid grid-cols-[88px_1fr] items-center gap-2">
                  <span className="text-xs text-muted-foreground">args</span>
                  <Input
                    placeholder="空格分隔"
                    className="font-mono text-xs"
                    value={form.argsText}
                    onChange={(e) => setForm((f) => ({ ...f, argsText: e.target.value }))}
                  />
                </label>
              </>
            ) : (
              <label className="grid grid-cols-[88px_1fr] items-center gap-2">
                <span className="text-xs text-muted-foreground">URL</span>
                <Input
                  placeholder="https://…"
                  className="font-mono text-xs"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await getHfq().upsertMcp({
                    id: form.id.trim() || undefined,
                    name: form.name.trim() || "Custom MCP",
                    transport: form.transport,
                    command: form.command.trim() || undefined,
                    argsText: form.argsText,
                    url: form.url.trim() || undefined,
                    enabled: true,
                  });
                  setAddOpen(false);
                  setForm({
                    id: "",
                    name: "",
                    transport: "stdio",
                    command: "",
                    argsText: "",
                    url: "",
                  });
                  await refresh();
                  toast.success("已添加 MCP");
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

      <ConfirmDialog
        open={removeTarget != null}
        title={`移除 MCP「${removeTarget?.name ?? ""}」？`}
        description="将从配置中移除该服务器。"
        confirmText="移除"
        destructive
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
        onConfirm={async () => {
          const t = removeTarget;
          if (!t) return;
          setBusyId(t.id);
          try {
            await getHfq().removeMcp({ id: t.id });
            await refresh();
            toast.success("已移除");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
          } finally {
            setBusyId(null);
            setRemoveTarget(null);
          }
        }}
      />
    </PageScaffold>
  );
}
