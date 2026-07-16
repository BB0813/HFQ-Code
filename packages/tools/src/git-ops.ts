import { spawn } from "node:child_process";
import path from "node:path";
import { resolveWorkspacePath } from "./workspace.js";

/** Child env for shell/git: drop obvious secret-bearing keys from the parent process. */
export function sanitizedChildEnv(
  extra?: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const key of Object.keys(env)) {
    if (/api[_-]?key|access[_-]?token|secret|password|credential|private[_-]?key/i.test(key)) {
      delete env[key];
    }
  }
  return env;
}

/** Spawn git with argv (avoids shell metachar / Windows % expansion). */
export function runGit(
  workspaceRoot: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: workspaceRoot,
      env: sanitizedChildEnv({
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
      }),
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const max = 500_000;

    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < max) stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < max) stderr += d.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`git timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

export function parseGitBranchLine(line: string): {
  branch: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  detached: boolean;
} {
  // ## main...origin/main [ahead 1, behind 2]
  // ## HEAD (no branch)
  const raw = line.replace(/^##\s*/, "").trim();
  if (!raw || /^HEAD \(no branch\)$/i.test(raw)) {
    return { branch: "HEAD", detached: true };
  }
  const detachedMatch = raw.match(/^HEAD detached at (\S+)/i);
  if (detachedMatch) {
    return { branch: detachedMatch[1] || "HEAD", detached: true };
  }
  const tracking = raw.match(/^(\S+?)(?:\.\.\.(\S+))?(?:\s+\[([^\]]+)\])?$/);
  const branch = tracking?.[1] || raw.split(/\s+/)[0] || "HEAD";
  const upstream = tracking?.[2];
  let ahead: number | undefined;
  let behind: number | undefined;
  const meta = tracking?.[3] || "";
  const aheadM = meta.match(/ahead\s+(\d+)/i);
  const behindM = meta.match(/behind\s+(\d+)/i);
  if (aheadM) ahead = Number(aheadM[1]);
  if (behindM) behind = Number(behindM[1]);
  return {
    branch,
    upstream,
    ahead,
    behind,
    detached: branch === "HEAD",
  };
}

export function parsePorcelainEntry(line: string): {
  xy: string;
  path: string;
  origPath?: string;
} | null {
  if (!line || line.startsWith("##")) return null;
  // XY PATH or XY ORIG -> PATH for renames
  if (line.length < 4) return null;
  const xy = line.slice(0, 2);
  const rest = line.slice(3);
  const arrow = rest.indexOf(" -> ");
  if (arrow >= 0) {
    return {
      xy,
      origPath: rest.slice(0, arrow).trim(),
      path: rest.slice(arrow + 4).trim(),
    };
  }
  return { xy, path: rest.trim() };
}

/** Safe commit-ish / object name for argv (no shell, no path tricks). */
export function assertSafeGitObject(raw: string): string {
  const s = raw.trim() || "HEAD";
  if (s.length > 200) throw new Error("git object ref too long");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/@~^:-]*$/.test(s)) {
    throw new Error(`unsafe git object ref: ${raw}`);
  }
  if (s.includes("..") || s.includes("\\")) {
    throw new Error(`unsafe git object ref: ${raw}`);
  }
  return s;
}

/** Normalize relative pathspecs under workspace; reject escapes and flag-like names. */
export function normalizeGitPaths(workspaceRoot: string, rawPaths: unknown): string[] {
  const list = Array.isArray(rawPaths) ? rawPaths : [];
  const paths: string[] = [];
  for (const p of list) {
    const rel = String(p ?? "")
      .trim()
      .replace(/\\/g, "/");
    if (!rel || rel === ".") continue;
    resolveWorkspacePath(workspaceRoot, rel);
    if (rel.startsWith("-")) throw new Error(`path looks like a flag: ${rel}`);
    paths.push(rel);
  }
  if (paths.length > 200) throw new Error("too many paths (max 200)");
  return paths;
}

async function ensureGitRepo(
  workspaceRoot: string,
  timeoutMs: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let version;
  try {
    version = await runGit(workspaceRoot, ["--version"], Math.min(timeoutMs, 8_000));
  } catch (err) {
    return {
      ok: false,
      error: `git not available: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (version.code !== 0) {
    return {
      ok: false,
      error: `git not available: ${(version.stderr || version.stdout || "git --version failed").trim()}`,
    };
  }
  const inside = await runGit(workspaceRoot, ["rev-parse", "--is-inside-work-tree"], timeoutMs);
  const insideOk =
    inside.code === 0 && String(inside.stdout || "").trim().toLowerCase() === "true";
  if (!insideOk) {
    return {
      ok: false,
      error: (inside.stderr || inside.stdout || "not a git repository").trim(),
    };
  }
  return { ok: true };
}

