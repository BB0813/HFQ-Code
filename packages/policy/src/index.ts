import type { PermissionDecision, ToolRisk } from "@hfq/shared";

/** Claude Code / ZCode-style access modes. */
export type PermissionMode =
  | "confirm_before_change"
  | "auto_edit"
  | "plan"
  | "full_access";

export const PERMISSION_MODES: PermissionMode[] = [
  "confirm_before_change",
  "auto_edit",
  "plan",
  "full_access",
];

export function isPermissionMode(value: unknown): value is PermissionMode {
  return (
    value === "confirm_before_change" ||
    value === "auto_edit" ||
    value === "plan" ||
    value === "full_access"
  );
}

export function normalizePermissionMode(value: unknown, fallback: PermissionMode = "confirm_before_change"): PermissionMode {
  return isPermissionMode(value) ? value : fallback;
}

/** Tools auto-allowed in `auto_edit` (shell / network still ask). */
const AUTO_EDIT_TOOLS = new Set(["write_file", "apply_patch"]);

export interface PolicyRule {
  toolName: string;
  decision: PermissionDecision;
}

export interface PolicyConfig {
  /** default by risk when no tool-specific rule */
  byRisk: Record<ToolRisk, PermissionDecision>;
  rules: PolicyRule[];
  /** session-scoped allows */
  sessionAllows: Set<string>;
}

export function defaultPolicyConfig(): PolicyConfig {
  return {
    byRisk: {
      low: "allow",
      medium: "ask",
      high: "ask",
    },
    rules: [
      { toolName: "read_file", decision: "allow" },
      { toolName: "read_document", decision: "allow" },
      { toolName: "list_dir", decision: "allow" },
      { toolName: "grep", decision: "allow" },
      { toolName: "git_status", decision: "allow" },
      { toolName: "git_diff", decision: "allow" },
      { toolName: "git_show", decision: "allow" },
      { toolName: "memory_search", decision: "allow" },
      { toolName: "memory_save", decision: "ask" },
      { toolName: "spawn_subagent", decision: "ask" },
      { toolName: "write_file", decision: "ask" },
      { toolName: "apply_patch", decision: "ask" },
      { toolName: "shell", decision: "ask" },
      { toolName: "git_commit", decision: "ask" },
      { toolName: "network_fetch", decision: "ask" },
    ],
    sessionAllows: new Set(),
  };
}

const DANGEROUS_SHELL = [
  /\brm\s+(-[a-zA-Z]*f|\/s)\b/i,
  /\bdel\s+\/[fq]\b/i,
  /\berase\s+\/[fq]\b/i,
  /\bformat\s+[a-z]:/i,
  /\bRemove-Item\b.*-Recurse/i,
  /\bshutdown\b/i,
  /\breg\s+delete\b/i,
  /\bmkfs\b/i,
  />\s*\/dev\/sd/i,
  /\bcipher\s+\/w\b/i,
  /\bdiskpart\b/i,
  /\bInvoke-WebRequest\b.*\|\s*iex\b/i,
  /\bcurl\b.*\|\s*(ba)?sh\b/i,
  /\bwget\b.*\|\s*(ba)?sh\b/i,
  /\bpowershell\b.*-enc(odedcommand)?\b/i,
];

export function isDangerousShell(command: string): boolean {
  return DANGEROUS_SHELL.some((re) => re.test(command));
}

export function resolvePermission(
  config: PolicyConfig,
  toolName: string,
  risk: ToolRisk,
  detail?: { command?: string; permissionMode?: PermissionMode },
): PermissionDecision {
  const mode = detail?.permissionMode ?? "confirm_before_change";

  // True YOLO: full_access auto-allows everything, including dangerous shell.
  if (mode === "full_access") return "allow";

  // Plan mode is enforced earlier in the agent loop (hard-deny mutators).
  // If something still reaches policy while plan is on, keep default ask rules.

  // Dangerous shell always re-prompts outside full_access — session allow must not skip.
  if (toolName === "shell" && detail?.command && isDangerousShell(detail.command)) {
    return "ask";
  }

  if (config.sessionAllows.has(toolName)) return "allow";

  if (mode === "auto_edit" && AUTO_EDIT_TOOLS.has(toolName)) {
    return "allow";
  }

  const rule = config.rules.find((r) => r.toolName === toolName);
  if (rule) return rule.decision;
  return config.byRisk[risk];
}

