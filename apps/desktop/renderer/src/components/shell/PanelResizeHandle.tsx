import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

export type ResizeEdge = "after" | "before";

interface PanelResizeHandleProps {
  /** `after` grows width when dragging right (sidebar left edge → right).
   *  `before` grows width when dragging left (drawer right edge → left). */
  edge: ResizeEdge;
  value: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
  className?: string;
  label?: string;
}

/**
 * Vertical drag handle between Layout A columns (sidebar | center | drawer).
 * Pointer-capture based — no extra deps, works under file://.
 */
export function PanelResizeHandle({
  edge,
  value,
  min,
  max,
  onChange,
  className,
  label = "调整面板宽度",
}: PanelResizeHandleProps) {
  const startX = useRef(0);
  const startW = useRef(0);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback(
    (w: number) => Math.min(max, Math.max(min, Math.round(w))),
    [min, max],
  );

  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startW.current = value;
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startX.current;
    const next = edge === "after" ? startW.current + dx : startW.current - dx;
    onChange(clamp(next));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={cn(
        "group relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none select-none",
        "bg-transparent transition-colors",
        "hover:bg-workbench/25 focus-visible:bg-workbench/30 focus-visible:outline-none",
        dragging && "bg-workbench/40",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 24 : 8;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(clamp(edge === "after" ? value - step : value + step));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(clamp(edge === "after" ? value + step : value - step));
        } else if (e.key === "Home") {
          e.preventDefault();
          onChange(min);
        } else if (e.key === "End") {
          e.preventDefault();
          onChange(max);
        }
      }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2",
          "bg-border/80 group-hover:bg-workbench/50",
          dragging && "bg-workbench",
        )}
      />
    </div>
  );
}