export async function gitStatus(
  workspaceRoot: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = Number(input.timeoutMs ?? 15_000);
  const includeLog = input.includeLog !== false;
  const maxEntries = Math.min(Math.max(Number(input.maxEntries ?? 200) || 200, 1), 1000);

  let pathspec: string | undefined;
  if (input.path != null && String(input.path).trim()) {
    const abs = resolveWorkspacePath(workspaceRoot, String(input.path));
    pathspec = path.relative(workspaceRoot, abs) || ".";
    if (pathspec === "") pathspec = ".";
  }

  const ready = await ensureGitRepo(workspaceRoot, timeoutMs);
  if (!ready.ok) {
    if (/git not available/i.test(ready.error)) {
      throw new Error(ready.error);
    }
    return {
      isRepo: false,
      workspace: workspaceRoot,
      error: ready.error,
    };
  }

  const statusArgs = ["status", "--porcelain=v1", "-b"];
  if (pathspec) statusArgs.push("--", pathspec);
  const status = await runGit(workspaceRoot, statusArgs, timeoutMs);
  if (status.code !== 0) {
    throw new Error(
      `git status failed: ${(status.stderr || status.stdout || `exit ${status.code}`).trim()}`,
    );
  }

  const lines = String(status.stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  const branchLine = lines.find((l) => l.startsWith("##")) || "## HEAD";
  const branchInfo = parseGitBranchLine(branchLine);
  const rawEntryCount = lines.filter((l) => !l.startsWith("##")).length;
  const entries = lines
    .map(parsePorcelainEntry)
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .slice(0, maxEntries);

  const head = await runGit(workspaceRoot, ["rev-parse", "--short", "HEAD"], timeoutMs);
  const headSha =
    head.code === 0 ? String(head.stdout || "").trim() || undefined : undefined;

  let recent: Array<{ sha: string; subject: string }> | undefined;
  if (includeLog) {
    const log = await runGit(
      workspaceRoot,
      ["log", "-5", "--pretty=format:%h\t%s"],
      timeoutMs,
    );
    if (log.code === 0) {
      recent = String(log.stdout || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const tab = l.indexOf("\t");
          if (tab < 0) return { sha: l, subject: "" };
          return { sha: l.slice(0, tab), subject: l.slice(tab + 1) };
        });
    }
  }

  return {
    isRepo: true,
    workspace: workspaceRoot,
    pathspec: pathspec || ".",
    branch: branchInfo.branch,
    detached: branchInfo.detached,
    upstream: branchInfo.upstream,
    ahead: branchInfo.ahead,
    behind: branchInfo.behind,
    head: headSha,
    dirty: entries.length > 0,
    entryCount: entries.length,
    truncated: rawEntryCount > entries.length,
    entries,
    recent,
    porcelain: String(status.stdout || "").slice(0, 80_000),
  };
}

export async function gitDiff(
  workspaceRoot: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 15_000), 1000), 60_000);
  const maxBytes = Math.min(Math.max(Number(input.maxBytes ?? 120_000), 1024), 500_000);
  const pathspec = input.path != null ? String(input.path).trim() : "";
  const staged = Boolean(input.staged);

  const ready = await ensureGitRepo(workspaceRoot, timeoutMs);
  if (!ready.ok) {
    return { isRepo: false, error: ready.error };
  }

  if (pathspec) {
    resolveWorkspacePath(workspaceRoot, pathspec);
  }

  const args = ["diff", "--no-color"];
  if (staged) args.push("--cached");
  if (pathspec) args.push("--", pathspec);
  const diff = await runGit(workspaceRoot, args, timeoutMs);
  if (diff.code !== 0) {
    throw new Error(
      `git diff failed: ${(diff.stderr || diff.stdout || `exit ${diff.code}`).trim()}`,
    );
  }
  const text = String(diff.stdout || "");
  return {
    isRepo: true,
    staged,
    pathspec: pathspec || ".",
    bytes: Buffer.byteLength(text, "utf8"),
    truncated: text.length > maxBytes,
    diff: text.slice(0, maxBytes),
  };
}

