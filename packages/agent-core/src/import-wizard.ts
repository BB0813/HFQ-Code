/**
 * One-shot import wizard: scan external skill/rule dirs → preview → copy into HFQ dirs.
 * Never dual-writes OpenClaw config. API keys only when explicitly requested.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ensureDataDirs } from "./paths.js";

export type ImportKind = "skill" | "rule";

export interface ImportCandidate {
  id: string;
  kind: ImportKind;
  sourceLabel: string;
  sourcePath: string;
  name: string;
  relativePath: string;
  bytes?: number;
}

export interface ImportScanResult {
  candidates: ImportCandidate[];
  roots: Array<{ label: string; path: string; exists: boolean }>;
}

export interface ImportApplyItem {
  id: string;
  /** skip | overwrite | rename */
  conflict?: "skip" | "overwrite" | "rename";
}

export interface ImportApplyResult {
  copied: Array<{ id: string; dest: string }>;
  skipped: Array<{ id: string; reason: string }>;
  errors: Array<{ id: string; error: string }>;
  manifestPath?: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walkSkillDirs(root: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  if (!(await pathExists(root))) return [];
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      const skillMd = path.join(full, "SKILL.md");
      if (await pathExists(skillMd)) out.push(full);
      else out.push(...(await walkSkillDirs(full, depth + 1)));
    }
  }
  return out;
}

function home(): string {
  return os.homedir();
}

export function defaultImportRoots(): Array<{ label: string; path: string }> {
  const h = home();
  return [
    { label: "AgentSkills (~/.agents/skills)", path: path.join(h, ".agents", "skills") },
    { label: "OpenClaw skills", path: path.join(h, ".openclaw", "skills") },
    {
      label: "OpenClaw workspace skills",
      path: path.join(h, ".openclaw", "workspace", "skills"),
    },
    {
      label: "Cursor user rules",
      path: path.join(h, ".cursor", "rules"),
    },
  ];
}

export async function scanImportSources(opts?: {
  extraRoots?: Array<{ label: string; path: string }>;
  workspacePath?: string;
}): Promise<ImportScanResult> {
  const roots = [...defaultImportRoots(), ...(opts?.extraRoots ?? [])];
  if (opts?.workspacePath) {
    const ws = path.resolve(opts.workspacePath);
    roots.push(
      { label: "Workspace skills", path: path.join(ws, "skills") },
      { label: "Workspace .agents/skills", path: path.join(ws, ".agents", "skills") },
      { label: "Workspace AGENTS.md", path: path.join(ws, "AGENTS.md") },
      { label: "Workspace CLAUDE.md", path: path.join(ws, "CLAUDE.md") },
      { label: "Workspace .cursorrules", path: path.join(ws, ".cursorrules") },
    );
  }

  const candidates: ImportCandidate[] = [];
  const rootMeta: ImportScanResult["roots"] = [];

  for (const r of roots) {
    const exists = await pathExists(r.path);
    rootMeta.push({ label: r.label, path: r.path, exists });
    if (!exists) continue;

    const st = await fs.stat(r.path);
    if (st.isFile()) {
      const base = path.basename(r.path);
      if (/^(AGENTS|CLAUDE|SOUL)\.md$/i.test(base) || base === ".cursorrules") {
        candidates.push({
          id: `rule:${r.path}`,
          kind: "rule",
          sourceLabel: r.label,
          sourcePath: r.path,
          name: base,
          relativePath: base,
          bytes: st.size,
        });
      }
      continue;
    }

    // directory of rules (cursor)
    if (r.path.includes(`${path.sep}.cursor${path.sep}rules`) || r.path.endsWith(`${path.sep}rules`)) {
      const files = await fs.readdir(r.path).catch(() => []);
      for (const f of files) {
        if (!/\.(md|mdc|txt)$/i.test(f)) continue;
        const full = path.join(r.path, f);
        const fst = await fs.stat(full).catch(() => null);
        if (!fst?.isFile()) continue;
        candidates.push({
          id: `rule:${full}`,
          kind: "rule",
          sourceLabel: r.label,
          sourcePath: full,
          name: f,
          relativePath: f,
          bytes: fst.size,
        });
      }
    }

    const skillDirs = await walkSkillDirs(r.path);
    for (const dir of skillDirs) {
      const name = path.basename(dir);
      const skillMd = path.join(dir, "SKILL.md");
      const fst = await fs.stat(skillMd).catch(() => null);
      candidates.push({
        id: `skill:${dir}`,
        kind: "skill",
        sourceLabel: r.label,
        sourcePath: dir,
        name,
        relativePath: name,
        bytes: fst?.size,
      });
    }
  }

  // dedupe by sourcePath
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.sourcePath)) return false;
    seen.add(c.sourcePath);
    return true;
  });

  return { candidates: unique, roots: rootMeta };
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) await copyDir(from, to);
    else if (ent.isFile()) await fs.copyFile(from, to);
  }
}

