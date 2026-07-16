import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  File,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBanner } from "@/components/ui/page-states";
import {
  getHfq,
  hasHfq,
  type WorkspaceDirEntry,
} from "@/lib/hfq";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

const TEXT_EXT =
  /\.(md|txt|json|jsonc|ya?ml|toml|xml|html?|css|scss|less|js|jsx|mjs|cjs|ts|tsx|mts|cts|py|rs|go|java|kt|c|cc|cpp|h|hpp|cs|rb|php|sh|bash|zsh|ps1|bat|cmd|sql|graphql|gql|vue|svelte|astro|ini|cfg|conf|env|gitignore|gitattributes|editorconfig|dockerfile|makefile|cmake|lock|log|csv|tsv|svg|map)$/i;

const HIDDEN_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  "__pycache__",
  ".turbo",
  "release",
]);

function isProbablyText(path: string, size?: number): boolean {
  if (size != null && size > 1_500_000) return false;
  const base = path.split("/").pop() || path;
  if (TEXT_EXT.test(base)) return true;
  if (!base.includes(".")) {
    return /^(readme|license|makefile|dockerfile|agents|changelog)$/i.test(base);
  }
  return false;
}

function formatSize(n?: number): string {
  if (n == null || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ name, open }: { name: string; open?: boolean }) {
  if (open) return <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500/90" />;
  const base = name.split("/").pop() || name;
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(base)) {
    return <FileCode className="h-3.5 w-3.5 shrink-0 text-sky-400/90" />;
  }
  if (/\.(md|txt|json|ya?ml|toml)$/i.test(base)) {
    return <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
  return <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

type DirCache = Record<string, WorkspaceDirEntry[] | undefined>;

function TreeNode({
  entry,
  depth,
  expanded,
  selected,
  cache,
  loadingPaths,
  filter,
  onToggle,
  onSelect,
}: {
  entry: WorkspaceDirEntry;
  depth: number;
  expanded: Set<string>;
  selected: string | null;
  cache: DirCache;
  loadingPaths: Set<string>;
  filter: string;
  onToggle: (path: string) => void;
  onSelect: (entry: WorkspaceDirEntry) => void;
}) {
  const isDir = entry.type === "dir";
  const open = expanded.has(entry.path);
  const children = cache[entry.path];
  const loading = loadingPaths.has(entry.path);
  const q = filter.trim().toLowerCase();
  const selfMatch = !q || entry.name.toLowerCase().includes(q) || entry.path.toLowerCase().includes(q);

  const filteredChildren = useMemo(() => {
    if (!children) return [];
    if (!q) return children;
    return children.filter((c) => {
      if (c.type === "dir") return true; // keep dirs so nested matches can appear after expand
      return (
        c.name.toLowerCase().includes(q) ||
        c.path.toLowerCase().includes(q)
      );
    });
  }, [children, q]);

  // When filtering, hide leaf files that don't match; dirs stay if name matches or might have children
  if (!isDir && q && !selfMatch) return null;

  return (
    <div>
      <button
        type="button"
        className={cn(
          "interactive flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-xs hover:bg-muted/50",
          selected === entry.path && "bg-muted text-foreground",
        )}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => {
          if (isDir) onToggle(entry.path);
          onSelect(entry);
        }}
        onDoubleClick={() => {
          if (!isDir) onSelect(entry);
        }}
        title={entry.path}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {isDir ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>
        {isDir ? (
          open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500/90" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
          )
        ) : (
          <FileIcon name={entry.name} />
        )}
        <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
        {!isDir && entry.size != null && entry.size > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {formatSize(entry.size)}
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
      </button>
      {isDir && open && (
        <div>
          {loading && !children && (
            <div
              className="py-1 text-[11px] text-muted-foreground"
              style={{ paddingLeft: 22 + depth * 12 }}
            >
              加载中…
            </div>
          )}
          {filteredChildren.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              selected={selected}
              cache={cache}
              loadingPaths={loadingPaths}
              filter={filter}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
          {children && filteredChildren.length === 0 && !loading && (
            <div
              className="py-1 text-[11px] text-muted-foreground/70"
              style={{ paddingLeft: 22 + depth * 12 }}
            >
              {q ? "无匹配" : "空目录"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FilesExplorer() {
  const workspace = useAppStore((s) => s.workspace);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [cache, setCache] = useState<DirCache>({});
  const cacheRef = useRef<DirCache>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkspaceDirEntry | null>(null);
  const [preview, setPreview] = useState("");
  const [previewOriginal, setPreviewOriginal] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [binaryNote, setBinaryNote] = useState<string | null>(null);

  const setCacheBoth = useCallback((updater: DirCache | ((prev: DirCache) => DirCache)) => {
    setCache((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cacheRef.current = next;
      return next;
    });
  }, []);

  const loadDir = useCallback(
    async (relPath: string, force = false) => {
      if (!hasHfq() || !workspace?.path) return;
      const key = relPath === "" || relPath === "/" ? "." : relPath;
      if (!force && cacheRef.current[key] !== undefined) return;
      setLoadingPaths((prev) => new Set(prev).add(key));
      try {
        const res = await getHfq().listWorkspaceDir({ path: key === "." ? "." : key });
        if (res?.ok === false && res.error) {
          throw new Error(res.error);
        }
        let entries = res?.entries ?? [];
        if (!showHidden) {
          entries = entries.filter((e) => {
            if (HIDDEN_NAMES.has(e.name)) return false;
            if (e.name.startsWith(".") && e.name !== ".env.example") return false;
            return true;
          });
        }
        setCacheBoth((prev) => ({ ...prev, [key]: entries }));
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (key === ".") toast.error(msg);
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [workspace?.path, showHidden, setCacheBoth],
  );

  const refreshRoot = useCallback(async () => {
    setCacheBoth({});
    setExpanded(new Set());
    setSelected(null);
    setPreview("");
    setPreviewOriginal("");
    setBinaryNote(null);
    await loadDir(".", true);
  }, [loadDir, setCacheBoth]);

  useEffect(() => {
    if (!workspace?.path) {
      setCacheBoth({});
      setExpanded(new Set());
      setSelected(null);
      setPreview("");
      return;
    }
    setCacheBoth({});
    setExpanded(new Set());
    void loadDir(".", true);
  }, [workspace?.path, showHidden, loadDir, setCacheBoth]);

  const toggleDir = async (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    if (!cache[path]) await loadDir(path);
  };

  const openFile = async (entry: WorkspaceDirEntry) => {
    setSelected(entry);
    setBinaryNote(null);
    if (entry.type === "dir") {
      setPreview("");
      setPreviewOriginal("");
      return;
    }
    if (!isProbablyText(entry.path, entry.size)) {
      setPreview("");
      setPreviewOriginal("");
      setBinaryNote("此文件可能是二进制或过大，请用系统/外部编辑器打开。");
      return;
    }
    setPreviewLoading(true);
    try {
      const r = await getHfq().readWorkspaceText({ path: entry.path });
      if (r && typeof r === "object" && "error" in r && r.error) {
        throw new Error(String(r.error));
      }
      const content = String(r?.content ?? "");
      // Detect binary-ish content
      if (content.includes("\u0000")) {
        setBinaryNote("检测到二进制内容，已禁止内联编辑。");
        setPreview("");
        setPreviewOriginal("");
        return;
      }
      setPreview(content);
      setPreviewOriginal(content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setPreview("");
      setPreviewOriginal("");
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selected || selected.type === "dir") return;
    setSaving(true);
    try {
      await getHfq().writeWorkspaceText({ path: selected.path, content: preview });
      setPreviewOriginal(preview);
      toast.success(`已保存 ${selected.path}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const rootEntries = cache["."] ?? [];
  const dirty = selected?.type === "file" && preview !== previewOriginal && !binaryNote;
  const rootLoading = loadingPaths.has(".") && !cache["."];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FolderTree className="h-4 w-4 text-workbench" />
            文件
            {workspace?.path && (
              <Badge variant="secondary" className="max-w-[40vw] truncate font-mono font-normal normal-case">
                {workspace.path}
              </Badge>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => setShowHidden((v) => !v)}
          title="显示/隐藏 .git、node_modules 等"
        >
          {showHidden ? "隐藏系统目录" : "显示隐藏"}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8"
          disabled={!workspace?.path}
          onClick={() => void refreshRoot()}
          title="刷新"
          aria-label="刷新"
        >
          <RefreshCw className={cn("h-4 w-4", rootLoading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="px-3 pt-2">
          <ErrorBanner message={error} onRetry={() => void refreshRoot()} className="mb-0" />
        </div>
      )}

      {!workspace?.path ? (
        <EmptyState
          icon={Folder}
          title="未绑定工作区"
          description="打开工作区后可浏览与编辑项目文件"
          className="m-6"
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Tree */}
          <div className="flex w-[min(320px,38%)] shrink-0 flex-col border-r border-border/70">
            <div className="border-b border-border/50 p-2">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="过滤当前树…"
                className="h-8 font-mono text-xs"
              />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-1.5 pb-8">
                {rootLoading ? (
                  <div className="flex items-center gap-2 px-2 py-8 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    读取工作区…
                  </div>
                ) : rootEntries.length === 0 ? (
                  <EmptyState title="空工作区" description="目录下没有可见条目" className="py-10" />
                ) : (
                  rootEntries.map((e) => (
                    <TreeNode
                      key={e.path}
                      entry={e}
                      depth={0}
                      expanded={expanded}
                      selected={selected?.path ?? null}
                      cache={cache}
                      loadingPaths={loadingPaths}
                      filter={filter}
                      onToggle={(p) => void toggleDir(p)}
                      onSelect={(ent) => void openFile(ent)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preview / editor */}
          <div className="flex min-w-0 flex-1 flex-col">
            {!selected ? (
              <EmptyState
                icon={FileText}
                title="选择文件"
                description="在左侧树中点选文件预览；可编辑并保存文本文件"
                className="m-6 border-0"
              />
            ) : selected.type === "dir" ? (
              <div className="flex flex-1 flex-col items-start gap-3 p-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                  <span className="font-mono">{selected.path}</span>
                </div>
                <p className="text-xs text-muted-foreground">目录 · 展开左侧节点浏览子项</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={async () => {
                      try {
                        await getHfq().openPath({ path: selected.path });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : String(e));
                      }
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    在资源管理器打开
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={async () => {
                      try {
                        await getHfq().revealInFolder({ path: selected.path });
                      } catch {
                        try {
                          await getHfq().openPath({ path: selected.path });
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : String(e));
                        }
                      }
                    }}
                  >
                    在文件夹中显示
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={selected.path}>
                    {selected.path}
                  </span>
                  {dirty && (
                    <Badge variant="warning" className="font-normal">
                      未保存
                    </Badge>
                  )}
                  {selected.size != null && selected.size > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {formatSize(selected.size)}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={async () => {
                      try {
                        await getHfq().openInEditor({ path: selected.path });
                      } catch {
                        try {
                          await getHfq().openWorkspaceFile({ path: selected.path });
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : String(e));
                        }
                      }
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    外部打开
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={saving || previewLoading || !!binaryNote || !dirty}
                    onClick={() => void saveFile()}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    保存
                  </Button>
                </div>
                <div className="min-h-0 flex-1 p-2">
                  {previewLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      读取…
                    </div>
                  ) : binaryNote ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                      <p className="text-sm text-muted-foreground">{binaryNote}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await getHfq().openInEditor({ path: selected.path });
                          } catch {
                            await getHfq().openWorkspaceFile({ path: selected.path });
                          }
                        }}
                      >
                        用外部编辑器打开
                      </Button>
                    </div>
                  ) : (
                    <Textarea
                      value={preview}
                      onChange={(e) => setPreview(e.target.value)}
                      className="h-full min-h-[280px] resize-none font-mono text-xs leading-relaxed"
                      spellCheck={false}
                      disabled={saving}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
