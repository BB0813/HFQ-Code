/**
 * ClawHub-style skill catalog (1.0.5 scaffold).
 *
 * Full remote ClawHub marketplace is phased; this module provides:
 * - a built-in curated catalog (bundled metadata)
 * - optional remote JSON catalog fetch (best-effort)
 * - local folder install into the user skills directory
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseSkillMarkdown } from "./parse.js";

export interface SkillCatalogItem {
  id: string;
  name: string;
  description: string;
  /** Catalog origin tag for UI badges. */
  origin: "curated" | "remote" | "local_preview";
  /** Optional homepage / docs. */
  homepage?: string;
  /** Tags for filter chips. */
  tags?: string[];
  /** True when already present among installed skill names. */
  installed?: boolean;
  /** Optional author / publisher label. */
  author?: string;
  /** Remote package hint (not auto-downloaded in 1.0.5). */
  packageUrl?: string;
}

export interface SkillCatalogResult {
  items: SkillCatalogItem[];
  source: "curated" | "remote" | "mixed";
  remoteError?: string;
  fetchedAt: string;
}

/** Official-ish default remote catalog (optional; may 404). */
export const DEFAULT_SKILL_CATALOG_URL =
  "https://raw.githubusercontent.com/BB0813/HFQ-Code/main/skills/catalog.json";

/** Curated starter list shown even offline. */
export function curatedCatalog(): SkillCatalogItem[] {
  return [
    {
      id: "hello-workspace",
      name: "hello-workspace",
      description: "Introduce HFQ Code workspace conventions and AGENTS.md usage.",
      origin: "curated",
      tags: ["onboarding", "bundled"],
      author: "HFQ",
    },
    {
      id: "code-review-checklist",
      name: "code-review-checklist",
      description: "Structured PR / diff review checklist for coding agents (coming as pack).",
      origin: "curated",
      tags: ["review", "planned"],
      author: "HFQ",
    },
    {
      id: "git-safe-commit",
      name: "git-safe-commit",
      description: "Conventional commits + pre-commit sanity checks via tools.",
      origin: "curated",
      tags: ["git", "planned"],
      author: "HFQ",
    },
    {
      id: "test-fix-loop",
      name: "test-fix-loop",
      description: "Run failing tests, patch, re-run until green or blocked.",
      origin: "curated",
      tags: ["test", "planned"],
      author: "HFQ",
    },
    {
      id: "docs-from-diff",
      name: "docs-from-diff",
      description: "Turn recent file changes into CHANGELOG / README snippets.",
      origin: "curated",
      tags: ["docs", "planned"],
      author: "HFQ",
    },
  ];
}

function isSafeSkillName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name);
}

/**
 * Mark catalog rows as installed when name matches local skills.
 */
export function annotateInstalled(
  items: SkillCatalogItem[],
  installedNames: Iterable<string>,
): SkillCatalogItem[] {
  const set = new Set(
    [...installedNames].map((n) => String(n || "").trim().toLowerCase()).filter(Boolean),
  );
  return items.map((it) => ({
    ...it,
    installed: set.has(String(it.name || "").trim().toLowerCase()),
  }));
}

/**
 * Merge curated + optional remote rows (remote wins on same id).
 */
