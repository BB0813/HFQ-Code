import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { platform } from "node:os";
import type { SkillRecord } from "@hfq/shared";
import { applyBaseDir, parseSkillMarkdown } from "./parse.js";

export type SkillSource =
  | "workspace"
  | "project_agents"
  | "user"
  | "shared_agents"
  | "bundled";

export interface SkillLoadRoots {
  workspacePath?: string;
  userSkillsDir?: string;
  sharedAgentsDir?: string;
  bundledDir?: string;
}

const MAX_DEPTH = 6;

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walkSkillFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  if (!(await pathExists(root))) return [];

  const entries = await fsp.readdir(root, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkSkillFiles(full, depth + 1)));
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      out.push(full);
    }
  }
  return out;
}

function whichSyncHint(bin: string): boolean {
  const pathEnv = process.env.PATH ?? process.env.Path ?? "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  const exts =
    platform() === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)
      : [""];

  for (const dir of parts) {
    for (const ext of exts) {
      const candidate = path.join(dir, bin + (platform() === "win32" ? ext : ""));
      try {
        fs.accessSync(candidate);
        return true;
      } catch {
        /* continue */
      }
    }
    try {
      fs.accessSync(path.join(dir, bin));
      return true;
    } catch {
      /* continue */
    }
  }
  return false;
}

function evaluateEligibility(frontmatter: {
  metadata?: {
    openclaw?: {
      os?: Array<"darwin" | "linux" | "win32">;
      requires?: { bins?: string[]; anyBins?: string[]; env?: string[] };
    };
  };
}): { eligible: boolean; reason?: string } {
  const oc = frontmatter.metadata?.openclaw;
  if (!oc) return { eligible: true };

  if (oc.os && oc.os.length > 0) {
    const current =
      platform() === "win32" ? "win32" : platform() === "darwin" ? "darwin" : "linux";
    if (!oc.os.includes(current)) {
      return { eligible: false, reason: `os gate: need ${oc.os.join("|")}, got ${current}` };
    }
  }

  const bins = oc.requires?.bins ?? [];
  for (const bin of bins) {
    if (!whichSyncHint(bin)) {
      return { eligible: false, reason: `missing required bin: ${bin}` };
    }
  }

  const anyBins = oc.requires?.anyBins ?? [];
  if (anyBins.length > 0 && !anyBins.some((b) => whichSyncHint(b))) {
    return { eligible: false, reason: `missing anyBins: ${anyBins.join("|")}` };
  }

  const envs = oc.requires?.env ?? [];
  for (const key of envs) {
    if (!process.env[key]) {
      return { eligible: false, reason: `missing env: ${key}` };
    }
  }

  return { eligible: true };
}

async function loadFromRoot(
  root: string,
  source: SkillSource,
): Promise<SkillRecord[]> {
  const files = await walkSkillFiles(root);
  const records: SkillRecord[] = [];

  for (const file of files) {
    try {
      const raw = await fsp.readFile(file, "utf8");
      const { frontmatter, body } = parseSkillMarkdown(raw);
      const dir = path.dirname(file);
      const gate = evaluateEligibility(frontmatter);
      records.push({
        name: frontmatter.name,
        description: frontmatter.description,
        dir,
        source,
        body: applyBaseDir(body, dir),
        enabled: true,
        eligible: gate.eligible,
        ineligibleReason: gate.reason,
      });
    } catch (err) {
      // Skip invalid skills; UI can surface load errors later.
      console.warn(`[skills] skip ${file}:`, err instanceof Error ? err.message : err);
    }
  }

  return records;
}

/**
 * Load skills with precedence: workspace > project .agents > user > shared ~/.agents > bundled.
 * First name wins.
 */
export async function loadSkills(roots: SkillLoadRoots): Promise<SkillRecord[]> {
  const layers: Array<{ root?: string; source: SkillSource }> = [
    {
      root: roots.workspacePath
        ? path.join(roots.workspacePath, "skills")
        : undefined,
      source: "workspace",
    },
    {
      root: roots.workspacePath
        ? path.join(roots.workspacePath, ".agents", "skills")
        : undefined,
      source: "project_agents",
    },
    { root: roots.userSkillsDir, source: "user" },
    { root: roots.sharedAgentsDir, source: "shared_agents" },
    { root: roots.bundledDir, source: "bundled" },
  ];

  const byName = new Map<string, SkillRecord>();

  for (const layer of layers) {
    if (!layer.root) continue;
    const batch = await loadFromRoot(layer.root, layer.source);
    for (const skill of batch) {
      if (!byName.has(skill.name)) {
        byName.set(skill.name, skill);
      }
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function skillsPromptIndex(skills: SkillRecord[], maxChars = 4000): string {
  const eligible = skills.filter((s) => s.enabled && s.eligible);
  const lines = eligible.map(
    (s) => `- ${s.name}: ${s.description.replace(/\s+/g, " ").trim()}`,
  );
  let out = lines.join("\n");
  if (out.length > maxChars) {
    out = out.slice(0, maxChars) + "\n…";
  }
  return out;
}
