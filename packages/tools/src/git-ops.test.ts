import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  gitCommit,
  gitDiff,
  gitLog,
  gitStage,
  gitStatus,
  gitUnstage,
  normalizeGitPaths,
} from "./git-ops.js";

const temps: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-git-ops-"));
  temps.push(dir);
  return dir;
}

function runShell(
  workspaceRoot: string,
  command: string,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";
    const child = spawn(
      isWin ? "cmd.exe" : "bash",
      isWin ? ["/d", "/s", "/c", command] : ["-lc", command],
      {
        cwd: workspaceRoot,
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`shell timeout after ${timeoutMs}ms`));
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

afterEach(async () => {
  while (temps.length) {
    const d = temps.pop();
    if (!d) break;
    await fs.rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe("normalizeGitPaths", () => {
  it("rejects path escape and flag-like names", async () => {
    const ws = await makeWorkspace();
    expect(() => normalizeGitPaths(ws, ["../outside"])).toThrow();
    expect(() => normalizeGitPaths(ws, ["-rf"])).toThrow(/flag/i);
    expect(normalizeGitPaths(ws, ["a.txt", "b/c.txt"])).toEqual(["a.txt", "b/c.txt"]);
  });
});

describe("git stage / unstage / commit", () => {
  it("stages, unstages, and commits on a real repo", async () => {
    const ws = await makeWorkspace();
    const init = await runShell(
      ws,
      "git init && git config user.email test@example.com && git config user.name hfq-test",
      20_000,
    );
    expect(init.code).toBe(0);

    await fs.writeFile(path.join(ws, "f.txt"), "one\n", "utf8");
    const first = await runShell(ws, 'git add f.txt && git commit -m "init"', 20_000);
    expect(first.code).toBe(0);

    await fs.writeFile(path.join(ws, "f.txt"), "two\n", "utf8");
    await fs.writeFile(path.join(ws, "g.txt"), "new\n", "utf8");

    const staged = await gitStage(ws, { paths: ["f.txt", "g.txt"], timeoutMs: 15_000 });
    expect(staged.ok).toBe(true);
    expect(staged.isRepo).toBe(true);

    const statusStaged = (await gitStatus(ws, {
      includeLog: false,
      timeoutMs: 15_000,
    })) as {
      isRepo: boolean;
      entries: Array<{ path: string; xy: string }>;
    };
    expect(statusStaged.isRepo).toBe(true);
    const f = statusStaged.entries.find((e) => e.path.includes("f.txt"));
    const g = statusStaged.entries.find((e) => e.path.includes("g.txt"));
    expect(f).toBeTruthy();
    expect(g).toBeTruthy();
    expect(f!.xy[0]).not.toBe(" ");
    expect(g!.xy[0]).not.toBe(" ");

    const un = await gitUnstage(ws, { paths: ["g.txt"], timeoutMs: 15_000 });
    expect(un.ok).toBe(true);

    const status2 = (await gitStatus(ws, {
      includeLog: false,
      timeoutMs: 15_000,
    })) as { entries: Array<{ path: string; xy: string }> };
    const g2 = status2.entries.find((e) => e.path.includes("g.txt"));
    expect(g2).toBeTruthy();
    expect(g2!.xy[0] === " " || g2!.xy[0] === "?").toBe(true);

    const diff = (await gitDiff(ws, {
      staged: true,
      path: "f.txt",
      timeoutMs: 15_000,
    })) as { isRepo: boolean; diff: string };
    expect(diff.isRepo).toBe(true);
    expect(diff.diff).toMatch(/two|f\.txt|-/i);

    const committed = await gitCommit(ws, {
      message: "stage commit",
      paths: [],
      timeoutMs: 15_000,
    });
    expect(committed.ok).toBe(true);
    expect(committed.sha).toBeTruthy();
  });

  it("returns isRepo false for non-repo without throw", async () => {
    const ws = await makeWorkspace();
    const st = await gitStatus(ws, { includeLog: false, timeoutMs: 10_000 });
    expect(st.isRepo).toBe(false);
    const stage = await gitStage(ws, { paths: ["x.txt"], timeoutMs: 10_000 });
    expect(stage.ok).toBe(false);
    expect(stage.isRepo).toBe(false);
  });

  it("lists recent commits via gitLog", async () => {
    const ws = await makeWorkspace();
    const init = await runShell(
      ws,
      "git init && git config user.email test@example.com && git config user.name hfq-test",
      20_000,
    );
    expect(init.code).toBe(0);
    await fs.writeFile(path.join(ws, "a.txt"), "a\n", "utf8");
    const c1 = await runShell(ws, 'git add a.txt && git commit -m "first"', 20_000);
    expect(c1.code).toBe(0);
    await fs.writeFile(path.join(ws, "a.txt"), "b\n", "utf8");
    const c2 = await runShell(ws, 'git add a.txt && git commit -m "second"', 20_000);
    expect(c2.code).toBe(0);

    const log = (await gitLog(ws, { max: 10, timeoutMs: 15_000 })) as {
      isRepo: boolean;
      entries: Array<{ shortSha: string; subject: string }>;
    };
    expect(log.isRepo).toBe(true);
    expect(log.entries.length).toBeGreaterThanOrEqual(2);
    expect(log.entries.some((e) => e.subject.includes("second"))).toBe(true);
    expect(log.entries[0]?.shortSha).toBeTruthy();
  });
});
