import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Copy,
  FolderOpen,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Sparkles,
  Square,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { asList, getHfq, hasHfq, messageBody, sessionModel, sessionProviderId, type SessionMessage } from "@/lib/hfq";
import { cn, shortPath } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { ComposerSlashPalette } from "./ComposerSlashPalette";
import { MarkdownMessage } from "./MarkdownMessage";
import { ThinkingBlock } from "./ThinkingBlock";
import {
  applyComposerInsert,
  type ComposerCmd,
  filterComposerCommands,
  lineTokenBeforeCaret,
  SLASH_COMMANDS,
  skillsToCommands,
} from "./composer-commands";

/** Memoized single message block with copy button. */
const MessageBlock = memo(function MessageBlock({ message }: { message: SessionMessage }) {
  const role = String(message.role);
  const text = messageBody(message);
  const isUser = role === "user";
  const isTool = role === "tool";
  const isThinking =
    role === "thinking" || Boolean((message as { thinking?: boolean }).thinking);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("已复制", { duration: 1200 });
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("复制失败");
    }
  }, [text]);

  if (isThinking) {
    return (
      <ThinkingBlock key={message.id} text={text} streaming={false} defaultOpen={false} />
    );
  }
  const toolName = String(
    (message as { toolName?: string; name?: string }).toolName ||
      (message as { name?: string }).name ||
      "tool",
  );
  const phase = (message as { phase?: string }).phase;
  const ok = (message as { ok?: boolean }).ok;
  return (
    <article
      className={cn(
        "group relative animate-message-in rounded-lg px-3.5 py-2.5 text-sm",
        isUser && "msg-user",
        isTool && "msg-tool",
        !isUser && !isTool && "msg-agent",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        {isTool && (
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06]">
            <Wrench className="h-3 w-3 text-muted-foreground" />
          </span>
        )}
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            isUser
              ? "text-zinc-300/90"
              : isTool
                ? "text-muted-foreground"
                : "text-foreground/55",
          )}
        >
          {isUser ? "You" : isTool ? toolName : "Agent"}
        </span>
        {isTool && phase === "running" && (
          <Badge variant="outline" className="gap-1 font-normal">
            <Loader2 className="h-3 w-3 animate-spin" />
            running
          </Badge>
        )}
        {isTool && phase === "done" && ok === false && (
          <Badge variant="destructive" className="font-normal">
            failed
          </Badge>
        )}
        <button
          type="button"
          className="ml-auto hidden h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="复制消息"
          aria-label="复制消息内容"
          onClick={handleCopy}
        >
          {copied ? (
            <span className="text-[10px] font-medium text-success">✓</span>
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      {isUser || isTool ? (
        <div className="selectable whitespace-pre-wrap break-words text-[14px] leading-relaxed">
          {text || (isTool ? "（无输出）" : "")}
        </div>
      ) : (
        <MarkdownMessage text={text || ""} />
      )}
    </article>
  );
});

