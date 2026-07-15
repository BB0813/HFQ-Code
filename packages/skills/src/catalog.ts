/**
 * ClawHub-style skill catalog.
 *
 * Provides:
 * - a built-in curated catalog (bundled metadata)
 * - optional remote JSON catalog fetch (best-effort)
 * - local folder install into the user skills directory
 * - remote zip/tarball install (https only, size limit, optional SHA-256)
 */

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import * as tar from "tar";
import yauzl from "yauzl";
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
  /** Remote package URL (https zip/tarball). */
  packageUrl?: string;
  /** Optional expected SHA-256 (hex) of the package body. */
  packageSha256?: string;
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
      packageSha256:
        typeof o.packageSha256 === "string"
          ? o.packageSha256
          : typeof o.sha256 === "string"
            ? o.sha256
            : undefined,
    });
  }
  return out;
}

/** Default max remote skill package size (20 MiB). */
export const DEFAULT_MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
/** Default download timeout. */
export const DEFAULT_PACKAGE_TIMEOUT_MS = 60_000;

export type InstallSkillCode =
  | "already_exists"
  | "invalid"
  | "io"
  | "cancelled"
  | "network"
  | "checksum"
  | "unsafe_archive";

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
  code?: InstallSkillCode;
  /** Remote URL used when installing from package. */
  packageUrl?: string;
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

/**
 * Validate a remote skill package URL: https only, no credentials, no localhost.
 */
export function assertSafePackageUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, error: "packageUrl required" };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "invalid packageUrl" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "packageUrl must be https" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "packageUrl must not include credentials" };
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.startsWith("0.") ||
    host === "0.0.0.0"
  ) {
    return { ok: false, error: "packageUrl host not allowed" };
  }
  // Block obvious link-local / private IPv4 literals (best-effort; DNS rebinding is out of scope).
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".").map((p) => Number(p));
    const [a, b] = parts;
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return { ok: false, error: "packageUrl host not allowed" };
    }
  }
  return { ok: true, url };
}

function normalizeSha256(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const s = String(hex).trim().toLowerCase().replace(/^sha-?256:/, "");
  if (!/^[0-9a-f]{64}$/.test(s)) return undefined;
  return s;
}

/**
 * Find a directory that contains SKILL.md under `root` (depth-limited).
 * Prefers the shallowest match.
 */
export async function findSkillRoot(root: string, maxDepth = 3): Promise<string | null> {
  const rootReal = path.resolve(root);
  async function walk(dir: string, depth: number): Promise<string | null> {
    try {
      await fs.access(path.join(dir, "SKILL.md"));
      return dir;
    } catch {
      /* continue */
    }
    if (depth >= maxDepth) return null;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "." || entry.name === ".." || entry.name === ".git" || entry.name === "__MACOSX") {
        continue;
      }
      const child = path.join(dir, entry.name);
      const hit = await walk(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  return walk(rootReal, 0);
}

/**
 * Reject archive entry paths that escape the extract root.
 */
export function isSafeArchiveEntryPath(entryPath: string): boolean {
  const raw = String(entryPath || "").replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) return false;
  if (raw.includes("\0")) return false;
  const parts = raw.split("/").filter((p) => p && p !== ".");
  if (parts.some((p) => p === "..")) return false;
  // Windows device / alternate stream oddities
  if (parts.some((p) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))) return false;
  if (parts.some((p) => p.includes(":"))) return false;
  return true;
}

