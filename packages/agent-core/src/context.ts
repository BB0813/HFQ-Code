import fs from "node:fs/promises";
import path from "node:path";
import type { SkillRecord } from "@hfq/shared";
import { skillsPromptIndex } from "@hfq/skills";

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

export async function loadProjectRules(workspacePath: string): Promise<string> {
  const agents = await readIfExists(path.join(workspacePath, "AGENTS.md"));
  if (agents?.trim()) return agents.trim();

  const claude = await readIfExists(path.join(workspacePath, "CLAUDE.md"));
  const cursor = await readIfExists(path.join(workspacePath, ".cursorrules"));
  const parts: string[] = [];
  if (claude?.trim()) parts.push(`# Imported CLAUDE.md\n${claude.trim()}`);
  if (cursor?.trim()) parts.push(`# Imported .cursorrules\n${cursor.trim()}`);
  return parts.join("\n\n");
}

export function buildSystemPrompt(opts: {
  workspacePath: string;
  projectRules: string;
  skills: SkillRecord[];
  /** Optional pre-formatted memory block from @hfq/memory. */
  memoryBlock?: string;
  /** Active model id (e.g. grok-4.5) — tell the model so it does not invent another identity. */
  model?: string;
  /** Active provider id (e.g. openai-compatible). */
  providerId?: string;
}): string {
  const skillIndex = skillsPromptIndex(opts.skills);
  const model = opts.model?.trim();
  const providerId = opts.providerId?.trim();
  const identityLines = [
    "You are HFQ Code, a desktop coding agent running inside a local workspace.",
    model
      ? `The language model behind you is "${model}"${providerId ? ` (provider: ${providerId})` : ""}. When asked which model you are, answer with that id — do not claim to be GPT-4/GPT-5, Claude, or any other model unless it matches this id.`
      : "If the user asks which model you are and you were not given a model id, say you are HFQ Code and that the model id is configured in Models settings — do not invent a brand name.",
  ];
  return [
    ...identityLines,
    "Work only inside the bound workspace unless the user explicitly expands scope.",
    "Prefer small, reviewable edits. Explain briefly, then act with tools.",
    "When you need filesystem, network, or shell access, call the provided tools (read_file, list_dir, grep, git_status, memory_search, memory_save, write_file, apply_patch, shell, network_fetch).",
    "Prefer apply_patch for multi-hunk or multi-file edits; use write_file for simple create/overwrite.",
    "Use git_status for branch/dirty-file awareness before committing-related advice; it is read-only.",
    "Use memory_search / memory_save for durable user or project facts across sessions (local machine only).",
    "Use network_fetch only for http/https docs or APIs the user asked for; do not scrape aggressively.",
    "If tools named mcp__<server>__<tool> appear, they are live MCP tools from connected servers; use them when relevant.",
    "Do not invent tool results. After tools run, continue until the user request is done or blocked on permission.",
    "Reply in the same language the user uses (Chinese or English).",
    `Workspace: ${opts.workspacePath}`,
    model ? `Model: ${model}${providerId ? ` · Provider: ${providerId}` : ""}` : "",
    opts.projectRules ? `## Project rules\n${opts.projectRules}` : "",
    skillIndex ? `## Available skills\n${skillIndex}` : "",
    opts.memoryBlock?.trim() ? opts.memoryBlock.trim() : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
