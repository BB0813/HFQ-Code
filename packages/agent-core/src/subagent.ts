/**
 * Sub-agent profiles and spawn helpers (Phase-2).
 * Parent sessions spawn child sessions with tool/budget limits.
 */

export type SubagentProfile = "explore" | "edit" | "shell";

export interface SubagentSpawnParams {
  parentSessionId: string;
  goal: string;
  profile?: SubagentProfile;
  maxRounds?: number;
  maxToolCalls?: number;
  title?: string;
}

export interface SubagentBudget {
  maxRounds: number;
  maxToolCalls: number;
  depth: number;
}

export const SUBAGENT_MAX_DEPTH = 2;

/** Tools allowed per profile (deny-list style enforced in loop via allow set). */
export function toolsForProfile(profile: SubagentProfile): {
  allow: Set<string> | null;
  deny: Set<string>;
} {
  if (profile === "explore") {
    return {
      allow: new Set([
        "read_file",
        "list_dir",
        "grep",
        "git_status",
        "git_diff",
        "git_show",
        "memory_search",
        "network_fetch",
      ]),
      deny: new Set([
        "write_file",
        "apply_patch",
        "shell",
        "git_commit",
        "memory_save",
        "spawn_subagent",
      ]),
    };
  }
  if (profile === "edit") {
    return {
      allow: null,
      deny: new Set(["shell", "git_commit", "spawn_subagent"]),
    };
  }
  // shell: full tools but spawn blocked (git_commit still available behind policy ask)
  return {
    allow: null,
    deny: new Set(["spawn_subagent"]),
  };
}

export function defaultBudget(profile: SubagentProfile, depth: number): SubagentBudget {
  if (profile === "explore") {
    return { maxRounds: 8, maxToolCalls: 24, depth };
  }
  if (profile === "edit") {
    return { maxRounds: 10, maxToolCalls: 30, depth };
  }
  return { maxRounds: 10, maxToolCalls: 20, depth };
}

export function formatSubagentSummary(opts: {
  goal: string;
  profile: SubagentProfile;
  childSessionId: string;
  assistantText?: string;
  changePaths?: string[];
  ok: boolean;
  error?: string;
}): string {
  const lines = [
    `## Sub-agent result (${opts.profile})`,
    `Goal: ${opts.goal}`,
    `Child session: ${opts.childSessionId}`,
    opts.ok ? "Status: completed" : `Status: failed — ${opts.error || "unknown"}`,
  ];
  if (opts.changePaths?.length) {
    lines.push(`Changes: ${opts.changePaths.join(", ")}`);
  }
  if (opts.assistantText?.trim()) {
    lines.push("", opts.assistantText.trim().slice(0, 4_000));
  }
  return lines.join("\n");
}
