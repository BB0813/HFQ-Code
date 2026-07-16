import { useEffect, useState } from "react";
import { CheckCircle2, Cpu, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChipButton,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  MetricStrip,
  RefreshButton,
} from "@/components/ui/page-states";
import { asList, getHfq, hasHfq } from "@/lib/hfq";
import { PageScaffold } from "./PageScaffold";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

type ProviderKind = "mock" | "openai_compatible" | "anthropic";

interface ProviderForm {
  id: string;
  name: string;
  kind: ProviderKind;
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  modelsText: string;
  defaultModel: string;
}

const emptyForm = (): ProviderForm => ({
  id: "",
  name: "",
  kind: "openai_compatible",
  enabled: true,
  baseURL: "",
  apiKey: "",
  modelsText: "",
  defaultModel: "",
});

function providerToForm(p: Record<string, unknown>): ProviderForm {
  const models = asList<string | Record<string, unknown>>(p.models, ["models"]).map((m) =>
    typeof m === "string" ? m : String((m as { id?: string }).id ?? ""),
  );
  const kindRaw = String(p.kind ?? "openai_compatible");
  const kind: ProviderKind =
    kindRaw === "mock" || kindRaw === "anthropic" || kindRaw === "openai_compatible"
      ? kindRaw
      : "openai_compatible";
  return {
    id: String(p.id ?? p.providerId ?? ""),
    name: String(p.name ?? p.id ?? ""),
    kind,
    enabled: p.enabled !== false,
    baseURL: String(p.baseURL ?? p.baseUrl ?? ""),
    apiKey: String(p.apiKey ?? ""),
    modelsText: models.filter(Boolean).join(", "),
    defaultModel: String(p.defaultModel ?? models[0] ?? ""),
  };
}