export function mergeCatalog(
  curated: SkillCatalogItem[],
  remote: SkillCatalogItem[],
): SkillCatalogItem[] {
  const map = new Map<string, SkillCatalogItem>();
  for (const it of curated) {
    map.set(it.id || it.name, { ...it, origin: it.origin || "curated" });
  }
  for (const it of remote) {
    const key = it.id || it.name;
    if (!key) continue;
    map.set(key, {
      ...map.get(key),
      ...it,
      origin: "remote",
      id: key,
      name: it.name || key,
      description: it.description || map.get(key)?.description || "",
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalize unknown JSON into catalog items (best-effort).
 */
export function parseRemoteCatalogJson(data: unknown): SkillCatalogItem[] {
  const root = data as { skills?: unknown; items?: unknown };
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(root?.skills)
      ? root.skills
      : Array.isArray(root?.items)
        ? root.items
        : [];
  const out: SkillCatalogItem[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const name = String(o.name || o.id || "").trim();
    if (!name || !isSafeSkillName(name)) continue;
    out.push({
      id: String(o.id || name).trim(),
      name,
      description: String(o.description || "").trim() || name,
      origin: "remote",
      homepage: typeof o.homepage === "string" ? o.homepage : undefined,
      tags: Array.isArray(o.tags) ? o.tags.map(String).slice(0, 12) : undefined,
      author: typeof o.author === "string" ? o.author : undefined,
      packageUrl: typeof o.packageUrl === "string" ? o.packageUrl : undefined,
    });
  }
  return out;
}

export interface InstallSkillFromDirOptions {
  /** Absolute path to a folder containing SKILL.md */
  sourceDir: string;
  /** Absolute user skills root (e.g. %APPDATA%/HFQ-Code/skills) */
  userSkillsDir: string;
  /** Overwrite existing destination skill dir */
  overwrite?: boolean;
}

export interface InstallSkillResult {
  ok: boolean;
  name?: string;
  destDir?: string;
  /** Source folder used for install (so UI can retry overwrite without re-picking). */
  sourceDir?: string;
  error?: string;
  /** Machine-readable conflict / error code for UI. */
  code?: "already_exists" | "invalid" | "io" | "cancelled";
}

export interface SkillPreviewResult {
  ok: boolean;
  name?: string;
  description?: string;
  body?: string;
  path?: string;
  source?: string;
  error?: string;
}

/**
 * Read SKILL.md for preview. `skillDir` must resolve under one of `allowedRoots`.
 */
export async function readSkillPreview(opts: {
  skillDir?: string;
  allowedRoots: string[];
  maxChars?: number;
}): Promise<SkillPreviewResult> {
  const maxChars = Math.max(2_000, Math.min(200_000, opts.maxChars ?? 48_000));
  const skillDir = path.resolve(String(opts.skillDir || ""));
  if (!skillDir) return { ok: false, error: "skillDir required" };

  let realDir: string;
  try {
    realDir = await fs.realpath(skillDir);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const roots: string[] = [];
  for (const r of opts.allowedRoots || []) {
    try {
      roots.push(await fs.realpath(path.resolve(r)));
    } catch {
      /* skip missing root */
    }
  }
  const underRoot = roots.some(
    (root) => realDir === root || realDir.startsWith(root + path.sep),
  );
  if (!underRoot) {
    return { ok: false, error: "skill path outside allowed skill roots" };
  }

  const mdPath = path.join(realDir, "SKILL.md");
  try {
    const raw = await fs.readFile(mdPath, "utf8");
    const { frontmatter } = parseSkillMarkdown(raw);
    const text = raw.length > maxChars ? `${raw.slice(0, maxChars)}\n\n…` : raw;
    return {
      ok: true,
      name: frontmatter.name,
      description: frontmatter.description,
      body: text,
      path: mdPath,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Copy a local skill directory into the user skills root.
 * Requires SKILL.md with a valid name; rejects path escapes via realpath checks.
 */
export async function installSkillFromDir(
  opts: InstallSkillFromDirOptions,
): Promise<InstallSkillResult> {
  const sourceDir = path.resolve(String(opts.sourceDir || ""));
  const userSkillsDir = path.resolve(String(opts.userSkillsDir || ""));
  if (!sourceDir || !userSkillsDir) {
    return {
      ok: false,
      code: "invalid",
      error: "sourceDir and userSkillsDir required",
    };
  }

  let sourceReal: string;
  let userReal: string;
  try {
    sourceReal = await fs.realpath(sourceDir);
    await fs.mkdir(userSkillsDir, { recursive: true });
    userReal = await fs.realpath(userSkillsDir);
  } catch (err) {
    return {
      ok: false,
      code: "io",
      error: err instanceof Error ? err.message : String(err),
      sourceDir,
    };
  }

  const skillMd = path.join(sourceReal, "SKILL.md");
  let raw: string;
  try {
    raw = await fs.readFile(skillMd, "utf8");
  } catch {
    return {
      ok: false,
      code: "invalid",
      error: "SKILL.md not found in source folder",
      sourceDir: sourceReal,
    };
  }

  let name: string;
  try {
    const { frontmatter } = parseSkillMarkdown(raw);
    name = String(frontmatter.name || "").trim();
  } catch (err) {
    return {
      ok: false,
      code: "invalid",
      error: err instanceof Error ? err.message : "invalid SKILL.md",
      sourceDir: sourceReal,
    };
  }
  if (!isSafeSkillName(name)) {
    return {
      ok: false,
      code: "invalid",
      error: `unsafe skill name: ${name || "(empty)"}`,
      sourceDir: sourceReal,
    };
  }

  const destDir = path.join(userReal, name);
  // Destination must stay under user skills root
  if (!destDir.startsWith(userReal + path.sep) && destDir !== userReal) {
    return {
      ok: false,
      code: "invalid",
      error: "destination escapes user skills directory",
      name,
      sourceDir: sourceReal,
    };
  }

  try {
    await fs.access(destDir);
    if (!opts.overwrite) {
      return {
        ok: false,
        code: "already_exists",
        error: `skill already installed: ${name}`,
        name,
        destDir,
        sourceDir: sourceReal,
      };
    }
    await fs.rm(destDir, { recursive: true, force: true });
  } catch {
    /* dest does not exist — good */
  }

  try {
    await copyDirRecursive(sourceReal, destDir);
  } catch (err) {
    return {
      ok: false,
      code: "io",
      error: err instanceof Error ? err.message : String(err),
      name,
      sourceDir: sourceReal,
    };
  }

  return { ok: true, name, destDir, sourceDir: sourceReal };
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "." || entry.name === ".." || entry.name === ".git") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}
