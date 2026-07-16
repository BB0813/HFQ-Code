import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
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
import {
  asList,
  getHfq,
  hasHfq,
  type ListProviderModelsResult,
} from "@/lib/hfq";
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

/** Built-in third-party platform templates (OpenAI-compatible unless noted). */
type PlatformPreset = {
  id: string;
  label: string;
  kind: ProviderKind;
  name: string;
  baseURL: string;
  models: string;
  defaultModel: string;
  hint: string;
};

const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    kind: "openai_compatible",
    name: "OpenCode Zen",
    baseURL: "https://opencode.ai/zen/v1",
    models: "mimo-v2.5-free, grok-4.5, gpt-5-nano",
    defaultModel: "mimo-v2.5-free",
    hint: "必须带 /zen/v1，不要写成 /zen",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai_compatible",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    models: "gpt-4.1, gpt-4o, gpt-4o-mini",
    defaultModel: "gpt-4.1",
    hint: "官方 OpenAI · base 以 /v1 结尾",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "anthropic",
    name: "Anthropic",
    baseURL: "https://api.anthropic.com",
    models: "claude-sonnet-4-20250514, claude-haiku-4-5-20251001",
    defaultModel: "claude-sonnet-4-20250514",
    hint: "Messages API · 非 OpenAI 路径",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai_compatible",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    models: "deepseek-chat, deepseek-reasoner",
    defaultModel: "deepseek-chat",
    hint: "OpenAI 兼容",
  },
  {
    id: "moonshot",
    label: "Moonshot",
    kind: "openai_compatible",
    name: "Moonshot / Kimi",
    baseURL: "https://api.moonshot.cn/v1",
    models: "moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k",
    defaultModel: "moonshot-v1-8k",
    hint: "月之暗面 OpenAI 兼容",
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai_compatible",
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    models: "llama-3.3-70b-versatile, mixtral-8x7b-32768",
    defaultModel: "llama-3.3-70b-versatile",
    hint: "注意路径含 /openai/v1",
  },
  {
    id: "dashscope",
    label: "通义兼容",
    kind: "openai_compatible",
    name: "DashScope Compatible",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: "qwen-plus, qwen-turbo, qwen-max",
    defaultModel: "qwen-plus",
    hint: "阿里云 compatible-mode/v1",
  },
  {
    id: "openai-compat",
    label: "通用兼容",
    kind: "openai_compatible",
    name: "OpenAI Compatible",
    baseURL: "https://api.openai.com/v1",
    models: "gpt-4o, gpt-4o-mini",
    defaultModel: "gpt-4o",
    hint: "中转站 / 自建：base 通常以 /v1 结尾",
  },
  {
    id: "mock",
    label: "Mock",
    kind: "mock",
    name: "Mock",
    baseURL: "",
    models: "mock-hfq",
    defaultModel: "mock-hfq",
    hint: "离线探测，无需 Key",
  },
];

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