export function ChatView() {
  const messages = useAppStore((s) => s.messages);
  const streamingText = useAppStore((s) => s.streamingText);
  const streamingThinking = useAppStore((s) => s.streamingThinking);
  const running = useAppStore((s) => s.running);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const workspace = useAppStore((s) => s.workspace);
  const info = useAppStore((s) => s.info);
  const sessions = useAppStore((s) => s.sessions);
  const error = useAppStore((s) => s.error);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const abortSession = useAppStore((s) => s.abortSession);
  const createSession = useAppStore((s) => s.createSession);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const composerDraft = useAppStore((s) => s.composerDraft);
  const consumeComposerDraft = useAppStore((s) => s.consumeComposerDraft);
  const tasks = useAppStore((s) => s.tasks);

  const activeGoal = useMemo(
    () =>
      tasks.find(
        (t) =>
          (t.kind === "goal" || (!t.kind && t.title?.toLowerCase().startsWith("goal:"))) &&
          t.status === "in_progress",
      ),
    [tasks],
  );

  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [forcePalette, setForcePalette] = useState(false);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [skillCmds, setSkillCmds] = useState<ComposerCmd[]>([]);
  /** Workspace-relative paths referenced in this turn (composer chips). */
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachPath, setAttachPath] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const scrolledUpRef = useRef(false);

  const session = sessions.find((s) => s.id === activeSessionId);
  const empty = messages.length === 0 && !streamingText && !streamingThinking;
  /** Only blocks send — composer tools stay usable while agent runs. */
  const sendLocked = running || sending;

  // Smart scroll: auto-scroll only when user hasn't scrolled up.
  // Uses IntersectionObserver on bottom anchor; visible → near bottom.
  useEffect(() => {
    if (!bottomRef.current) return;
    scrolledUpRef.current = userScrolledUp;
  }, [userScrolledUp]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const parent = el.parentElement?.parentElement; // viewport inside ScrollArea
    if (!parent) return;
    let prevVisible = true;

    const ob = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const visible = entry.isIntersecting;
        if (visible !== prevVisible) {
          prevVisible = visible;
          setUserScrolledUp(!visible);
        }
      },
      { root: parent, threshold: 0.05 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [bottomRef.current]);

  useEffect(() => {
    if (!userScrolledUp) {
      // Only scroll if user is near bottom (bottomRef visible).
      bottomRef.current?.scrollIntoView({ behavior: running ? "auto" : "smooth" });
    }
  }, [messages, streamingText, streamingThinking, running, userScrolledUp]);

  const scrollToBottom = useCallback(() => {
    setUserScrolledUp(false);
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  // Consume one-shot prefill from Changes「让智能体修」etc. — never auto-send.
  useEffect(() => {
    if (!composerDraft) return;
    const text = consumeComposerDraft();
    if (!text) return;
    setDraft(text);
    setCaret(text.length);
    window.requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(text.length, text.length);
      } catch {
        /* ignore */
      }
    });
  }, [composerDraft, consumeComposerDraft]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(200, Math.max(56, el.scrollHeight))}px`;
  }, [draft]);

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
        if (!cancelled) setSkillCmds(skillsToCommands(list));
      } catch {
        if (!cancelled) setSkillCmds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncCaret = () => {
    const el = taRef.current;
    if (!el) return;
    setCaret(el.selectionStart ?? el.value.length);
  };

  const { token, prefix, line } = useMemo(
    () => lineTokenBeforeCaret(draft, caret),
    [draft, caret],
  );

  const argsStarted = prefix != null && line.includes(" ") && token !== line;

  const paletteItems = useMemo(() => {
    if (forcePalette && !prefix) return [...SLASH_COMMANDS, ...skillCmds];
    if (argsStarted) return [];
    return filterComposerCommands([...SLASH_COMMANDS, ...skillCmds], token, prefix);
  }, [forcePalette, prefix, argsStarted, token, skillCmds]);

  // Auto-open when line starts with / or $
  useEffect(() => {
    if (argsStarted) {
      setPaletteOpen(false);
      setForcePalette(false);
      return;
    }
    if (prefix) {
      setPaletteOpen(true);
      setForcePalette(false);
      setPaletteIdx(0);
    } else if (!forcePalette) {
      setPaletteOpen(false);
    }
  }, [prefix, argsStarted, forcePalette]);

  const pickCmd = (cmd: ComposerCmd) => {
    const el = taRef.current;
    const pos = el?.selectionStart ?? caret;
    const { next, caret: nextCaret } = applyComposerInsert(draft, pos, cmd.insert);
    setDraft(next);
    setPaletteOpen(false);
    setForcePalette(false);
    setPaletteIdx(0);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  };

  const pushAttachments = (paths: string[]) => {
    const cleaned = paths
      .map((p) => p.trim().replace(/\\/g, "/").replace(/^\.?\//, ""))
      .filter(Boolean);
    if (!cleaned.length) return 0;
    let added = 0;
    setAttachments((prev) => {
      const next = [...prev];
      for (const rel of cleaned) {
        if (!next.includes(rel)) {
          next.push(rel);
          added += 1;
        }
      }
      return next;
    });
    return added;
  };

  /** Primary: system dialog under workspace; fallback: manual relative path. */
  const pickWorkspaceAttachments = async () => {
    if (!workspace?.path) {
      toast.error("请先打开工作区");
      return;
    }
    if (!hasHfq()) return;
    setAttachBusy(true);
    try {
      const r = await getHfq().pickWorkspaceFiles({ multi: true });
      if (r?.cancelled) return;
      if (r?.rejected?.length) {
        toast.message(`${r.rejected.length} 个文件不在工作区内，已忽略`);
      }
      const n = pushAttachments(r?.paths ?? []);
      if (n > 0) toast.success(`已引用 ${n} 个文件`);
      else if ((r?.paths?.length ?? 0) > 0) toast.message("所选文件已在引用列表中");
      else if (r && r.ok === false && !r.cancelled) toast.error("未选中有效工作区文件");
    } catch (e) {
      // Older shell without pick API — open manual dialog
      const msg = e instanceof Error ? e.message : String(e);
      if (/not a function|undefined|pickWorkspace/i.test(msg)) {
        setAttachOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setAttachBusy(false);
    }
  };

  const addAttachmentManual = async () => {
    const rel = attachPath.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
    if (!rel) return;
    if (!workspace?.path) {
      toast.error("请先打开工作区");
      return;
    }
    if (attachments.includes(rel)) {
      toast.message("已在引用列表中");
      setAttachOpen(false);
      setAttachPath("");
      return;
    }
    setAttachBusy(true);
    try {
      if (hasHfq()) {
        const r = await getHfq().readWorkspaceText({ path: rel });
        if (r && typeof r === "object" && "error" in r && r.error) {
          throw new Error(String(r.error));
        }
      }
      pushAttachments([rel]);
      setAttachOpen(false);
      setAttachPath("");
      toast.success(`已引用 ${rel}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not found|ENOENT|不存在|escape|outside/i.test(msg)) {
        toast.error(msg.includes("escape") || msg.includes("outside") ? "路径必须在工作区内" : `找不到文件：${rel}`);
      } else {
        pushAttachments([rel]);
        setAttachOpen(false);
        setAttachPath("");
        toast.message(`已引用 ${rel}（未校验内容）`);
      }
    } finally {
      setAttachBusy(false);
    }
  };

  const openCommandPalette = () => {
    setForcePalette(true);
    setPaletteOpen(true);
    setPaletteIdx(0);
    // Seed a slash so the palette has a natural filter root if empty
    if (!draft.trim()) {
      setDraft("/");
      setCaret(1);
      requestAnimationFrame(() => {
        const ta = taRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(1, 1);
      });
    } else {
      taRef.current?.focus();
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || sendLocked) return;
    const context =
      attachments.length > 0
        ? `\n\n参考文件（工作区相对路径）：\n${attachments.map((p) => `- ${p}`).join("\n")}`
        : "";
    const payload = `${text}${context}`.trim();
    if (!payload) return;
    setDraft("");
    setAttachments([]);
    setPaletteOpen(false);
    setForcePalette(false);
    setSending(true);
    try {
      await sendMessage(payload);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const showPalette = paletteOpen && paletteItems.length > 0;

    if (showPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteIdx((i) => (i + 1) % paletteItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteIdx((i) => (i - 1 + paletteItems.length) % paletteItems.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPaletteOpen(false);
        setForcePalette(false);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        const item = paletteItems[paletteIdx] ?? paletteItems[0];
        if (item) {
          e.preventDefault();
          pickCmd(item);
          return;
        }
      }
    }

    if (e.key === "Escape" && running) {
      e.preventDefault();
      void abortSession();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-[hsl(var(--panel-elevated))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 62% 42% at 50% 28%, hsl(240 8% 14% / 0.75), transparent 72%)",
        }}
      />
      <ScrollArea className="relative min-h-0 flex-1">
        <div className="chat-content mx-auto flex min-h-full max-w-[760px] flex-col gap-3.5 px-7 py-6">
          {empty && (
            <div className="flex flex-1 flex-col items-center justify-center px-2 py-14">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-800/85 to-zinc-950/90 shadow-lg shadow-black/40">
                <Sparkles className="h-5 w-5 text-zinc-100" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold tracking-tight text-balance">
                {session?.title || session?.goal || "开始编码"}
              </h2>
              <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-muted-foreground text-balance">
                {workspace?.path
                  ? `工作区 ${shortPath(String(workspace.path), 48)} · 描述任务，或输入 / 命令 · $ 技能`
                  : "先绑定工作区，再描述你想改的代码或要跑的任务"}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {(() => {
                  const sessModel = sessionModel(session);
                  const globalModel = info?.activeModel
                    ? String(info.activeModel).trim()
                    : "";
                  const model = sessModel || globalModel;
                  const provider =
                    sessionProviderId(session) ||
                    (info?.activeProviderId &&
                      String(info.activeProviderId).trim()) ||
                    "";
                  return (
                    <>
                      {model ? (
                        <Badge
                          variant="secondary"
                          className="font-mono font-normal"
                          title={
                            sessModel && globalModel && sessModel !== globalModel
                              ? `本会话: ${sessModel}\n全局: ${globalModel}`
                              : model
                          }
                        >
                          {model}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="font-normal text-warning"
                        >
                          未配置模型
                        </Badge>
                      )}
                      {provider ? (
                        <Badge variant="outline" className="font-normal">
                          {provider}
                        </Badge>
                      ) : null}
                    </>
                  );
                })()}
                {activeSessionId && (
                  <Badge variant="muted" className="font-mono font-normal">
                    {activeSessionId.slice(0, 8)}
                  </Badge>
                )}
                {session?.parentSessionId ? (
                  <Badge
                    variant="outline"
                    className="font-normal"
                    title={`父会话 ${session.parentSessionId}`}
                  >
                    子会话
                    {session.subagentProfile
                      ? ` · ${session.subagentProfile}`
                      : ""}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {[
                  { label: "解释当前项目结构", insert: "解释当前项目结构" },
                  { label: "修复最近的 TypeScript 报错", insert: "修复最近的 TypeScript 报错" },
                  { label: "长运行 /goal", insert: "/goal " },
                  { label: "压缩上下文 /compact", insert: "/compact " },
                ].map((hint) => (
                  <button
                    key={hint.label}
                    type="button"
                    className="hint-chip"
                    onClick={() => {
                      setDraft(hint.insert);
                      requestAnimationFrame(() => {
                        taRef.current?.focus();
                        const len = hint.insert.length;
                        taRef.current?.setSelectionRange(len, len);
                        setCaret(len);
                      });
                    }}
                  >
                    {hint.label}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                {!workspace?.path && (
                  <Button size="sm" variant="outline" onClick={() => void openWorkspace()}>
                    <FolderOpen className="h-4 w-4" />
                    打开工作区
                  </Button>
                )}
                {!activeSessionId && (
                  <Button size="sm" onClick={() => void createSession()}>
                    <MessageSquarePlus className="h-4 w-4" />
                    新建会话
                  </Button>
                )}
              </div>
            </div>
          )}

          {error && !empty && (
            <div role="alert" className="msg-error rounded-lg border px-3.5 py-2.5 text-sm">
              {error}
            </div>
          )}

          {messages.map((m) => (
            <MessageBlock key={m.id} message={m} />
          ))}
          {streamingThinking && (
            <ThinkingBlock text={streamingThinking} streaming defaultOpen />
          )}
          {streamingText && (
            <div className="msg-agent rounded-xl border border-border/50 px-3.5 py-2.5 text-sm">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-foreground/55">
                Agent
                <span className="status-dot-running status-pulse" aria-hidden />
              </div>
              <MarkdownMessage text={streamingText} streaming />
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/55 align-middle" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {userScrolledUp && running && (
          <button
            type="button"
            className="interactive absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-lg backdrop-blur-sm hover:text-foreground"
            onClick={scrollToBottom}
          >
            ↓ 跳到底部
          </button>
        )}
      </ScrollArea>

      {/* F1 goal banner — show when an active goal exists */}
      {activeGoal && (
        <div className="shrink-0 border-t border-border/70 bg-workbench/[0.04] px-6 py-2">
          <div className="mx-auto flex max-w-[760px] items-center gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-workbench/15 text-[10px] text-workbench">
              ✓
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {(activeGoal.objective || activeGoal.title || "").replace(/\s+/g, " ").trim()}
            </span>
            {typeof activeGoal.progress === "number" && (
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {Math.round(activeGoal.progress)}%
              </span>
            )}
            {activeGoal.blockedReason && (
              <span className="shrink-0 text-[11px] text-destructive">
                阻塞
              </span>
            )}
          </div>
        </div>
      )}

      <div className="relative shrink-0 border-t border-border/70 bg-[hsl(var(--panel))] px-6 py-3.5">
        <div className="relative mx-auto max-w-[760px]">
          {!workspace?.path && (
            <div className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-warning/25 bg-warning/[0.07] px-3 py-2 text-xs text-warning">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">发送前请先绑定工作区</span>
              <Button
                size="sm"
                variant="outline"
                className="border-warning/30 text-warning hover:bg-warning/10"
                onClick={() => void openWorkspace()}
              >
                打开
              </Button>
            </div>
          )}

          <div className="relative">
            <ComposerSlashPalette
              draft={draft}
              caret={caret}
              open={paletteOpen || forcePalette}
              forceOpen={forcePalette}
              activeIndex={paletteIdx}
              onActiveIndexChange={setPaletteIdx}
              onPick={pickCmd}
              onClose={() => {
                setPaletteOpen(false);
                setForcePalette(false);
              }}
            />

            <div
              className={cn(
                "composer-shell flex flex-col gap-0 p-0",
                focused ? "composer-shell-focused" : "composer-shell-idle",
              )}
            >
              <Textarea
                ref={taRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setCaret(e.target.selectionStart ?? e.target.value.length);
                }}
                onSelect={syncCaret}
                onClick={syncCaret}
                onKeyUp={syncCaret}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-label="消息输入"
                aria-autocomplete="list"
                placeholder={
                  workspace?.path
                    ? "描述任务… 输入 / 命令或 $ 技能"
                    : "先打开工作区，再描述任务…"
                }
                className="min-h-[64px] max-h-48 w-full resize-none border-0 bg-transparent px-3.5 pb-1.5 pt-3 text-sm shadow-none focus-visible:ring-0"
                disabled={sending}
                rows={2}
                title={
                  running
                    ? "Agent 运行中 — 可先编辑草稿；结束后再发送，或 Esc 停止"
                    : undefined
                }
              />

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-border/40 px-3 py-2">
                  {attachments.map((p) => (
                    <span
                      key={p}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 truncate" title={p}>
                        {p}
                      </span>
                      <button
                        type="button"
                        className="interactive ml-0.5 rounded p-0.5 hover:bg-white/10 hover:text-foreground"
                        aria-label={`移除 ${p}`}
                        onClick={() =>
                          setAttachments((prev) => prev.filter((x) => x !== p))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom tool row — Cursor-like: tools left, send right */}
              <div className="flex items-center gap-1 border-t border-border/50 px-2 py-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  disabled={sending}
                  title="命令与技能 (/ · $)"
                  aria-label="打开命令与技能"
                  onClick={openCommandPalette}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">命令</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  disabled={sending || !workspace?.path}
                  title={
                    workspace?.path
                      ? "引用工作区文件（随消息发送路径上下文）"
                      : "先打开工作区"
                  }
                  aria-label="引用文件"
                  onClick={() => void pickWorkspaceAttachments()}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">引用</span>
                  {attachments.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-4 px-1 font-mono text-[10px]">
                      {attachments.length}
                    </Badge>
                  )}
                </Button>

                <div className="min-w-0 flex-1 px-1 text-[11px] text-muted-foreground/60">
                  {running ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="status-dot-running status-pulse" aria-hidden />
                      运行中 · Esc 停止
                    </span>
                  ) : (
                    <span className="hidden md:inline">Enter 发送 · Shift+Enter 换行</span>
                  )}
                </div>

                {running ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 shrink-0 gap-1.5 rounded-lg px-3"
                    onClick={() => void abortSession()}
                    title="停止 (Esc)"
                    aria-label="停止 Agent"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    停止
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-lg duration-150",
                      !draft.trim() && attachments.length === 0 && "opacity-40",
                    )}
                    disabled={(!draft.trim() && attachments.length === 0) || sendLocked}
                    onClick={() => void submit()}
                    title="发送 (Enter)"
                    aria-label="发送消息"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-muted-foreground/70">
            <span className="inline-flex items-center gap-1.5">
              {!workspace?.path
                ? "未绑定工作区 · 点击顶栏打开"
                : "本地 Agent · 工作区沙箱"}
            </span>
            <span className="tabular-nums">
              {draft.trim() ? `${draft.trim().length} 字` : ""}
              {attachments.length > 0
                ? `${draft.trim() ? " · " : ""}${attachments.length} 引用`
                : ""}
            </span>
          </div>
        </div>
      </div>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>手动输入路径</DialogTitle>
            <DialogDescription>
              系统选择器不可用时的回退。输入工作区相对路径（如{" "}
              <code className="font-mono text-[11px]">src/app.ts</code>）。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={attachPath}
            onChange={(e) => setAttachPath(e.target.value)}
            placeholder="path/to/file.ts"
            className="font-mono text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addAttachmentManual();
              }
            }}
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={attachBusy}
              onClick={() => {
                setAttachOpen(false);
                void pickWorkspaceAttachments();
              }}
            >
              系统选择器
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAttachOpen(false)}>
                取消
              </Button>
              <Button
                size="sm"
                disabled={!attachPath.trim() || attachBusy}
                onClick={() => void addAttachmentManual()}
              >
                {attachBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                添加引用
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
