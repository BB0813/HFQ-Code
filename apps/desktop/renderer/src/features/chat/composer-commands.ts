/**
 * Composer prefix palette — mirrors renderer-legacy slash/$ skill UX.
 * Backend (agent-core slash.ts) only special-cases /goal and /compact on send.
 * Other /commands are prompt templates inserted into the draft.
 */

export type ComposerCmdKind = "command" | "skill";

export interface ComposerCmd {
  id: string;
  kind: ComposerCmdKind;
  /** Match token e.g. /goal or $my-skill */
  trigger: string;
  label: string;
  hint: string;
  /** Text inserted into composer */
  insert: string;
}

/** ZCode-style slash templates (legacy SLASH_COMMANDS). */
export const SLASH_COMMANDS: ComposerCmd[] = [
  {
    id: "help",
    kind: "command",
    trigger: "/help",
    label: "/help",
    hint: "列出常用命令与技能用法",
    insert: "help",
  },
  {
    id: "list",
    kind: "command",
    trigger: "/list",
    label: "/list",
    hint: "列出工作区文件",
    insert: "list",
  },
  {
    id: "read",
    kind: "command",
    trigger: "/read",
    label: "/read",
    hint: "读取指定文件",
    insert: "read README.md",
  },
  {
    id: "search",
    kind: "command",
    trigger: "/search",
    label: "/search",
    hint: "用 grep 搜索代码",
    insert: "用 grep 搜索 HFQ",
  },
  {
    id: "git",
    kind: "command",
    trigger: "/git",
    label: "/git",
    hint: "查看 git status",
    insert: "git status",
  },
  {
    id: "write",
    kind: "command",
    trigger: "/write",
    label: "/write",
    hint: "写入演示文件（会走权限）",
    insert: "write demo to hfq-demo.txt",
  },
  {
    id: "patch",
    kind: "command",
    trigger: "/patch",
    label: "/patch",
    hint: "应用补丁演示",
    insert: "apply_patch demo",
  },
  {
    id: "fetch",
    kind: "command",
    trigger: "/fetch",
    label: "/fetch",
    hint: "发起网络请求（会走权限）",
    insert: "fetch https://example.com",
  },
  {
    id: "shell",
    kind: "command",
    trigger: "/shell",
    label: "/shell",
    hint: "执行 shell 命令（会走权限）",
    insert: "shell echo HFQ-Code",
  },
  {
    id: "goal",
    kind: "command",
    trigger: "/goal",
    label: "/goal",
    hint: "长运行目标 · 提高本轮预算，记入任务页",
    insert: "/goal ",
  },
  {
    id: "compact",
    kind: "command",
    trigger: "/compact",
    label: "/compact",
    hint: "请求压缩上下文，只保留关键结论",
    insert: "/compact ",
  },
];

export function skillsToCommands(
  skills: Array<{ name?: string; description?: string; source?: string; eligible?: boolean }>,
): ComposerCmd[] {
  return skills
    .filter((s) => s && s.name && s.eligible !== false)
    .slice(0, 32)
    .map((s) => {
      const name = String(s.name);
      return {
        id: `skill:${name}`,
        kind: "skill" as const,
        trigger: `$${name}`,
        label: `$${name}`,
        hint: String(s.description || s.source || "技能").slice(0, 80),
        insert: `使用技能 ${name}：`,
      };
    });
}

/** Active line token before caret — for / and $ palettes. */
export function lineTokenBeforeCaret(value: string, caret: number): {
  lineStart: number;
  line: string;
  token: string;
  prefix: "/" | "$" | null;
} {
  const before = value.slice(0, caret);
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);
  if (line.startsWith("/")) {
    const token = line.split(/\s/, 1)[0] || "/";
    return { lineStart, line, token, prefix: "/" };
  }
  if (line.startsWith("$")) {
    const token = line.split(/\s/, 1)[0] || "$";
    return { lineStart, line, token, prefix: "$" };
  }
  return { lineStart, line, token: "", prefix: null };
}

export function filterComposerCommands(
  all: ComposerCmd[],
  token: string,
  prefix: "/" | "$" | null,
): ComposerCmd[] {
  if (!prefix) return [];
  const scoped =
    prefix === "/"
      ? all.filter((c) => c.kind === "command")
      : all.filter((c) => c.kind === "skill");
  const q = String(token || "").trim().toLowerCase();
  if (!q || q === "/" || q === "$") return scoped;
  const needle = q.replace(/^[/$\s]+/, "");
  if (!needle) return scoped;
  return scoped.filter((item) => {
    const hay = `${item.label} ${item.hint} ${item.trigger}`.toLowerCase();
    return hay.includes(needle) || item.trigger.toLowerCase().startsWith(q);
  });
}

/**
 * Replace current line prefix token with insert text (keep rest of line after first space).
 */
export function applyComposerInsert(
  value: string,
  caret: number,
  insert: string,
): { next: string; caret: number } {
  const { lineStart, line } = lineTokenBeforeCaret(value, caret);
  const afterCaret = value.slice(caret);
  // Drop the active line's command token; keep trailing args if user already typed past space
  const spaceIdx = line.indexOf(" ");
  const restOfLine = spaceIdx >= 0 ? line.slice(spaceIdx + 1) : "";
  const beforeLine = value.slice(0, lineStart);
  const nextLine = restOfLine ? `${insert}${restOfLine}` : insert;
  const next = beforeLine + nextLine + afterCaret;
  const nextCaret = (beforeLine + nextLine).length;
  return { next, caret: nextCaret };
}
