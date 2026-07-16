import { cn } from "@/lib/cn";
import { IconFile, IconFolder, IconChev } from "@/icons";

export function FileTree({
  items,
  activeId,
  onSelect,
}: {
  items: FileNode[];
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="select-none py-1 text-[12px]">
      {items.map((n) => (
        <FileTreeNode key={n.id} node={n} depth={0} activeId={activeId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  open?: boolean;
};

function FileTreeNode({
  node,
  depth,
  activeId,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  const active = activeId === node.id;
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect?.(node.id)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={cn(
          "flex h-7 w-full items-center gap-1.5 pr-2 text-left text-hfq-text-muted hover:bg-hfq-bg-surface hover:text-hfq-text-primary",
          active && "bg-[rgba(34,211,238,0.1)] text-hfq-brand-cyan",
        )}
      >
        {node.type === "folder" ? (
          <>
            <IconChev size={12} className={cn("transition-transform", node.open !== false && "rotate-0")} />
            <IconFolder size={14} />
          </>
        ) : (
          <>
            <span className="w-3" />
            <IconFile size={14} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === "folder" && node.open !== false && node.children?.map((c) => (
        <FileTreeNode key={c.id} node={c} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function EditorTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
}: {
  tabs: { id: string; name: string; dirty?: boolean }[];
  activeId: string;
  onSelect?: (id: string) => void;
  onClose?: (id: string) => void;
}) {
  return (
    <div className="flex h-9 items-end gap-0 overflow-x-auto border-b border-hfq-border bg-hfq-bg-secondary">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect?.(t.id)}
            className={cn(
              "group flex h-8 items-center gap-2 border-r border-hfq-border px-3 text-[12px] text-hfq-text-muted",
              active
                ? "bg-hfq-bg-primary text-hfq-text-primary"
                : "hover:bg-hfq-bg-surface hover:text-hfq-text-secondary",
            )}
          >
            <span className="font-mono">{t.name}</span>
            {t.dirty && <span className="h-1.5 w-1.5 rounded-full bg-hfq-brand-cyan" />}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClose?.(t.id);
              }}
              className="ml-1 hidden rounded px-0.5 text-hfq-text-disabled group-hover:inline hover:bg-hfq-bg-elevated"
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CodeBlock({
  code,
  language = "ts",
  showLineNumbers = true,
}: {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div className="overflow-hidden rounded-lg border border-hfq-border bg-[#0a0e14]">
      <div className="flex items-center justify-between border-b border-hfq-border px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-hfq-text-disabled">
          {language}
        </span>
      </div>
      <pre className="overflow-auto p-3 font-mono text-code leading-5 text-hfq-text-secondary">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            {showLineNumbers && (
              <span className="mr-4 w-6 select-none text-right text-hfq-text-disabled">
                {i + 1}
              </span>
            )}
            <code className="whitespace-pre">{line || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function Breadcrumb({
  parts,
}: {
  parts: string[];
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 font-mono text-[11px] text-hfq-text-disabled">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="opacity-50">/</span>}
          <span className={i === parts.length - 1 ? "text-hfq-text-secondary" : ""}>{p}</span>
        </span>
      ))}
    </div>
  );
}