export function ModelsPage() {
  const info = useAppStore((s) => s.info);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!hasHfq()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const cfg = await getHfq().getConfig();
      setConfig(cfg);
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

  const providers = asList<Record<string, unknown>>(
    config?.providers ?? (config as { config?: { providers?: unknown } })?.config?.providers,
    ["providers", "items"],
  );

  const modelCount = providers.reduce((n, p) => {
    return n + asList(p.models, ["models"]).length;
  }, 0);

  const openCreate = () => {
    setEditing(false);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (p: Record<string, unknown>) => {
    setEditing(true);
    setForm(providerToForm(p));
    setFormOpen(true);
  };

  const saveProvider = async () => {
    const id = form.id.trim();
    const name = form.name.trim() || id;
    if (!id) {
      toast.error("请填写 Provider id");
      return;
    }
    if (!name) {
      toast.error("请填写显示名称");
      return;
    }
    const models = form.modelsText
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      // Omit empty apiKey on create; send masked/placeholder as-is so merge keeps real key
      const apiKey = form.apiKey.trim();
      const payload: Record<string, unknown> = {
        id,
        name,
        kind: form.kind,
        enabled: form.enabled,
        baseURL: form.baseURL.trim() || undefined,
        models,
        defaultModel: form.defaultModel.trim() || models[0] || undefined,
      };
      if (apiKey) payload.apiKey = apiKey;

      const next = (await getHfq().upsertProvider(payload)) as Record<string, unknown>;
      setConfig(next);
      setFormOpen(false);
      await bootstrap();
      await refresh();
      toast.success(editing ? `已更新 ${name}` : `已添加 ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const fillPreset = (kind: ProviderKind) => {
    if (kind === "anthropic") {
      setForm((f) => ({
        ...f,
        id: f.id || "anthropic",
        name: f.name || "Anthropic",
        kind: "anthropic",
        baseURL: f.baseURL || "https://api.anthropic.com",
        modelsText:
          f.modelsText || "claude-sonnet-4-20250514, claude-haiku-4-5-20251001",
        defaultModel: f.defaultModel || "claude-sonnet-4-20250514",
      }));
      return;
    }
    if (kind === "openai_compatible") {
      setForm((f) => ({
        ...f,
        id: f.id || "openai-compatible",
        name: f.name || "OpenAI Compatible",
        kind: "openai_compatible",
        baseURL: f.baseURL || "https://api.openai.com/v1",
        modelsText: f.modelsText || "gpt-4o, gpt-4o-mini",
        defaultModel: f.defaultModel || "gpt-4o",
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      id: f.id || "mock",
      name: f.name || "Mock",
      kind: "mock",
      baseURL: "",
      modelsText: f.modelsText || "mock-hfq",
      defaultModel: f.defaultModel || "mock-hfq",
    }));
  };

  return (
    <PageScaffold
      hideTitle
      title="模型"
      description="LLM 提供商 · 会话与子 Agent 共用路由"
      actions={
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            添加 Provider
          </Button>
          <RefreshButton onClick={() => void refresh()} loading={loading} />
        </div>
      }
    >
      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      <MetricStrip
        items={[
          { label: "提供商", value: providers.length },
          { label: "模型条目", value: modelCount },
          {
            label: "当前 Provider",
            value: info?.activeProviderId ? String(info.activeProviderId) : "—",
          },
          {
            label: "当前 Model",
            value: info?.activeModel ? String(info.activeModel).slice(0, 18) : "—",
            hint: info?.activeModel ? String(info.activeModel) : undefined,
          },
        ]}
      />

      <Card className="mb-4 border-workbench/20 bg-card/80 shadow-none">
        <CardHeader className="p-3.5 pb-1.5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="status-dot-running" aria-hidden />
            工作台当前模型
            {info?.activeModel && (
              <Badge variant="success" className="font-mono font-normal">
                active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-3.5 pt-1.5 text-xs">
          <div className="flex justify-between gap-2 border-b border-border/40 py-1.5">
            <span className="text-muted-foreground">Provider</span>
            <span className="font-medium">
              {info?.activeProviderId ? String(info.activeProviderId) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2 py-1.5">
            <span className="text-muted-foreground">Model</span>
            <span className="truncate font-mono font-medium" title={String(info?.activeModel ?? "")}>
              {info?.activeModel ? String(info.activeModel) : "—"}
            </span>
          </div>
          <Button
            size="sm"
            className="mt-2"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setTestOk(false);
              try {
                const res = (await getHfq().testModel({})) as {
                  ok?: boolean;
                  error?: string;
                  latencyMs?: number;
                  reply?: string;
                };
                if (res && res.ok === false) {
                  const msg = res.error || "模型测试失败";
                  setError(msg);
                  toast.error(msg);
                  return;
                }
                setTestOk(true);
                setError(null);
                const latency =
                  typeof res?.latencyMs === "number" ? ` · ${res.latencyMs}ms` : "";
                toast.success(`模型测试通过${latency}`);
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                toast.error(msg);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : testOk ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : null}
            测试当前模型
          </Button>
        </CardContent>
      </Card>

      {loading && providers.length === 0 ? (
        <LoadingBlock label="加载提供商…" />
      ) : providers.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="未解析到 providers"
          description="点击「添加 Provider」配置 OpenAI 兼容 / Anthropic / Mock"
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              添加 Provider
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5">
          {providers.map((p, i) => {
            const id = String(p.id ?? p.providerId ?? i);
            const models = asList<string | Record<string, unknown>>(p.models, ["models"]);
            const isActiveProvider = String(info?.activeProviderId) === id;
            return (
              <div
                key={id}
                className={cn("capability-card p-3.5", isActiveProvider && "border-workbench/25")}
              >
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <span
                    className={isActiveProvider ? "status-dot-running" : "status-dot-idle"}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold tracking-tight">
                    {String(p.name ?? id)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{id}</span>
                  {p.kind ? (
                    <Badge variant="secondary" className="font-mono font-normal">
                      {String(p.kind)}
                    </Badge>
                  ) : null}
                  {p.enabled === false && (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      disabled
                    </Badge>
                  )}
                  {isActiveProvider && (
                    <Badge className="border-workbench/30 bg-workbench/15 font-normal text-workbench">
                      active
                    </Badge>
                  )}
                  <span className="capability-tag">{models.length} models</span>
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3 w-3" />
                      编辑
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {models.length === 0 && (
                    <span className="text-xs text-muted-foreground">无模型列表</span>
                  )}
                  {models.map((m, mi) => {
                    const modelId =
                      typeof m === "string" ? m : String((m as { id?: string }).id ?? mi);
                    const active =
                      isActiveProvider && String(info?.activeModel) === modelId;
                    const key = `${id}:${modelId}`;
                    return (
                      <ChipButton
                        key={modelId}
                        active={active}
                        disabled={switching === key}
                        onClick={async () => {
                          setSwitching(key);
                          try {
                            await getHfq().setActiveModel({ providerId: id, model: modelId });
                            await bootstrap();
                            await refresh();
                            toast.success(`已切换 ${modelId}`);
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            setError(msg);
                            toast.error(msg);
                          } finally {
                            setSwitching(null);
                          }
                        }}
                        className="font-mono"
                      >
                        {switching === key && (
                          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                        )}
                        {modelId}
                      </ChipButton>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑 Provider" : "添加 Provider"}</DialogTitle>
            <DialogDescription>
              写入本地配置。API Key 以脱敏形式回显；留空或不改脱敏值时保留原密钥。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["openai_compatible", "OpenAI 兼容"],
                  ["anthropic", "Anthropic"],
                  ["mock", "Mock"],
                ] as const
              ).map(([k, label]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={form.kind === k ? "secondary" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => {
                    setForm((f) => ({ ...f, kind: k }));
                    if (!editing) fillPreset(k);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="id（唯一）"
                className="font-mono text-xs"
                value={form.id}
                disabled={editing}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              />
              <Input
                placeholder="显示名称"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <Input
              placeholder="baseURL（OpenAI 兼容 / Anthropic）"
              className="font-mono text-xs"
              value={form.baseURL}
              onChange={(e) => setForm((f) => ({ ...f, baseURL: e.target.value }))}
            />
            <Input
              type="password"
              autoComplete="off"
              placeholder={
                form.apiKey && (form.apiKey.includes("…") || form.apiKey === "********")
                  ? "已配置密钥 · 留空或保持脱敏则不改"
                  : "API Key（可选）"
              }
              className="font-mono text-xs"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            />
            <Input
              placeholder="models（逗号分隔）"
              className="font-mono text-xs"
              value={form.modelsText}
              onChange={(e) => setForm((f) => ({ ...f, modelsText: e.target.value }))}
            />
            <Input
              placeholder="defaultModel"
              className="font-mono text-xs"
              value={form.defaultModel}
              onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
            />
            <label className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2.5 py-2 text-xs">
              <span className="text-muted-foreground">启用此 Provider</span>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button size="sm" disabled={saving || !form.id.trim()} onClick={() => void saveProvider()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageScaffold>
  );
}