/** Light client-side baseURL polish (mirrors providers normalize for known hosts). */
function polishBaseURL(raw: string, kind: ProviderKind): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed || kind !== "openai_compatible") return trimmed;
  try {
    const withProto = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    const path = u.pathname.replace(/\/+$/, "") || "";
    if (/\/v\d+[a-z]*$/i.test(path)) {
      u.pathname = path;
      return u.toString().replace(/\/+$/, "");
    }
    if (
      (u.hostname === "opencode.ai" || u.hostname.endsWith(".opencode.ai")) &&
      path === "/zen"
    ) {
      u.pathname = "/zen/v1";
      return u.toString().replace(/\/+$/, "");
    }
    if (u.hostname === "api.openai.com" && (path === "" || path === "/")) {
      return "https://api.openai.com/v1";
    }
    if (u.hostname === "api.deepseek.com" && (path === "" || path === "/")) {
      return "https://api.deepseek.com/v1";
    }
    if (u.hostname === "api.moonshot.cn" && (path === "" || path === "/")) {
      return "https://api.moonshot.cn/v1";
    }
    if (u.hostname === "api.groq.com" && path === "/openai") {
      return "https://api.groq.com/openai/v1";
    }
    if (
      (u.hostname === "dashscope.aliyuncs.com" ||
        u.hostname.endsWith(".dashscope.aliyuncs.com")) &&
      path === "/compatible-mode"
    ) {
      u.pathname = "/compatible-mode/v1";
      return u.toString().replace(/\/+$/, "");
    }
  } catch {
    /* keep raw */
  }
  return trimmed;
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
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  /** Remote/config enumeration cache keyed by provider id (not persisted). */
  const [listedByProvider, setListedByProvider] = useState<
    Record<string, ListProviderModelsResult>
  >({});
  const [listingId, setListingId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);

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
  const hasProviders = providers.length > 0;
  const activeProviderId = String(info?.activeProviderId ?? "").trim();
  const activeModelId = String(info?.activeModel ?? "").trim();
  const hasActiveModel = Boolean(activeProviderId && activeModelId);

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

  const parseModelsText = (text: string): string[] =>
    text
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const removeProvider = async (p: Record<string, unknown>) => {
    const id = String(p.id ?? p.providerId ?? "").trim();
    const name = String(p.name ?? id);
    if (!id) return;
    // Product decision: mock and last provider are deletable. Empty list is allowed;
    // backend must clear/reassign active* and fail closed when no provider remains.
    const isActive = String(info?.activeProviderId) === id;
    const isLast = providers.length <= 1;
    const isMock = id === "mock";
    const ok = window.confirm(
      [
        `确定删除渠道「${name}」(${id})？`,
        "",
        "将从本地配置移除（含该渠道密钥）。",
        isMock ? "这是 Mock 渠道：删除后离线兜底不可用，除非再添加。" : "",
        isLast
          ? "这是当前最后一个渠道：删除后 providers 将为空，新会话/探测在补回渠道前会失败。"
          : isActive
            ? "当前工作台正在使用该渠道，删除后应回落到其他渠道或清空 active。"
            : "不影响其他渠道。",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (!ok) return;
    setRemovingId(id);
    try {
      const next = (await getHfq().removeProvider({ id })) as Record<string, unknown>;
      setConfig(next);
      await bootstrap();
      await refresh();
      toast.success(`已删除 ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRemovingId(null);
    }
  };

  const testProviderModel = async (
    providerId: string,
    model?: string,
    label?: string,
  ) => {
    const pid = providerId.trim();
    if (!pid) return;
    if (!hasProviders) {
      toast.error("尚未配置模型渠道，请到模型页添加");
      return;
    }
    const mid = (model ?? "").trim();
    const key = `${pid}:${mid || "*"}`;
    setTestingKey(key);
    try {
      const res = (await getHfq().testModel({
        providerId: pid,
        ...(mid ? { model: mid } : {}),
      })) as {
        ok?: boolean;
        error?: string;
        latencyMs?: number;
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
      toast.success(
        `探测通过 ${label || mid || pid}${latency}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setTestingKey(null);
    }
  };

  const refreshProviderModels = async (providerId: string) => {
    const pid = providerId.trim();
    if (!pid) return;
    setListingId(pid);
    try {
      const res = await getHfq().listProviderModels({ providerId: pid });
      setListedByProvider((prev) => ({ ...prev, [pid]: res }));
      if (res.warning) toast.message(String(res.warning));
      if (res.ok === false) {
        toast.error(res.error || "刷新模型列表失败");
        return;
      }
      const n = Array.isArray(res.models) ? res.models.length : 0;
      const src = res.source || "config";
      toast.success(`已刷新 ${pid} · ${n} 个模型（${src}）`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setListingId(null);
    }
  };

  /** Merge remote/config listed models into persisted provider.models. */
  const mergeListedIntoConfig = async (p: Record<string, unknown>) => {
    const id = String(p.id ?? p.providerId ?? "").trim();
    if (!id) return;
    const listed = listedByProvider[id];
    const remote = (listed?.models ?? []).map(String).filter(Boolean);
    if (!remote.length) {
      toast.message("没有可写入的模型列表，请先「刷新模型列表」");
      return;
    }
    const current = asList<string | Record<string, unknown>>(p.models, ["models"]).map((m) =>
      typeof m === "string" ? m : String((m as { id?: string }).id ?? ""),
    ).filter(Boolean);
    const merged = Array.from(new Set([...current, ...remote]));
    const defaultModel =
      String(p.defaultModel ?? "").trim() ||
      (merged.includes(activeModelId) ? activeModelId : merged[0]!) ||
      "";
    setMergingId(id);
    try {
      const payload: Record<string, unknown> = {
        id,
        name: String(p.name ?? id),
        kind: p.kind,
        enabled: p.enabled !== false,
        baseURL: p.baseURL ?? p.baseUrl,
        models: merged,
        defaultModel,
      };
      // Keep masked apiKey out of payload so merge preserves real key
      const next = (await getHfq().upsertProvider(payload)) as Record<string, unknown>;
      setConfig(next);
      await bootstrap();
      await refresh();
      toast.success(`已写入配置 ${merged.length} 个模型 → ${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setMergingId(null);
    }
  };

  const activateModel = async (providerId: string, modelId: string) => {
    const key = `${providerId}:${modelId}`;
    setSwitching(key);
    try {
      const res = (await getHfq().setActiveModel({
        providerId,
        model: modelId,
      })) as {
        sessionApplied?: {
          id?: string;
          model?: string;
          providerId?: string;
        } | null;
        sessionApplyError?: string | null;
      };
      await bootstrap();
      await refresh();
      const store = useAppStore.getState();
      // Immediately reflect hot-swap on sessions[] so header/status match without waiting list.
      if (res?.sessionApplied?.id && res.sessionApplied.model) {
        const sid = String(res.sessionApplied.id);
        const mid = String(res.sessionApplied.model).trim();
        const pid =
          (res.sessionApplied.providerId &&
            String(res.sessionApplied.providerId).trim()) ||
          providerId;
        useAppStore.setState((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sid
              ? {
                  ...sess,
                  model: mid,
                  providerId: pid || sess.providerId,
                  updatedAt: new Date().toISOString(),
                }
              : sess,
          ),
        }));
      }
      try {
        await store.refreshSessions();
      } catch {
        /* ignore */
      }
      // Re-open active session so open rebind / snapshot identity is authoritative.
      const activeId = useAppStore.getState().activeSessionId;
      if (activeId) {
        try {
          await useAppStore.getState().selectSession(activeId);
        } catch {
          /* optional */
        }
      }
      const err = res?.sessionApplyError ? String(res.sessionApplyError) : "";
      if (err) {
        // Global active already applied — never roll back on sessionApplyError.
        toast.message(`全局已切换，当前会话暂未应用：${err}`);
      } else if (res?.sessionApplied?.model) {
        toast.success(`已切换 ${modelId}（当前会话已同步）`);
      } else {
        toast.success(`已设为默认 ${modelId}（新建/重开会话生效）`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const human = /no model provider|providers empty|no provider|not configured|empty/i.test(
        msg,
      )
        ? "尚未配置模型渠道，请到模型页添加"
        : msg;
      setError(human);
      toast.error(human);
    } finally {
      setSwitching(null);
    }
  };

  const saveProvider = async () => {
    const id = form.id.trim();
    const name = form.name.trim() || id;
    if (!id) {
      toast.error("请填写 Provider id");
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) {
      toast.error("id 仅允许字母数字、点、下划线、连字符，且不以符号开头");
      return;
    }
    if (!name) {
      toast.error("请填写显示名称");
      return;
    }
    const models = parseModelsText(form.modelsText);
    if (models.length === 0) {
      toast.error("请至少填写一个模型 id（逗号分隔）");
      return;
    }
    if (new Set(models).size !== models.length) {
      toast.error("模型列表有重复 id，请去重后再保存");
      return;
    }
    let defaultModel = form.defaultModel.trim();
    if (!defaultModel) {
      defaultModel = models[0]!;
      setForm((f) => ({ ...f, defaultModel }));
      toast.message(`未填 defaultModel，已默认 ${defaultModel}`);
    } else if (!models.includes(defaultModel)) {
      toast.error(
        `defaultModel「${defaultModel}」不在 models 列表中。请改成列表内的 id，或先写入 models。`,
      );
      return;
    }
    if (
      (form.kind === "openai_compatible" || form.kind === "anthropic") &&
      !form.baseURL.trim()
    ) {
      toast.error("请填写 baseURL（OpenAI 兼容一般以 /v1 结尾）");
      return;
    }
    const polishedBase = polishBaseURL(form.baseURL, form.kind);
    if (polishedBase && polishedBase !== form.baseURL.trim().replace(/\/+$/, "")) {
      setForm((f) => ({ ...f, baseURL: polishedBase }));
      toast.message(`已自动纠正 baseURL → ${polishedBase}`);
    }
    setSaving(true);
    try {
      // Omit empty apiKey on create; send masked/placeholder as-is so merge keeps real key
      const apiKey = form.apiKey.trim();
      const payload: Record<string, unknown> = {
        id,
        name,
        kind: form.kind,
        enabled: form.enabled,
        baseURL: polishedBase || undefined,
        models,
        defaultModel,
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

  const applyPlatformPreset = (preset: PlatformPreset, force = false) => {
    setForm((f) => ({
      ...f,
      id: force || !f.id ? preset.id : f.id,
      name: force || !f.name ? preset.name : f.name,
      kind: preset.kind,
      baseURL: force || !f.baseURL ? preset.baseURL : f.baseURL,
      modelsText: force || !f.modelsText ? preset.models : f.modelsText,
      defaultModel: force || !f.defaultModel ? preset.defaultModel : f.defaultModel,
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
            value: hasActiveModel ? activeProviderId : "未配置",
          },
          {
            label: "当前 Model",
            value: hasActiveModel ? activeModelId.slice(0, 18) : "未配置模型",
            hint: hasActiveModel ? activeModelId : "providers 为空或未选择模型",
          },
        ]}
      />

      <Card className="mb-4 border-workbench/20 bg-card/80 shadow-none">
        <CardHeader className="p-3.5 pb-1.5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span
              className={hasActiveModel ? "status-dot-running" : "status-dot-idle"}
              aria-hidden
            />
            工作台当前模型
            {hasActiveModel ? (
              <Badge variant="success" className="font-mono font-normal">
                active
              </Badge>
            ) : (
              <Badge variant="outline" className="font-normal text-warning">
                未配置模型
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-3.5 pt-1.5 text-xs">
          {!hasProviders && (
            <p className="rounded-md border border-warning/30 bg-warning/5 px-2.5 py-2 text-[11px] leading-relaxed text-warning">
              当前没有任何渠道。删除 mock / 最后一个渠道后 providers 可为空；新建会话与探测会失败，请先「添加 Provider」。
            </p>
          )}
          <div className="flex justify-between gap-2 border-b border-border/40 py-1.5">
            <span className="text-muted-foreground">Provider</span>
            <span className="font-medium">
              {hasActiveModel ? activeProviderId : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2 py-1.5">
            <span className="text-muted-foreground">Model</span>
            <span
              className={
                hasActiveModel
                  ? "truncate font-mono font-medium"
                  : "truncate font-medium text-warning"
              }
              title={hasActiveModel ? activeModelId : "未配置模型"}
            >
              {hasActiveModel ? activeModelId : "未配置模型"}
            </span>
          </div>
          <Button
            size="sm"
            className="mt-2"
            disabled={busy || !hasProviders || !hasActiveModel}
            title={
              !hasProviders
                ? "无渠道，无法测试"
                : !hasActiveModel
                  ? "未选择模型，无法测试"
                  : "测试当前工作台模型"
            }
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
          title="尚未配置任何渠道"
          description="mock 与最后一个渠道均可删除。空列表时会话/探测 fail-closed — 点击下方添加 Provider（OpenCode Zen / OpenAI / 通义等）"
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
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      title="刷新模型列表（远端优先，失败回落配置）"
                      disabled={listingId === id}
                      onClick={() => void refreshProviderModels(id)}
                    >
                      {listingId === id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      刷新列表
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      title={`用默认模型探测渠道 ${id}`}
                      disabled={Boolean(testingKey?.startsWith(`${id}:`))}
                      onClick={() => {
                        const first =
                          typeof models[0] === "string"
                            ? models[0]
                            : String((models[0] as { id?: string } | undefined)?.id ?? "");
                        const def = String(p.defaultModel ?? "").trim() || first;
                        void testProviderModel(
                          id,
                          def,
                          `${String(p.name ?? id)}/${def || "default"}`,
                        );
                      }}
                    >
                      {testingKey?.startsWith(`${id}:`) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      探测
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3 w-3" />
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                      disabled={removingId === id}
                      title={id === "mock" ? "删除 Mock（允许；删后无离线兜底）" : providers.length <= 1 ? "删除最后一个渠道（允许；将清空 providers）" : `删除 ${id}`}
                      onClick={() => void removeProvider(p)}
                    >
                      {removingId === id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      删除
                    </Button>
                  </div>
                </div>
                {p.baseURL || p.baseUrl ? (
                  <div className="mb-2 truncate font-mono text-[10px] text-muted-foreground" title={String(p.baseURL ?? p.baseUrl)}>
                    {String(p.baseURL ?? p.baseUrl)}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {models.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      无模型列表 · 编辑渠道补全 models 后才能切换/探测
                    </span>
                  )}
                  {models.map((m, mi) => {
                    const modelId =
                      typeof m === "string" ? m : String((m as { id?: string }).id ?? mi);
                    const active =
                      isActiveProvider && String(info?.activeModel) === modelId;
                    const key = `${id}:${modelId}`;
                    return (
                      <div key={modelId} className="inline-flex items-center gap-0.5">
                        <ChipButton
                          active={active}
                          disabled={switching === key}
                          onClick={() => void activateModel(id, modelId)}
                          className="font-mono"
                        >
                          {switching === key && (
                            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                          )}
                          {modelId}
                        </ChipButton>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          title={`探测 ${id}/${modelId}`}
                          disabled={testingKey === key}
                          onClick={(e) => {
                            e.stopPropagation();
                            void testProviderModel(id, modelId, `${id}/${modelId}`);
                          }}
                        >
                          {testingKey === key ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {listedByProvider[id] && (
                  <div className="mt-2.5 space-y-1.5 rounded-md border border-border/50 bg-muted/20 p-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>远端/枚举列表</span>
                      <Badge variant="secondary" className="font-mono font-normal">
                        {String(listedByProvider[id]?.source ?? "—")}
                      </Badge>
                      {listedByProvider[id]?.ok === false && (
                        <span className="text-destructive">
                          {String(listedByProvider[id]?.error ?? "failed")}
                        </span>
                      )}
                      {listedByProvider[id]?.warning && (
                        <span className="text-warning">
                          {String(listedByProvider[id]?.warning)}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-6 gap-1 px-2 text-[11px]"
                        disabled={
                          mergingId === id ||
                          !Array.isArray(listedByProvider[id]?.models) ||
                          (listedByProvider[id]?.models?.length ?? 0) === 0
                        }
                        onClick={() => void mergeListedIntoConfig(p)}
                      >
                        {mergingId === id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        写入配置
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(listedByProvider[id]?.models ?? []).length === 0 && (
                        <span className="text-[11px] text-muted-foreground">无模型</span>
                      )}
                      {(listedByProvider[id]?.models ?? []).map((mid) => {
                        const modelId = String(mid);
                        const key = `${id}:${modelId}`;
                        const active =
                          isActiveProvider && String(info?.activeModel) === modelId;
                        const inConfig = models.some((m) => {
                          const cfgId =
                            typeof m === "string"
                              ? m
                              : String((m as { id?: string }).id ?? "");
                          return cfgId === modelId;
                        });
                        return (
                          <ChipButton
                            key={`listed-${modelId}`}
                            active={active}
                            disabled={switching === key}
                            onClick={() => void activateModel(id, modelId)}
                            className="font-mono"
                            title={
                              inConfig
                                ? "已在配置 models 中"
                                : "点选设为默认（后端可顺带 append 到 models）"
                            }
                          >
                            {switching === key && (
                              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                            )}
                            {modelId}
                            {!inConfig && (
                              <span className="ml-1 opacity-60">·remote</span>
                            )}
                          </ChipButton>
                        );
                      })}
                    </div>
                  </div>
                )}
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
              增删改查：添加 / 编辑 / 删除渠道，点选模型设为默认并热切换当前会话。API Key 脱敏回显；留空则保留原密钥。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5 text-sm">
            {!editing && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-muted-foreground">平台预设</div>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORM_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      size="sm"
                      variant={
                        form.id === preset.id || form.name === preset.name
                          ? "secondary"
                          : "outline"
                      }
                      className="h-7 text-xs"
                      title={preset.hint}
                      onClick={() => applyPlatformPreset(preset, true)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {PLATFORM_PRESETS.find((p) => p.id === form.id)?.hint ||
                    "OpenAI 兼容渠道的 baseURL 一般以 /v1 结尾；OpenCode Zen 必须是 /zen/v1"}
                </p>
              </div>
            )}
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
                    if (!editing) {
                      const preset = PLATFORM_PRESETS.find((p) => p.kind === k);
                      if (preset) applyPlatformPreset(preset, false);
                    }
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
              placeholder="baseURL（OpenAI 兼容一般以 /v1 结尾）"
              className="font-mono text-xs"
              value={form.baseURL}
              onChange={(e) => setForm((f) => ({ ...f, baseURL: e.target.value }))}
              onBlur={() => {
                const next = polishBaseURL(form.baseURL, form.kind);
                if (next !== form.baseURL.trim().replace(/\/+$/, "")) {
                  setForm((f) => ({ ...f, baseURL: next }));
                }
              }}
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
            <div className="space-y-1">
              <Input
                placeholder="models（逗号分隔，至少一个）"
                className="font-mono text-xs"
                value={form.modelsText}
                onChange={(e) => setForm((f) => ({ ...f, modelsText: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                保存前会校验：非空、去重；defaultModel 必须落在列表内（空则取第一项）。
              </p>
            </div>
            <Input
              placeholder="defaultModel（须属于上方 models）"
              className="font-mono text-xs"
              value={form.defaultModel}
              onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
              list="hfq-provider-model-options"
            />
            <datalist id="hfq-provider-model-options">
              {parseModelsText(form.modelsText).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
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
