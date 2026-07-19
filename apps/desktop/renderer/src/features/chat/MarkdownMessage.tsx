import { memo, useEffect, useId, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Segment =
  | { kind: "text"; text: string }
  | { kind: "code"; lang: string; code: string; raw: string };

const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;

/** Module-level mermaid init (once). Avoid re-initialize on every block. */
let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

async function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      const dark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: dark ? "dark" : "default",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

/** Lightweight fenced-code splitter (no full markdown dependency). */
export function splitMarkdownSegments(source: string): Segment[] {
  const text = String(source ?? "");
  if (!text) return [];
  const segments: Segment[] = [];
  let last = 0;
  FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ kind: "text", text: text.slice(last, m.index) });
    }
    const lang = String(m[1] ?? "").trim().toLowerCase().split(/\s+/)[0] || "";
    const code = String(m[2] ?? "").replace(/\n$/, "");
    segments.push({ kind: "code", lang, code, raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", text: text.slice(last) });
  }
  return segments.length ? segments : [{ kind: "text", text }];
}

/**
 * While streaming, unclosed ``` fences are treated as plain text so mermaid
 * does not re-render on every incomplete delta.
 */
export function splitMarkdownSegmentsStreaming(source: string): Segment[] {
  const text = String(source ?? "");
  if (!text) return [];
  const opens = (text.match(/```/g) || []).length;
  if (opens % 2 === 1) {
    // Odd fence count → last fence still open: do not parse as code/mermaid yet.
    return [{ kind: "text", text }];
  }
  return splitMarkdownSegments(text);
}

function InlineText({ text }: { text: string }) {
  // Minimal inline: **bold**, `code`, preserve newlines.
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={key++}
          className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[0.85em] text-foreground/90"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="group/code relative my-2 overflow-hidden rounded-lg border border-border/60 bg-black/30">
      <div className="flex items-center justify-between border-b border-border/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{lang || "code"}</span>
        <button
          type="button"
          className="inline-flex h-5 items-center gap-1 rounded px-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          onClick={() => void onCopy()}
          title="复制代码"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-3 font-mono text-[12px] leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MermaidBlock({ code }: { code: string }) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = await getMermaid();
        const id = `hfq-mmd-${reactId}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setSvg(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (error) {
    return (
      <div className="my-2 space-y-1">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          Mermaid 渲染失败：{error}
        </div>
        <CodeBlock lang="mermaid" code={code} />
      </div>
    );
  }
  if (!svg) {
    return (
      <div className="my-2 rounded-lg border border-border/50 bg-black/20 px-3 py-4 text-center text-xs text-muted-foreground">
        渲染图表…
      </div>
    );
  }
  return (
    <div
      className="my-2 overflow-x-auto rounded-lg border border-border/50 bg-black/20 p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
      // Mermaid SVG is generated client-side with securityLevel strict.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export const MarkdownMessage = memo(function MarkdownMessage({
  text,
  className,
  streaming = false,
}: {
  text: string;
  className?: string;
  /** When true, unclosed fences stay plain text (stream-safe). */
  streaming?: boolean;
}) {
  const segments = streaming
    ? splitMarkdownSegmentsStreaming(text)
    : splitMarkdownSegments(text);
  return (
    <div className={cn("selectable text-[14px] leading-relaxed", className)}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return (
            <div key={i} className="break-words">
              <InlineText text={seg.text} />
            </div>
          );
        }
        // During stream, never run mermaid (even closed fences) — final message will.
        if (seg.lang === "mermaid" && !streaming) {
          return <MermaidBlock key={i} code={seg.code} />;
        }
        return <CodeBlock key={i} lang={seg.lang} code={seg.code} />;
      })}
    </div>
  );
});