export async function gitShow(
  workspaceRoot: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 15_000), 1000), 60_000);
  const maxBytes = Math.min(Math.max(Number(input.maxBytes ?? 120_000), 1024), 500_000);
  const object = assertSafeGitObject(String(input.object ?? "HEAD"));
  const pathspec = input.path != null ? String(input.path).trim() : "";
  if (pathspec) {
    resolveWorkspacePath(workspaceRoot, pathspec);
  }

  const ready = await ensureGitRepo(workspaceRoot, timeoutMs);
  if (!ready.ok) {
    return { isRepo: false, error: ready.error };
  }

  const showTarget = pathspec ? `${object}:${pathspec.replace(/\\/g, "/")}` : object;
  const show = await runGit(
    workspaceRoot,
    pathspec
      ? ["show", "--no-color", showTarget]
      : ["show", "--no-color", "--stat", "--patch", object],
    timeoutMs,
  );
  const text = String(show.stdout || "");
  const code = show.code;
  const stderr = String(show.stderr || "");
  if (code !== 0) {
    throw new Error(`git show failed: ${(stderr || text || `exit ${code}`).trim()}`);
  }
  return {
    isRepo: true,
    object,
    path: pathspec || null,
    bytes: Buffer.byteLength(text, "utf8"),
    truncated: text.length > maxBytes,
    content: text.slice(0, maxBytes),
  };
}

export async function gitCommit(
  workspaceRoot: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 30_000), 1000), 120_000);
  const message = String(input.message ?? "").trim();
  if (!message) throw new Error("commit message required");
  if (message.length > 8_000) throw new Error("commit message too long");
  if (/\b--amend\b|\b--no-verify\b|\b--allow-empty\b/i.test(message)) {
    throw new Error("commit message must not embed git flags");
  }

  const paths = normalizeGitPaths(workspaceRoot, input.paths);

  const ready = await ensureGitRepo(workspaceRoot, timeoutMs);
  if (!ready.ok) {
    return {
      ok: false,
      isRepo: false,
      error: ready.error,
    };
  }

  if (paths.length) {
    const add = await runGit(workspaceRoot, ["add", "--", ...paths], timeoutMs);
    if (add.code !== 0) {
      throw new Error(
        `git add failed: ${(add.stderr || add.stdout || `exit ${add.code}`).trim()}`,
      );
    }
  }

  // Commit staged index only — never --amend, never --no-verify, never force.
  const commit = await runGit(workspaceRoot, ["commit", "-m", message], timeoutMs);
  if (commit.code !== 0) {
    const err = (commit.stderr || commit.stdout || `exit ${commit.code}`).trim();
    return {
      ok: false,
      isRepo: true,
      stagedPaths: paths,
      error: err,
      stdout: String(commit.stdout || "").slice(0, 4_000),
      stderr: String(commit.stderr || "").slice(0, 4_000),
    };
  }

  const head = await runGit(workspaceRoot, ["rev-parse", "--short", "HEAD"], timeoutMs);
  const sha = String(head.stdout || "").trim();
  return {
    ok: true,
    isRepo: true,
    sha: sha || null,
    message,
    stagedPaths: paths,
    stdout: String(commit.stdout || "").slice(0, 4_000),
  };
}

/**
 * Stage paths (`git add -- …`). Empty paths = no-op with ok:false.
 * Human Changes UI / IPC; not an agent tool (agent uses git_commit paths).
 */