async function downloadToFile(opts: {
  url: string;
  destFile: string;
  maxBytes: number;
  timeoutMs: number;
  expectedSha256?: string;
}): Promise<{ bytes: number; sha256: string }> {
  const safe = assertSafePackageUrl(opts.url);
  if (!safe.ok) throw Object.assign(new Error(safe.error), { code: "invalid" as const });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const res = await fetch(safe.url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        Accept: "application/octet-stream, application/zip, application/gzip, */*",
        "User-Agent": "HFQ-Code-skills/1.0",
      },
    });
    if (!res.ok) {
      throw Object.assign(new Error(`download HTTP ${res.status}`), { code: "network" as const });
    }
    // Re-validate final URL after redirects when available.
    if (res.url) {
      const final = assertSafePackageUrl(res.url);
      if (!final.ok) {
        throw Object.assign(new Error(`redirect blocked: ${final.error}`), {
          code: "invalid" as const,
        });
      }
    }
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > opts.maxBytes) {
        throw Object.assign(new Error(`package too large (Content-Length ${n} > ${opts.maxBytes})`), {
          code: "invalid" as const,
        });
      }
    }
    if (!res.body) {
      throw Object.assign(new Error("empty response body"), { code: "network" as const });
    }

    const hash = createHash("sha256");
    let bytes = 0;
    await fs.mkdir(path.dirname(opts.destFile), { recursive: true });
    const file = createWriteStream(opts.destFile);

    const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
    for await (const chunk of nodeStream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buf.length;
      if (bytes > opts.maxBytes) {
        file.destroy();
        throw Object.assign(new Error(`package too large (> ${opts.maxBytes} bytes)`), {
          code: "invalid" as const,
        });
      }
      hash.update(buf);
      if (!file.write(buf)) {
        await new Promise<void>((resolve, reject) => {
          file.once("drain", () => resolve());
          file.once("error", reject);
        });
      }
    }
    await new Promise<void>((resolve, reject) => {
      file.end(() => resolve());
      file.once("error", reject);
    });

    const sha256 = hash.digest("hex");
    const expected = normalizeSha256(opts.expectedSha256);
    if (expected && expected !== sha256) {
      throw Object.assign(new Error(`SHA-256 mismatch (expected ${expected}, got ${sha256})`), {
        code: "checksum" as const,
      });
    }
    return { bytes, sha256 };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error("package download timed out"), { code: "network" as const });
    }
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      code: "network" as const,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function extractZipSafe(zipPath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const destReal = await fs.realpath(destDir);

  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) {
        reject(err || new Error("failed to open zip"));
        return;
      }
      zip.readEntry();
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        const name = String(entry.fileName || "");
        if (/\/$/.test(name)) {
          // directory entry
          if (!isSafeArchiveEntryPath(name.replace(/\/$/, "") + "/x")) {
            reject(
              Object.assign(new Error(`unsafe zip path: ${name}`), {
                code: "unsafe_archive" as const,
              }),
            );
            return;
          }
          const dirPath = path.join(destReal, name);
          if (!dirPath.startsWith(destReal + path.sep) && dirPath !== destReal) {
            reject(
              Object.assign(new Error(`zip path escapes extract root: ${name}`), {
                code: "unsafe_archive" as const,
              }),
            );
            return;
          }
          fs.mkdir(dirPath, { recursive: true })
            .then(() => zip.readEntry())
            .catch(reject);
          return;
        }
        if (!isSafeArchiveEntryPath(name)) {
          reject(
            Object.assign(new Error(`unsafe zip path: ${name}`), {
              code: "unsafe_archive" as const,
            }),
          );
          return;
        }
        const outPath = path.join(destReal, name);
        if (!outPath.startsWith(destReal + path.sep)) {
          reject(
            Object.assign(new Error(`zip path escapes extract root: ${name}`), {
              code: "unsafe_archive" as const,
            }),
          );
          return;
        }
        fs.mkdir(path.dirname(outPath), { recursive: true })
          .then(
            () =>
              new Promise<void>((res, rej) => {
                zip.openReadStream(entry, (e2, readStream) => {
                  if (e2 || !readStream) {
                    rej(e2 || new Error("zip read stream failed"));
                    return;
                  }
                  const ws = createWriteStream(outPath);
                  readStream.on("error", rej);
                  ws.on("error", rej);
                  ws.on("finish", () => res());
                  readStream.pipe(ws);
                });
              }),
          )
          .then(() => zip.readEntry())
          .catch(reject);
      });
      zip.on("end", () => resolve());
    });
  });
}

async function extractTarGzSafe(archivePath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const destReal = await fs.realpath(destDir);
  await tar.x({
    file: archivePath,
    cwd: destReal,
    gzip: true,
    // Fail closed on path escape / absolute paths.
    filter: (p) => {
      if (!isSafeArchiveEntryPath(p)) {
        throw Object.assign(new Error(`unsafe tar path: ${p}`), {
          code: "unsafe_archive" as const,
        });
      }
      return true;
    },
  });
}

async function extractTarSafe(archivePath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const destReal = await fs.realpath(destDir);
  await tar.x({
    file: archivePath,
    cwd: destReal,
    gzip: false,
    filter: (p) => {
      if (!isSafeArchiveEntryPath(p)) {
        throw Object.assign(new Error(`unsafe tar path: ${p}`), {
          code: "unsafe_archive" as const,
        });
      }
      return true;
    },
  });
}

function detectArchiveKind(url: string, filePath: string): "zip" | "tar.gz" | "tar" | "unknown" {
  const lower = `${url} ${filePath}`.toLowerCase();
  if (lower.includes(".tar.gz") || lower.endsWith(".tgz") || lower.includes(".tgz")) return "tar.gz";
  if (lower.includes(".tar") && !lower.includes(".tar.gz")) return "tar";
  if (lower.includes(".zip")) return "zip";
  return "unknown";
}

