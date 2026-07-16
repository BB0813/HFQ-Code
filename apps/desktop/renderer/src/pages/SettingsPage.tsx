import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChipButton,
  ErrorBanner,
  LoadingBlock,
} from "@/components/ui/page-states";
import {
  getHfq,
  hasHfq,
  type AppPaths,
  type AvailableShell,
  type InstallUpdateResult,
  type UpdateDownloadStatus,
} from "@/lib/hfq";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import { PageScaffold } from "./PageScaffold";

function humanizeInstallError(msg: string): string {
  if (/no installer file|download first|尚未下载安装包/i.test(msg)) {
    return "尚未下载安装包，请先点「下载更新」";
  }
  return msg;
}

export function SettingsPage() {
  const pathsFromStore = useAppStore((s) => s.paths);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [paths, setPaths] = useState<AppPaths | null>(pathsFromStore);
  const [shells, setShells] = useState<AvailableShell[]>([]);
  const [terminalShell, setTerminalShell] = useState("auto");
  const [proxyUrl, setProxyUrl] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [planModeDefault, setPlanModeDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [diagBusy, setDiagBusy] = useState<string | null>(null);
  const [dlPercent, setDlPercent] = useState<number | null>(null);

  useEffect(() => {
    if (!hasHfq()) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const hfq = getHfq();
        const timeout = <T,>(p: Promise<T>, ms = 4000) =>
          Promise.race([p, new Promise<null>((r) => window.setTimeout(() => r(null), ms))]);
        const [p, sh, cfg] = await Promise.all([
          timeout(hfq.getAppPaths().catch(() => null)),
          timeout(hfq.ptyShells().catch(() => ({ shells: [] as AvailableShell[], preferred: "" }))),
          timeout(hfq.getConfig().catch(() => null)),
        ]);
        if (cancelled) return;
        if (p) setPaths(p as AppPaths);
        const shellsRes = (sh as { shells?: AvailableShell[]; preferred?: string } | null) ?? null;
        setShells(Array.isArray(shellsRes?.shells) ? shellsRes!.shells! : []);
        const preferred = shellsRes?.preferred ? String(shellsRes.preferred) : "";
        setTerminalShell(preferred || "auto");
        const prefs =
          (cfg as { prefs?: Record<string, unknown> } | null)?.prefs ??
          (cfg as { config?: { prefs?: Record<string, unknown> } } | null)?.config?.prefs ??
          {};
        if (typeof prefs.proxyUrl === "string") setProxyUrl(prefs.proxyUrl);
        if (typeof prefs.memoryEnabled === "boolean") setMemoryEnabled(prefs.memoryEnabled);
        if (typeof prefs.planModeDefault === "boolean") setPlanModeDefault(prefs.planModeDefault);
        if (prefs.theme === "light" || prefs.theme === "dark") setTheme(prefs.theme);
        if (typeof prefs.terminalShell === "string" && prefs.terminalShell) {
          setTerminalShell(String(prefs.terminalShell));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setTheme]);

  const save = async () => {
    if (!hasHfq()) return;
    setSaving(true);
    try {
      await getHfq().setPrefs({
        theme,
        proxyUrl,
        memoryEnabled,
        planModeDefault,
        terminalShell: terminalShell === "auto" ? "" : terminalShell,
      });
      setSaved(true);
      setError(null);
      toast.success("设置已保存");
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const encoding = paths?.credentialsEncoding ?? "unknown";
  const shellOptions = [
    { kind: "auto", label: "自动", available: true },
    ...shells.filter((s) => s.kind && s.kind !== "auto"),
  ];

  return (
    <PageScaffold
      title="设置"
      description="偏好、凭证与诊断"
      hideTitle
      actions={
        <Button size="sm" disabled={saving || !loaded} onClick={() => void save()}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? "已保存" : "保存"}
        </Button>
      }
    >
      {error && <ErrorBanner message={error} />}
      {!loaded ? (
        <LoadingBlock label="加载偏好…" />
      ) : (
        <div className="grid gap-3">
          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">外观</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3 p-3.5 pt-1.5">
              <span className="text-xs text-muted-foreground">主题</span>
              <div className="flex gap-1">
                {(["dark", "light"] as const).map((t) => (
                  <ChipButton key={t} active={theme === t} onClick={() => setTheme(t)}>
                    {t === "dark" ? "Dark" : "Light"}
                  </ChipButton>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">终端</CardTitle>
              <CardDescription>默认 PTY shell</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 p-3.5 pt-1.5">
              {shellOptions.map((s) => {
                const kind = String(s.kind || "auto");
                const active = terminalShell === kind || (!terminalShell && kind === "auto");
                return (
                  <ChipButton
                    key={kind}
                    active={active}
                    disabled={s.available === false}
                    onClick={() => setTerminalShell(kind)}
                  >
                    {s.label || kind}
                  </ChipButton>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3.5 pt-1.5">
              <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">启用记忆</span>
                <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">默认计划模式</span>
                <Switch checked={planModeDefault} onCheckedChange={setPlanModeDefault} />
              </label>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="shrink-0 text-muted-foreground">代理 URL</span>
                <Input
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="http://…"
                  className="h-8 w-64 max-w-[60%] text-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">凭证与路径</CardTitle>
              <CardDescription>Windows DPAPI 状态</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3.5 pt-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">credentialsEncoding</span>
                <Badge
                  variant={
                    encoding === "dpapi-current-user"
                      ? "success"
                      : encoding === "plaintext"
                        ? "destructive"
                        : "muted"
                  }
                  className="font-mono font-normal"
                >
                  {String(encoding)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">DPAPI</span>
                <Badge variant={paths?.credentialsDpapi ? "success" : "muted"} className="font-normal">
                  {paths?.credentialsDpapi ? "yes" : "no"}
                </Badge>
              </div>
              {paths?.credentialsPath && (
                <div className="flex items-center justify-between gap-2">
                  <span className="selectable truncate text-muted-foreground" title={String(paths.credentialsPath)}>
                    {String(paths.credentialsPath)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => void getHfq().revealInFolder({ path: String(paths.credentialsPath) })}
                  >
                    显示
                  </Button>
                </div>
              )}
              {paths?.configPath && (
                <div className="flex items-center justify-between gap-2">
                  <span className="selectable truncate text-muted-foreground" title={String(paths.configPath)}>
                    {String(paths.configPath)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => void getHfq().openPath({ path: String(paths.configPath) })}
                  >
                    打开
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">诊断</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 p-3.5 pt-1.5">
              <Button
                size="sm"
                variant="outline"
               
                disabled={!!diagBusy}
                onClick={async () => {
                  setDiagBusy("export");
                  try {
                    const res = (await getHfq().exportDiagnostics()) as {
                      dir?: string;
                      files?: string[];
                    };
                    setError(null);
                    if (res?.dir) {
                      try {
                        await getHfq().revealInFolder({ path: String(res.dir) });
                      } catch {
                        /* reveal is best-effort */
                      }
                      toast.success(`诊断包已导出 · ${res.dir}`);
                    } else {
                      toast.success("诊断包已导出");
                    }
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    setError(msg);
                    toast.error(msg);
                  } finally {
                    setDiagBusy(null);
                  }
                }}
              >
                {diagBusy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                导出诊断包
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!diagBusy}
                onClick={async () => {
                  setDiagBusy("update");
                  try {
                    const r = (await getHfq().checkForUpdates({ force: true })) as {
                      updateAvailable?: boolean;
                      recommendedAsset?: { url?: string; name?: string };
                    };
                    setError(null);
                    if (r?.updateAvailable) {
                      toast.success("发现新版本，可下载安装");
                    } else {
                      toast.success("已是最新版本");
                    }
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    setError(msg);
                    toast.error(msg);
                  } finally {
                    setDiagBusy(null);
                  }
                }}
              >
                {diagBusy === "update" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                检查更新
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!diagBusy}
                onClick={async () => {
                  setDiagBusy("download");
                  setDlPercent(0);
                  let off: (() => void) | undefined;
                  try {
                    off = getHfq().onUpdateDownload?.((st) => {
                      const s = st as UpdateDownloadStatus;
                      const status = String(s?.status ?? "");
                      if (s?.percent != null) {
                        const p = Math.max(0, Math.min(100, Math.round(Number(s.percent))));
                        setDlPercent(p);
                        toast.message(`下载中 ${p}%`, { id: "upd-dl" });
                      }
                      if (status === "failed") {
                        toast.error(String(s.error || "下载失败"), { id: "upd-dl" });
                      }
                      if (status === "cancelled") {
                        toast.message("已取消下载", { id: "upd-dl" });
                      }
                    });
                    await getHfq().downloadUpdate({});
                    toast.success("下载完成，可点安装更新", { id: "upd-dl" });
                    setDlPercent(100);
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    setError(msg);
                    toast.error(msg, { id: "upd-dl" });
                  } finally {
                    off?.();
                    setDiagBusy(null);
                  }
                }}
              >
                {diagBusy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {diagBusy === "download" && dlPercent != null
                  ? `下载中 ${dlPercent}%`
                  : "下载更新"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!!diagBusy}
                onClick={async () => {
                  setDiagBusy("install");
                  let off: (() => void) | undefined;
                  try {
                    // Backend may auto-download when no local installer (D3).
                    off = getHfq().onUpdateDownload?.((st) => {
                      const s = st as UpdateDownloadStatus;
                      const status = String(s?.status ?? "");
                      if (status === "downloading" && s?.percent != null) {
                        const p = Math.max(0, Math.min(100, Math.round(Number(s.percent))));
                        setDlPercent(p);
                        toast.message(`正在下载安装包… ${p}%`, { id: "upd-dl" });
                      }
                      if (status === "failed") {
                        toast.error(String(s.error || "自动下载失败"), { id: "upd-dl" });
                      }
                    });
                    const r = (await getHfq().installUpdate({})) as InstallUpdateResult;
                    if (r && r.cancelled) {
                      toast.message("已取消安装");
                    } else if (r && r.ok === false) {
                      const msg = humanizeInstallError(String(r.error || "安装失败"));
                      setError(msg);
                      toast.error(msg);
                    } else if (r?.quitSuggested) {
                      toast.success("安装程序已打开，完成后可关闭本窗口");
                    } else {
                      toast.success("安装程序已打开");
                    }
                  } catch (e) {
                    const msg = humanizeInstallError(
                      e instanceof Error ? e.message : String(e),
                    );
                    setError(msg);
                    toast.error(msg);
                  } finally {
                    off?.();
                    setDiagBusy(null);
                  }
                }}
              >
                {diagBusy === "install" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                安装更新
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!!diagBusy}
                onClick={async () => {
                  try {
                    await getHfq().openReleasePage({});
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                打开发布页
              </Button>
              <p className="basis-full text-[11px] leading-relaxed text-muted-foreground">
                安装包发布者 HFQ-ClodBreeze（自签）；首次可能触发 SmartScreen。
                不会在检查后静默下载，需手动「下载更新」或「安装更新」。
                {dlPercent != null && diagBusy === "download"
                  ? ` · 进度 ${dlPercent}%`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </PageScaffold>
  );
}