export async function applyImport(opts: {
  items: ImportApplyItem[];
  candidates: ImportCandidate[];
  /** Destination for skills (default HFQ skills dir). */
  skillsDestDir?: string;
  /** Optional workspace to write rule drafts as AGENTS.import.md */
  workspacePath?: string;
  conflictDefault?: "skip" | "overwrite" | "rename";
}): Promise<ImportApplyResult> {
  const dirs = await ensureDataDirs();
  const skillsDest = opts.skillsDestDir ?? dirs.skills;
  const byId = new Map(opts.candidates.map((c) => [c.id, c]));
  const conflictDefault = opts.conflictDefault ?? "skip";
  const result: ImportApplyResult = { copied: [], skipped: [], errors: [] };
  const manifest: Array<Record<string, unknown>> = [];

  for (const item of opts.items) {
    const c = byId.get(item.id);
    if (!c) {
      result.errors.push({ id: item.id, error: "unknown candidate" });
      continue;
    }
    const conflict = item.conflict ?? conflictDefault;
    try {
      if (c.kind === "skill") {
        let dest = path.join(skillsDest, c.name);
        if (await pathExists(dest)) {
          if (conflict === "skip") {
            result.skipped.push({ id: c.id, reason: "destination exists" });
            continue;
          }
          if (conflict === "rename") {
            dest = path.join(skillsDest, `${c.name}-imported-${Date.now().toString(36)}`);
          } else {
            await fs.rm(dest, { recursive: true, force: true });
          }
        }
        await copyDir(c.sourcePath, dest);
        result.copied.push({ id: c.id, dest });
        manifest.push({
          kind: "skill",
          source: c.sourcePath,
          dest,
          name: c.name,
          at: new Date().toISOString(),
        });
      } else {
        if (!opts.workspacePath) {
          result.skipped.push({ id: c.id, reason: "workspace required for rules" });
          continue;
        }
        const ws = path.resolve(opts.workspacePath);
        const base =
          c.name === "AGENTS.md"
            ? "AGENTS.md"
            : c.name === "CLAUDE.md"
              ? "AGENTS.from-claude.md"
              : `AGENTS.import-${c.name}`;
        let dest = path.join(ws, base);
        if (await pathExists(dest) && conflict === "skip" && base === "AGENTS.md") {
          dest = path.join(ws, "AGENTS.imported.md");
        } else if (await pathExists(dest) && conflict === "rename") {
          dest = path.join(ws, `${base}.imported-${Date.now().toString(36)}`);
        } else if (await pathExists(dest) && conflict === "skip") {
          result.skipped.push({ id: c.id, reason: "destination exists" });
          continue;
        }
        const text = await fs.readFile(c.sourcePath, "utf8");
        await fs.writeFile(dest, text, "utf8");
        result.copied.push({ id: c.id, dest });
        manifest.push({
          kind: "rule",
          source: c.sourcePath,
          dest,
          name: c.name,
          at: new Date().toISOString(),
        });
      }
    } catch (err) {
      result.errors.push({
        id: c.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (manifest.length) {
    const manifestPath = path.join(dirs.root, "import-manifest.json");
    let prev: unknown[] = [];
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const parsed = JSON.parse(raw) as { entries?: unknown[] };
      if (Array.isArray(parsed.entries)) prev = parsed.entries;
    } catch {
      /* new */
    }
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify({ version: 1, entries: [...manifest, ...prev].slice(0, 500) }, null, 2)}\n`,
      "utf8",
    );
    result.manifestPath = manifestPath;
  }

  return result;
}
