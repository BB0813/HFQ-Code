import { useEffect, useRef, useState } from "react";
import { Plus, TerminalSquare, Trash2 } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { ChipButton, EmptyState } from "@/components/ui/page-states";
import { getHfq, hasHfq } from "@/lib/hfq";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/store/terminal-store";

export function TerminalPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const unsubData = useRef<(() => void) | null>(null);
  const unsubExit = useRef<(() => void) | null>(null);
  const [shellPick, setShellPick] = useState("auto");

  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeId);
  const shells = useTerminalStore((s) => s.shells);
  const preferred = useTerminalStore((s) => s.preferred);
  const bootstrap = useTerminalStore((s) => s.bootstrap);
  const create = useTerminalStore((s) => s.create);
  const kill = useTerminalStore((s) => s.kill);
  const setActive = useTerminalStore((s) => s.setActive);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (preferred) setShellPick(preferred);
  }, [preferred]);

  useEffect(() => {
    if (!hostRef.current || termRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.35,
      fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
      theme: {
        background: "#09090b",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#3f3f46",
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => {
      const id = activeIdRef.current;
      if (id && hasHfq()) void getHfq().ptyWrite({ id, data });
    });

    const onResize = () => {
      fit.fit();
      const id = activeIdRef.current;
      if (id && hasHfq() && term.cols && term.rows) {
        void getHfq().ptyResize({ id, cols: term.cols, rows: term.rows });
      }
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(hostRef.current);

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    // Don't clear on tab switch — preserve scrollback for revisiting.
    if (!hasHfq()) return;

    unsubData.current?.();
    unsubExit.current?.();

    const hfq = getHfq();
    unsubData.current = hfq.onPtyData(({ id, data }) => {
      if (id === activeIdRef.current) termRef.current?.write(data);
    });
    unsubExit.current = hfq.onPtyExit(({ id, exitCode }) => {
      if (id === activeIdRef.current) {
        termRef.current?.writeln(`\r\n[process exited: ${exitCode ?? "?"}]`);
      }
      void useTerminalStore.getState().refresh();
    });

    if (activeId && termRef.current && fitRef.current) {
      fitRef.current.fit();
      const { cols, rows } = termRef.current;
      void hfq.ptyResize({ id: activeId, cols, rows });
    }

    return () => {
      unsubData.current?.();
      unsubExit.current?.();
    };
  }, [activeId]);

  const shellOptions = [
    { kind: "auto", label: "auto" },
    ...shells
      .filter((s) => s.available !== false && s.kind && s.kind !== "auto")
      .map((s) => ({ kind: s.kind, label: s.label || s.kind })),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border/70 px-1.5 py-1">
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-pressed={s.id === activeId}
              className={cn(
                "interactive rounded-md px-2 py-0.5 text-xs",
                s.id === activeId
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {s.label || s.shell || s.id.slice(0, 6)}
            </button>
          ))}
          {sessions.length === 0 && (
            <span className="px-1.5 text-xs text-muted-foreground">无终端会话</span>
          )}
        </div>
        <div className="hidden items-center gap-0.5 sm:flex">
          {shellOptions.slice(0, 3).map((s) => (
            <ChipButton
              key={s.kind}
              active={shellPick === s.kind}
              className="h-6 px-1.5 py-0 text-xs"
              onClick={() => {
                setShellPick(s.kind);
                if (hasHfq()) {
                  void getHfq().setPrefs({
                    terminalShell: s.kind === "auto" ? "" : s.kind,
                  });
                }
              }}
            >
              {s.label}
            </ChipButton>
          ))}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8"
          title="新建终端"
          aria-label="新建终端"
          onClick={() =>
            void create({
              shell: shellPick === "auto" ? undefined : shellPick,
            })
          }
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8"
          title="关闭当前终端"
          aria-label="关闭当前终端"
          disabled={!activeId}
          onClick={() => activeId && void kill(activeId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-[#09090b]">
        {sessions.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
            <EmptyState
              icon={TerminalSquare}
              title="还没有终端"
              description="新建 PTY 会话以在工作区内执行命令"
              className="max-w-xs border-border/50 bg-card/40 py-8"
              action={
                <Button
                  size="sm"
                 
                  onClick={() =>
                    void create({
                      shell: shellPick === "auto" ? undefined : shellPick,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  新建终端
                </Button>
              }
            />
          </div>
        )}
        <div ref={hostRef} className="h-full w-full p-1" />
      </div>
    </div>
  );
}
