import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type ComposerCmd,
  filterComposerCommands,
  lineTokenBeforeCaret,
  SLASH_COMMANDS,
  skillsToCommands,
} from "./composer-commands";
import { asList, getHfq, hasHfq } from "@/lib/hfq";

interface Props {
  draft: string;
  caret: number;
  open: boolean;
  forceOpen?: boolean;
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onPick: (cmd: ComposerCmd) => void;
  onClose: () => void;
}

export function ComposerSlashPalette({
  draft,
  caret,
  open,
  forceOpen,
  activeIndex,
  onActiveIndexChange,
  onPick,
  onClose,
}: Props) {
  const [skills, setSkills] = useState<ComposerCmd[]>([]);

  useEffect(() => {
    if (!hasHfq()) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await getHfq().listSkills({});
        const list = asList<{
          name?: string;
          description?: string;
          source?: string;
          eligible?: boolean;
        }>(raw, ["skills", "items"]);
        if (!cancelled) setSkills(skillsToCommands(list));
      } catch {
        if (!cancelled) setSkills([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { token, prefix, line } = useMemo(
    () => lineTokenBeforeCaret(draft, caret),
    [draft, caret],
  );

  // After first space on the line, args follow — hide palette (legacy behavior)
  const argsStarted = prefix != null && line.includes(" ") && token !== line;

  const items = useMemo(() => {
    if (forceOpen && !prefix) {
      return [...SLASH_COMMANDS, ...skills];
    }
    if (argsStarted) return [];
    const all = [...SLASH_COMMANDS, ...skills];
    return filterComposerCommands(all, token, prefix);
  }, [forceOpen, prefix, argsStarted, token, skills]);

  const visible = open && items.length > 0 && (forceOpen || prefix != null) && !argsStarted;

  useEffect(() => {
    if (!visible) return;
    if (activeIndex >= items.length) onActiveIndexChange(0);
  }, [visible, items.length, activeIndex, onActiveIndexChange]);

  if (!visible) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-30 mb-1.5 overflow-hidden rounded-xl border border-border/80 bg-popover shadow-xl shadow-black/40"
      role="listbox"
      aria-label="命令与技能"
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {prefix === "$" ? "技能 $" : prefix === "/" ? "命令 /" : "命令与技能"}
          <span className="ml-1.5 tabular-nums text-muted-foreground/60">{items.length}</span>
        </span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          Esc
        </button>
      </div>
      <div className="max-h-56 overflow-auto py-1">
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={idx === activeIndex}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
              idx === activeIndex
                ? "bg-workbench/15 text-foreground"
                : "text-foreground/90 hover:bg-white/[0.05]",
            )}
            onMouseEnter={() => onActiveIndexChange(idx)}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(item);
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[13px] font-medium">{item.label}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.hint}</span>
            </span>
            <span className="shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {item.kind === "skill" ? "技能" : "命令"}
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-border/50 px-3 py-1.5 text-[11px] text-muted-foreground/70">
        ↑↓ 选择 · Enter 插入 · <span className="text-workbench">/goal</span> ·{" "}
        <span className="text-workbench">$</span>技能 · Ctrl+K 全局
      </div>
    </div>
  );
}

export function getActivePaletteItem(
  draft: string,
  caret: number,
  skills: ComposerCmd[],
  forceOpen: boolean,
  activeIndex: number,
): ComposerCmd | null {
  const { token, prefix, line } = lineTokenBeforeCaret(draft, caret);
  const argsStarted = prefix != null && line.includes(" ") && token !== line;
  if (argsStarted) return null;
  const all = [...SLASH_COMMANDS, ...skills];
  const items =
    forceOpen && !prefix
      ? all
      : filterComposerCommands(all, token, prefix);
  return items[activeIndex] ?? items[0] ?? null;
}