export function grantSessionAllow(config: PolicyConfig, toolName: string): void {
  config.sessionAllows.add(toolName);
}

export function revokeSessionAllow(config: PolicyConfig, toolName: string): void {
  config.sessionAllows.delete(toolName);
}

export function listSessionAllows(config: PolicyConfig): string[] {
  return [...config.sessionAllows].sort();
}

export interface PolicyMatrixRow {
  toolName: string;
  risk: ToolRisk;
  decision: PermissionDecision;
  note?: string;
  /** Effective decision after session-scoped allows (if provided). */
  effectiveDecision?: PermissionDecision;
  sessionAllowed?: boolean;
}

/** Matrix for Permissions UI; pass sessionAllows for effective decisions. */
export function defaultPolicyMatrix(sessionAllows: Iterable<string> = []): PolicyMatrixRow[] {
  const cfg = defaultPolicyConfig();
  for (const name of sessionAllows) cfg.sessionAllows.add(name);
  const catalog: Array<{ toolName: string; risk: ToolRisk; note?: string }> = [
    { toolName: "read_file", risk: "low", note: "读取工作区内文件" },
    { toolName: "read_document", risk: "low", note: "读取文档（文本/docx/尽力 pdf）" },
    { toolName: "list_dir", risk: "low", note: "列出目录" },
    { toolName: "grep", risk: "low", note: "工作区内正则搜索" },
    { toolName: "git_status", risk: "low", note: "只读 git 状态 / 最近提交（不改仓库）" },
    { toolName: "git_diff", risk: "low", note: "只读 git diff（不改仓库）" },
    { toolName: "git_show", risk: "low", note: "只读 git show（不改仓库）" },
    { toolName: "memory_search", risk: "low", note: "检索本机记忆笔记" },
    { toolName: "memory_save", risk: "medium", note: "写入本机记忆笔记；默认询问" },
    { toolName: "spawn_subagent", risk: "medium", note: "派生子代理会话；默认询问" },
    { toolName: "write_file", risk: "medium", note: "创建或覆盖文件" },
    { toolName: "apply_patch", risk: "medium", note: "应用多文件补丁" },
    { toolName: "shell", risk: "high", note: "在工作区执行命令；危险命令始终询问" },
    {
      toolName: "git_commit",
      risk: "high",
      note: "写入 git 提交（可 stage 路径）；默认询问；无 force/amend",
    },
    { toolName: "network_fetch", risk: "medium", note: "HTTP(S) 请求；默认询问" },
    {
      toolName: "mcp__*",
      risk: "medium",
      note: "已连接 MCP 的实时工具（名称 mcp__server__tool）；默认按中风险询问",
    },
  ];
  return catalog.map((item) => {
    // Wildcard rows (e.g. mcp__*) are documentation only — not grantable as a single tool.
    if (item.toolName.includes("*")) {
      return {
        ...item,
        decision: cfg.byRisk[item.risk],
        effectiveDecision: cfg.byRisk[item.risk],
        sessionAllowed: false,
      };
    }
    const base = resolvePermission(
      { ...cfg, sessionAllows: new Set() },
      item.toolName,
      item.risk,
    );
    const effective = resolvePermission(cfg, item.toolName, item.risk);
    return {
      ...item,
      decision: base,
      effectiveDecision: effective,
      sessionAllowed: cfg.sessionAllows.has(item.toolName),
    };
  });
}
