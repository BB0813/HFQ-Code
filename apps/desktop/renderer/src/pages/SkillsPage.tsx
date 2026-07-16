import { useEffect, useMemo, useState } from "react";
import { Eye, FolderPlus, Loader2, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  MetricStrip,
  RefreshButton,
  SectionHeader,
} from "@/components/ui/page-states";
import { asList, getHfq, hasHfq } from "@/lib/hfq";
import { PageScaffold } from "./PageScaffold";

interface SkillItem {
  id?: string;
  name?: string;
  description?: string;
  source?: string;
  enabled?: boolean;
  version?: string;
  tags?: string[];
  capabilities?: string[];
  [key: string]: unknown;
}

function skillTags(s: SkillItem): string[] {
  const raw = [
    ...(Array.isArray(s.tags) ? s.tags : []),
    ...(Array.isArray(s.capabilities) ? s.capabilities : []),
  ]
    .map((t) => String(t).trim())
    .filter(Boolean);
  if (raw.length > 0) return raw.slice(0, 6);
  const fallback: string[] = [];
  if (s.source) fallback.push(String(s.source));
  if (s.version) fallback.push(`v${String(s.version)}`);
  fallback.push("skill");
  return fallback;
}

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [catalog, setCatalog] = useState<SkillItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgUrl, setPkgUrl] = useState("");
  const [preview, setPreview] = useState<{ name?: string; body?: string } | null>(null);

  const refresh = async () => {
    if (!hasHfq()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, cat] = await Promise.all([
        getHfq().listSkills({}),
        getHfq().skillsCatalog({}).catch(() => []),
      ]);
      setSkills(asList<SkillItem>(list, ["skills", "items"]));
      setCatalog(asList<SkillItem>(cat, ["skills", "items", "catalog"]));
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
    const enabled = skills.filter((s) => s.enabled !== false).length;
    const builtin = skills.filter((s) =>
      /builtin|bundled|shipped/i.test(String(s.source ?? "")),
    ).length;
    return [
      { label: "已安装", value: skills.length, hint: "当前可用 skill 包" },
      { label: "已启用", value: enabled, hint: "enabled !== false" },
      { label: "内置/自带", value: builtin, hint: "source 含 builtin/bundled" },
      { label: "目录可发现", value: catalog.length, hint: "skillsCatalog" },
    ];
  }, [skills, catalog]);

  const installFromDir = async () => {
    setBusy(true);
    try {
      // may return { ok: false, cancelled: true } without throw
      const res = (await getHfq().installSkillFromDir({})) as {
        ok?: boolean;
        cancelled?: boolean;
        error?: string;
        code?: string;
      };
      if (res && res.cancelled) {
        toast.message("已取消安装");
        return;
      }
      if (res && res.ok === false) {
        const msg = res.error || "安装失败";
        setError(msg);
        toast.error(msg);
        return;
      }
      await refresh();
      toast.success("已从目录安装");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageScaffold
      hideTitle
      title="技能"
      description="多 Agent 能力扩展 · 已安装与可发现 skill"
      actions={
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void installFromDir()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            从目录安装
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPkgOpen(true)}>
            <Package className="h-4 w-4" />
            从 URL
          </Button>
          <RefreshButton onClick={() => void refresh()} loading={loading} />
        </div>
      }
    >
      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}
      {loading && skills.length === 0 ? (
        <LoadingBlock label="加载技能…" />
      ) : (
        <>
          <MetricStrip items={metrics} />

          <SectionHeader title="已安装能力" count={skills.length} />
          {skills.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="暂无已安装技能"
              description="技能是编码 Agent 的扩展能力包。从本地目录安装，或等待内置 skill 出现。"
              action={
                <Button size="sm" disabled={busy} onClick={() => void installFromDir()}>
                  <FolderPlus className="h-4 w-4" />
                  从目录安装
                </Button>
              }
            />
          ) : (
            <div className="mb-6 grid gap-2.5 sm:grid-cols-2">
              {skills.map((s, i) => {
                const name = s.name || s.id || "skill";
                const on = s.enabled !== false;
                return (
                  <CapabilityCard
                    key={s.id ?? s.name ?? i}
                    title={String(name)}
                    description={s.description || "—"}
                    status={on ? "running" : "off"}
                    tags={skillTags(s)}
                    badges={
                      <>
                        {s.source && (
                          <Badge variant="muted" className="font-normal">
                            {String(s.source)}
                          </Badge>
                        )}
                        {!on && (
                          <Badge variant="outline" className="font-normal">
                            off
                          </Badge>
                        )}
                      </>
                    }
                    trailing={
                      <Button
                        size="sm"
                        variant="ghost"
                        title="预览 SKILL.md"
                        onClick={async () => {
                          try {
                            const r = (await getHfq().previewSkill({ name: String(name) })) as {
                              ok?: boolean;
                              markdown?: string;
                              content?: string;
                              text?: string;
                              error?: string;
                              name?: string;
                            };
                            if (r && r.ok === false) {
                              toast.error(r.error || "预览失败");
                              return;
                            }
                            const body = String(
                              r?.markdown ?? r?.content ?? r?.text ?? JSON.stringify(r, null, 2),
                            );
                            setPreview({ name: String(name), body });
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        预览
                      </Button>
                    }
                  />
                );
              })}
            </div>
          )}

          {catalog.length > 0 && (
            <>
              <SectionHeader title="可发现目录" count={catalog.length} />
              <div className="grid gap-2.5 sm:grid-cols-2">
                {catalog.map((s, i) => (
                  <CapabilityCard
                    key={`c-${s.id ?? s.name ?? i}`}
                    title={String(s.name || s.id || "catalog")}
                    description={s.description || "—"}
                    status="idle"
                    tags={skillTags(s)}
                    badges={
                      <Badge variant="outline" className="font-normal">
                        catalog
                      </Badge>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>从 URL 安装技能包</DialogTitle>
            <DialogDescription>
              仅支持 https zip/tar.gz；不会执行包内脚本。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={pkgUrl}
            onChange={(e) => setPkgUrl(e.target.value)}
            placeholder="https://…/skill.zip"
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPkgOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!pkgUrl.trim() || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = (await getHfq().installSkillFromPackage({
                    packageUrl: pkgUrl.trim(),
                  })) as { ok?: boolean; error?: string; cancelled?: boolean };
                  if (res?.cancelled) {
                    toast.message("已取消");
                    return;
                  }
                  if (res && res.ok === false) {
                    toast.error(res.error || "安装失败");
                    return;
                  }
                  setPkgOpen(false);
                  setPkgUrl("");
                  await refresh();
                  toast.success("已从 URL 安装");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              安装
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>预览 · {preview?.name}</DialogTitle>
            <DialogDescription>SKILL.md</DialogDescription>
          </DialogHeader>
          <pre className="selectable max-h-[50vh] overflow-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {preview?.body || ""}
          </pre>
        </DialogContent>
      </Dialog>
    </PageScaffold>
  );
}
