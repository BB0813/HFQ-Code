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

function clampCompactChars(raw: string): number {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return 48000;
  return Math.min(200000, Math.max(8000, n));
}

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
  const [codingProfiles, setCodingProfiles] = useState<
    Array<{ id: string; name: string; description?: string; icon?: string; enabled?: boolean }>
  >([]);
  const [activeCodingProfileId, setActiveCodingProfileId] = useState("");
  const [skillMatchEnabled, setSkillMatchEnabled] = useState(true);
  const [titleModel, setTitleModel] = useState("");
  const [compressionModel, setCompressionModel] = useState("");
  const [compactMaxChars, setCompactMaxChars] = useState("48000");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [diagBusy, setDiagBusy] = useState<string | null>(null);
  const [dlPercent, setDlPercent] = useState<number | null>(null);
  // 1.1.7 update policy
  const [autoCheck, setAutoCheck] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [silentInstall, setSilentInstall] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [checkIntervalHours, setCheckIntervalHours] = useState(24);

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
        if (Array.isArray(prefs.codingProfiles)) {
          setCodingProfiles(
            prefs.codingProfiles.map((p) => ({
              id: String((p as { id?: string }).id || ""),
              name: String((p as { name?: string }).name || ""),
              description: (p as { description?: string }).description,
              icon: (p as { icon?: string }).icon,
              enabled: (p as { enabled?: boolean }).enabled !== false,
            })),
          );
        }
        if (typeof prefs.activeCodingProfileId === "string") {
          setActiveCodingProfileId(prefs.activeCodingProfileId);
        }
        // Keep Header chip in sync when opening Settings (1.1.6).
        {
          const activeId =
            typeof prefs.activeCodingProfileId === "string"
              ? prefs.activeCodingProfileId.trim()
              : "";
          const profiles = Array.isArray(prefs.codingProfiles)
            ? (prefs.codingProfiles as Array<{ id?: string; name?: string }>)
            : [];
          const name = activeId
            ? profiles.find((p) => String(p.id || "") === activeId)?.name ?? null
            : null;
          useUiStore.getState().setCodingProfileName(name ? String(name) : null);
        }
        if (prefs.skillMatch && typeof prefs.skillMatch === "object") {
          const sm = prefs.skillMatch as { enabled?: boolean };
          if (typeof sm.enabled === "boolean") setSkillMatchEnabled(sm.enabled);
        }
        const roles = (prefs.modelRoles || {}) as {
          title?: { model?: string };
          compression?: { model?: string };
        };
        if (roles.title?.model) setTitleModel(String(roles.title.model));
        if (roles.compression?.model) setCompressionModel(String(roles.compression.model));
        if (typeof prefs.compactMaxChars === "number") {
          setCompactMaxChars(String(Math.round(prefs.compactMaxChars)));
        }
        // 1.1.7 updatePolicy
        const up = (prefs.updatePolicy || {}) as Record<string, unknown>;
        if (typeof up.autoCheck === "boolean") setAutoCheck(up.autoCheck);
        if (typeof up.autoDownload === "boolean") setAutoDownload(up.autoDownload);
        if (typeof up.silentInstall === "boolean") setSilentInstall(up.silentInstall);
        if (typeof up.checkIntervalHours === "number") {
          setCheckIntervalHours(Math.min(168, Math.max(1, Math.round(up.checkIntervalHours))));
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
        activeCodingProfileId,
        skillMatch: { enabled: skillMatchEnabled },
        compactMaxChars: clampCompactChars(compactMaxChars),
        updatePolicy: {
          autoCheck,
          autoDownload,
          silentInstall,
          checkIntervalHours: Math.min(168, Math.max(1, Math.round(checkIntervalHours))),
        },
        modelRoles: {
          title: titleModel.trim() ? { model: titleModel.trim() } : null,
          compression: compressionModel.trim() ? { model: compressionModel.trim() } : null,
        },
      });
      // Hot-update Header coding-profile chip (1.1.6).
      const activeName = activeCodingProfileId
        ? codingProfiles.find((p) => p.id === activeCodingProfileId)?.name ?? null
        : null;
      useUiStore.getState().setCodingProfileName(activeName);
      setSaved(true);
      setError(null);
      toast.success(
        activeCodingProfileId
          ? "设置已保存 · Coding Profile 对新会话生效"
          : "设置已保存",
      );
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
              <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">技能渐进匹配</span>
                <Switch checked={skillMatchEnabled} onCheckedChange={setSkillMatchEnabled} />
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
              <CardTitle className="text-sm">Coding Profiles</CardTitle>
              <CardDescription>
                编程角色预设（Kivio 风格，仅 coding）。新会话会注入 system addon / 技能偏好。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3.5 pt-1.5">
              <div className="flex flex-wrap gap-1.5">
                <ChipButton
                  active={!activeCodingProfileId}
                  onClick={() => setActiveCodingProfileId("")}
                >
                  无
                </ChipButton>
                {codingProfiles
                  .filter((p) => p.enabled !== false)
                  .map((p) => (
                    <ChipButton
                      key={p.id}
                      active={activeCodingProfileId === p.id}
                      onClick={() => setActiveCodingProfileId(p.id)}
                      title={p.description || p.name}
                    >
                      {p.icon ? `${p.icon} ` : ""}
                      {p.name}
                    </ChipButton>
                  ))}
              </div>
              {activeCodingProfileId && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {codingProfiles.find((p) => p.id === activeCodingProfileId)?.description ||
                    "已选择配置，创建新会话后生效。"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">模型角色</CardTitle>
              <CardDescription>
                标题 / 压缩可指定更便宜的 model id（空 = 跟随主对话；仅填 model 时用当前
                activeProviderId）。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3.5 pt-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="shrink-0 text-muted-foreground">标题模型</span>
                <Input
                  value={titleModel}
                  onChange={(e) => setTitleModel(e.target.value)}
                  placeholder="可选 model id"
                  className="h-8 w-64 max-w-[60%] font-mono text-xs"
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="shrink-0 text-muted-foreground">压缩模型</span>
                <Input
                  value={compressionModel}
                  onChange={(e) => setCompressionModel(e.target.value)}
                  placeholder="可选 model id"
                  className="h-8 w-64 max-w-[60%] font-mono text-xs"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                配置后长上下文 compact 时尝试用该模型做 LLM 摘要；失败回退启发式。空 = 仅启发式。
              </p>
              <div className="flex items-center justify-between gap-3 text-xs pt-1">
                <span className="shrink-0 text-muted-foreground">Compact 触发阈值</span>
                <Input
                  value={compactMaxChars}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setCompactMaxChars(v);
                  }}
                  placeholder="48000"
                  className="h-8 w-32 font-mono text-xs"
                />
                <span className="text-[11px] text-muted-foreground">字符（8000–200000）</span>
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

          {/* 1.1.7 Update management */}
          <Card className="border-border/70 bg-card/70 shadow-none">
            <CardHeader className="p-3.5 pb-1.5">
              <CardTitle className="text-sm">更新</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3.5 pt-1.5">
              {/* Policy toggles */}
              <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">启动时自动检查更新</span>
                <Switch checked={autoCheck} onCheckedChange={setAutoCheck} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">有更新时后台自动下载</span>
                <Switch checked={autoDownload} onCheckedChange={setAutoDownload} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 text-xs opacity-50">
                <span className="text-muted-foreground">自动安装（1.1.8 预置）</span>
                <Switch
                  checked={silentInstall}
                  onCheckedChange={(v) => {
                    setSilentInstall(v);
                    toast.message("自动安装将在 1.1.8 版本生效");
                  }}
                  disabled
                />
              </label>

              {/* Status + actions */}
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground/80">
                    {updateStatus === "idle" && "等待检查"}
                    {updateStatus === "checking" && "正在检查更新…"}
                    {updateStatus === "downloading" && "下载中"}
                    {updateStatus === "ready" && `新版本已就绪${updateVersion ? ` · v${updateVersion}` : ""}`}
                    {updateStatus === "failed" && "更新失败"}
                    {updateStatus === "up_to_date" && "已是最新版本"}
                    {updateStatus === "cancelled" && "已取消"}
                  </span>
                  {updateVersion && updateStatus !== "ready" && (
                    <span className="text-muted-foreground">{updateVersion}</span>
                  )}
                </div>
                {updateStatus === "downloading" && dlPercent != null && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-workbench transition-all duration-300"
                      style={{ width: `${Math.min(100, dlPercent)}%` }}
                    />
                  </div>
                )}
                {updateError && (
                  <div className="mt-1 text-destructive">{updateError}</div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={updateStatus === "ready" ? "secondary" : "outline"}
                  disabled={!!diagBusy}
                  onClick={async () => {
                    setDiagBusy("update");
                    setUpdateError(null);
                    try {
                      const r = (await getHfq().checkForUpdates({ force: true })) as {
                        updateAvailable?: boolean;
                        recommendedAsset?: { url?: string; name?: string };
                      };
                      if (r?.updateAvailable) {
                        setUpdateStatus("idle");
                        toast.success("发现新版本，可下载安装");
                      } else {
                        setUpdateStatus("up_to_date");
                        toast.success("已是最新版本");
                      }
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : String(e);
                      setUpdateError(msg);
                      setUpdateStatus("failed");
                      toast.error(msg);
                    } finally {
                      setDiagBusy(null);
                    }
                  }}
                >
                  {diagBusy === "update" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  检查更新
                </Button>
                {updateStatus === "ready" ? (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={!!diagBusy}
                    onClick={async () => {
                      setDiagBusy("install");
                      setUpdateError(null);
                      let off: (() => void) | undefined;
                      try {
                        off = getHfq().onUpdateDownload?.((st) => {
                          const s = st as UpdateDownloadStatus;
                          if (s?.status === "downloading" && s?.percent != null) {
                            setDlPercent(s.percent);
                            toast.message(`正在下载安装包… ${Math.round(s.percent)}%`, { id: "upd-dl" });
                          }
                          if (s?.status === "failed") {
                            toast.error(String(s.error || "自动下载失败"), { id: "upd-dl" });
                          }
                        });
                        const r = (await getHfq().installUpdate({})) as InstallUpdateResult;
                        if (r?.cancelled) {
                          toast.message("已取消安装");
                        } else if (r?.ok === false) {
                          const msg = humanizeInstallError(String(r.error || "安装失败"));
                          setUpdateError(msg);
                          toast.error(msg);
                        } else if (r?.quitSuggested) {
                          toast.success("安装程序已打开，完成后可关闭本窗口");
                        } else {
                          toast.success("安装程序已打开");
                        }
                      } catch (e) {
                        const msg = humanizeInstallError(e instanceof Error ? e.message : String(e));
                        setUpdateError(msg);
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
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!diagBusy}
                    onClick={async () => {
                      setDiagBusy("download");
                      setDlPercent(0);
                      setUpdateError(null);
                      let off: (() => void) | undefined;
                      try {
                        off = getHfq().onUpdateDownload?.((st) => {
                          const s = st as UpdateDownloadStatus;
                          if (s?.percent != null) {
                            const p = Math.max(0, Math.min(100, Math.round(Number(s.percent))));
                            setDlPercent(p);
                            setUpdateStatus("downloading");
                            toast.message(`下载中 ${p}%`, { id: "upd-dl" });
                          }
                          if (s?.status === "completed") {
                            setUpdateStatus("ready");
                            toast.success("下载完成，可点安装更新", { id: "upd-dl" });
                          }
                          if (s?.status === "failed") {
                            setUpdateError(String(s.error || "下载失败"));
                            setUpdateStatus("failed");
                            toast.error(String(s.error || "下载失败"), { id: "upd-dl" });
                          }
                          if (s?.status === "cancelled") {
                            toast.message("已取消下载", { id: "upd-dl" });
                          }
                        });
                        await getHfq().downloadUpdate({});
                        setUpdateStatus("ready");
                        toast.success("下载完成，可点安装更新", { id: "upd-dl" });
                        setDlPercent(100);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        setUpdateError(msg);
                        setUpdateStatus("failed");
                        toast.error(msg, { id: "upd-dl" });
                      } finally {
                        off?.();
                        setDiagBusy(null);
                      }
                    }}
                  >
                    {diagBusy === "download" && dlPercent != null
                      ? `下载中 ${Math.round(dlPercent)}%`
                      : "下载更新"}
                  </Button>
                )}
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
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                安装包发布者 HFQ-ClodBreeze（自签）；首次可能触发 SmartScreen。{autoCheck ? `每 ${checkIntervalHours}h 后台检查。` : ""}
              </p>
            </CardContent>
          </Card>

          {/* Diagnostics */}
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
                      } catch { /* best-effort */ }
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
            </CardContent>
          </Card>
        </div>
      )}
    </PageScaffold>
  );
}