export async function gitStage(
  workspaceRoot: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 30_000), 1000), 120_000);
  const paths = normalizeGitPaths(workspaceRoot, input.paths);
  if (!paths.length) throw new Error("paths required");

  const ready = await ensureGitRepo(workspaceRoot, timeoutMs);
  if (!ready.ok) {
    return { ok: false, isRepo: false, error: ready.error };
  }

  const add = await runGit(workspaceRoot, ["add", "--", ...paths], timeoutMs);
  if (add.code !== 0) {
    return {
      ok: false,
      isRepo: true,
      paths,
      error: (add.stderr || add.stdout || `exit ${add.code}`).trim(),
      stdout: String(add.stdout || "").slice(0, 4_000),
      stderr: String(add.stderr || "").slice(0, 4_000),
    };
  }
  return {
    ok: true,
    isRepo: true,
    paths,
    stdout: String(add.stdout || "").slice(0, 4_000),
  };
}

/**
 * Unstage paths. Prefer `git restore --staged`; fall back to `git reset HEAD --`.
 */
export async function gitUnstage(
  workspaceRoot: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 30_000), 1000), 120_000);
  const paths = normalizeGitPaths(workspaceRoot, input.paths);
  if (!paths.length) throw new Error("paths required");

  const ready = await ensureGitRepo(workspaceRoot, timeoutMs);
  if (!ready.ok) {
    return { ok: false, isRepo: false, error: ready.error };
  }

  let result = await runGit(
    workspaceRoot,
    ["restore", "--staged", "--", ...paths],
    timeoutMs,
  );
  let method: "restore" | "reset" = "restore";
  if (result.code !== 0) {
    result = await runGit(workspaceRoot, ["reset", "HEAD", "--", ...paths], timeoutMs);
    method = "reset";
  }
  if (result.code !== 0) {
    return {
      ok: false,
      isRepo: true,
      paths,
      method,
      error: (result.stderr || result.stdout || `exit ${result.code}`).trim(),
      stdout: String(result.stdout || "").slice(0, 4_000),
      stderr: String(result.stderr || "").slice(0, 4_000),
    };
  }
  return {
    ok: true,
    isRepo: true,
    paths,
    method,
    stdout: String(result.stdout || "").slice(0, 4_000),
  };
}

/**
 * Recent commits for Changes UI history strip.
 * Format: sha, shortSha, subject, author, relativeDate, isoDate.
 */
export async function gitLog(
  workspaceRoot: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 15_000), 1000), 60_000);
  const max = Math.min(Math.max(Number(input.max ?? input.limit ?? 30) || 30, 1), 100);
  const pathspec =
    input.path != null && String(input.path).trim()
      ? (() => {
          const abs = resolveWorkspacePath(workspaceRoot, String(input.path));
          let rel = path.relative(workspaceRoot, abs) || ".";
          if (rel === "") rel = ".";
          return rel;
        })()
      : undefined;

  const ready = await ensureGitRepo(workspaceRoot, timeoutMs);
  if (!ready.ok) {
    if (/git not available/i.test(ready.error)) throw new Error(ready.error);
    return { isRepo: false, workspace: workspaceRoot, error: ready.error, entries: [] };
  }

  // %x1f field sep · %x1e record sep — avoid collision with subject text
  const pretty = "%H%x1f%h%x1f%s%x1f%an%x1f%ar%x1f%aI%x1e";
  const args = ["log", `-n${max}`, `--pretty=format:${pretty}`];
  if (pathspec) args.push("--", pathspec);

  const log = await runGit(workspaceRoot, args, timeoutMs);
  if (log.code !== 0) {
    throw new Error(
      `git log failed: ${(log.stderr || log.stdout || `exit ${log.code}`).trim()}`,
    );
  }

  const entries = String(log.stdout || "")
    .split("\x1e")
    .map((chunk) => chunk.replace(/^\r?\n/, "").trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split("\x1f");
      return {
        sha: parts[0] || "",
        shortSha: parts[1] || "",
        subject: parts[2] || "",
        author: parts[3] || "",
        relativeDate: parts[4] || "",
        isoDate: parts[5] || "",
      };
    })
    .filter((e) => e.sha);

  return {
    isRepo: true,
    workspace: workspaceRoot,
    pathspec: pathspec || ".",
    max,
    entries,
  };
}