async function sniffArchiveKind(filePath: string): Promise<"zip" | "tar.gz" | "tar" | "unknown"> {
  const fh = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(4);
    await fh.read(buf, 0, 4, 0);
    // ZIP local file header / empty archive
    if (buf[0] === 0x50 && buf[1] === 0x4b) return "zip";
    // gzip magic
    if (buf[0] === 0x1f && buf[1] === 0x8b) return "tar.gz";
    // ustar is further in; treat as tar when extension said so — default unknown
    return "unknown";
  } finally {
    await fh.close();
  }
}

export interface InstallSkillFromPackageOptions {
  packageUrl: string;
  userSkillsDir: string;
  overwrite?: boolean;
  /** Expected SHA-256 hex of package bytes. */
  expectedSha256?: string;
  maxBytes?: number;
  timeoutMs?: number;
  /**
   * Optional injectable downloader for tests.
   * When set, skips network and writes nothing — receives dest path to fill.
   */
  download?: (opts: {
    url: string;
    destFile: string;
    maxBytes: number;
    timeoutMs: number;
    expectedSha256?: string;
  }) => Promise<{ bytes: number; sha256: string }>;
}

/**
 * Download a remote skill package (zip / tar.gz), extract safely, install into user skills.
 * Does **not** execute scripts from the package — data + SKILL.md only.
 */
export async function installSkillFromPackage(
  opts: InstallSkillFromPackageOptions,
): Promise<InstallSkillResult> {
  const packageUrl = String(opts.packageUrl || "").trim();
  const safe = assertSafePackageUrl(packageUrl);
  if (!safe.ok) {
    return { ok: false, code: "invalid", error: safe.error, packageUrl };
  }
  const userSkillsDir = path.resolve(String(opts.userSkillsDir || ""));
  if (!userSkillsDir) {
    return { ok: false, code: "invalid", error: "userSkillsDir required", packageUrl };
  }

  const maxBytes = Math.max(64 * 1024, opts.maxBytes ?? DEFAULT_MAX_PACKAGE_BYTES);
  const timeoutMs = Math.max(5_000, opts.timeoutMs ?? DEFAULT_PACKAGE_TIMEOUT_MS);
  const expectedSha256 = normalizeSha256(opts.expectedSha256);
  if (opts.expectedSha256 && !expectedSha256) {
    return {
      ok: false,
      code: "checksum",
      error: "invalid packageSha256 (need 64 hex chars)",
      packageUrl,
    };
  }

  const workRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-skill-pkg-"));
  const archivePath = path.join(workRoot, "package.bin");
  const extractDir = path.join(workRoot, "extract");

  try {
    const downloadFn = opts.download || downloadToFile;
    await downloadFn({
      url: packageUrl,
      destFile: archivePath,
      maxBytes,
      timeoutMs,
      expectedSha256,
    });

    let kind = detectArchiveKind(packageUrl, archivePath);
    if (kind === "unknown") {
      kind = await sniffArchiveKind(archivePath);
    }
    if (kind === "unknown") {
      return {
        ok: false,
        code: "invalid",
        error: "unsupported package format (need .zip / .tar.gz)",
        packageUrl,
      };
    }

    try {
      if (kind === "zip") await extractZipSafe(archivePath, extractDir);
      else if (kind === "tar.gz") await extractTarGzSafe(archivePath, extractDir);
      else await extractTarSafe(archivePath, extractDir);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: InstallSkillCode }).code
          : undefined;
      return {
        ok: false,
        code: code === "unsafe_archive" ? "unsafe_archive" : "io",
        error: err instanceof Error ? err.message : String(err),
        packageUrl,
      };
    }

    const skillRoot = await findSkillRoot(extractDir);
    if (!skillRoot) {
      return {
        ok: false,
        code: "invalid",
        error: "archive has no SKILL.md (checked up to depth 3)",
        packageUrl,
      };
    }

    const installed = await installSkillFromDir({
      sourceDir: skillRoot,
      userSkillsDir,
      overwrite: opts.overwrite,
    });
    return {
      ...installed,
      packageUrl,
      // Preserve sourceDir from dir install (extracted path) for overwrite retry.
    };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? ((err as { code?: InstallSkillCode }).code as InstallSkillCode | undefined)
        : undefined;
    return {
      ok: false,
      code: code || "network",
      error: err instanceof Error ? err.message : String(err),
      packageUrl,
    };
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
