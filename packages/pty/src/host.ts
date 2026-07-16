import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolveWorkspaceCwd } from "./paths.js";
import { resolveShell, sanitizedEnv, type ResolvedShell } from "./shells.js";

export type PtyBackend = "node-pty" | "spawn-pipe";

export interface PtyCreateParams {
  workspaceRoot: string;
  cwd?: string | null;
  shell?: string | null;
  cols?: number;
  rows?: number;
  /** Optional tag for UI (e.g. session id) — not security boundary. */
  label?: string | null;
}

export interface PtySessionInfo {
  id: string;
  pid: number | null;
  cwd: string;
  shell: string;
  backend: PtyBackend;
  cols: number;
  rows: number;
  label: string | null;
  createdAt: string;
}

export interface PtyHostEvents {
  onData: (id: string, data: string) => void;
  onExit: (id: string, exitCode: number | null, signal?: string | null) => void;
}

interface LiveSession {
  info: PtySessionInfo;
  kill: () => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
}

type NodePtyModule = {
  spawn: (
    file: string,
    args: string[] | string,
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
    },
  ) => {
    pid: number;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
    onData: (cb: (data: string) => void) => void;
    onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => void;
  };
};

let nodePtyLoad: Promise<NodePtyModule | null> | null = null;

async function tryLoadNodePty(): Promise<NodePtyModule | null> {
  if (!nodePtyLoad) {
    nodePtyLoad = (async () => {
      try {
        const mod = (await import("node-pty")) as unknown as NodePtyModule;
        if (typeof mod.spawn === "function") return mod;
        return null;
      } catch {
        return null;
      }
    })();
  }
  return nodePtyLoad;
}

/** Force spawn-pipe backend (tests / CI without native module). */
export function resetNodePtyCacheForTests(): void {
  nodePtyLoad = null;
}

export class PtyHost {
  private sessions = new Map<string, LiveSession>();
  private events: PtyHostEvents;

  constructor(events: PtyHostEvents) {
    this.events = events;
  }

  list(): PtySessionInfo[] {
    return [...this.sessions.values()].map((s) => ({ ...s.info }));
  }

  get(id: string): PtySessionInfo | null {
    const s = this.sessions.get(id);
    return s ? { ...s.info } : null;
  }

  async create(params: PtyCreateParams): Promise<PtySessionInfo> {
    const workspaceRoot = String(params.workspaceRoot || "").trim();
    if (!workspaceRoot) throw new Error("workspaceRoot required");

    const cwd = resolveWorkspaceCwd(workspaceRoot, params.cwd);
    const shell = resolveShell(params.shell);
    const cols = clampInt(params.cols, 20, 400, 80);
    const rows = clampInt(params.rows, 5, 200, 24);
    const id = randomUUID();
    const label = params.label ? String(params.label).slice(0, 120) : null;

    const nodePty = await tryLoadNodePty();
    const live =
      nodePty != null
        ? this.spawnNodePty(id, cwd, shell, cols, rows, label, nodePty)
        : this.spawnPipe(id, cwd, shell, cols, rows, label);

    this.sessions.set(id, live);
    return { ...live.info };
  }

  write(id: string, data: string): { ok: true } {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`unknown pty: ${id}`);
    s.write(String(data ?? ""));
    return { ok: true };
  }

  resize(id: string, cols: number, rows: number): { ok: true } {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`unknown pty: ${id}`);
    const c = clampInt(cols, 20, 400, s.info.cols);
    const r = clampInt(rows, 5, 200, s.info.rows);
    s.resize(c, r);
    s.info.cols = c;
    s.info.rows = r;
    return { ok: true };
  }

  kill(id: string): { ok: true } {
    const s = this.sessions.get(id);
    if (!s) return { ok: true };
    try {
      s.kill();
    } catch {
      /* ignore */
    }
    this.sessions.delete(id);
    return { ok: true };
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id);
    }
  }

  private spawnNodePty(
    id: string,
    cwd: string,
    shell: ResolvedShell,
    cols: number,
    rows: number,
    label: string | null,
    nodePty: NodePtyModule,
  ): LiveSession {
    const env = sanitizedEnv();
    const term = nodePty.spawn(shell.file, shell.args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env,
    });
    const info: PtySessionInfo = {
      id,
      pid: term.pid ?? null,
      cwd,
      shell: shell.file,
      backend: "node-pty",
      cols,
      rows,
      label,
      createdAt: new Date().toISOString(),
    };
    term.onData((data) => {
      this.events.onData(id, data);
    });
    term.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.events.onExit(id, exitCode ?? null, null);
    });
    return {
      info,
      write: (data) => term.write(data),
      resize: (c, r) => term.resize(c, r),
      kill: () => {
        try {
          term.kill();
        } catch {
          /* ignore */
        }
      },
    };
  }

  /**
   * Degraded interactive pipe (no ConPTY). Still streams stdin/stdout for smoke / CI.
   * Full terminal apps may misbehave; prefer node-pty when native build works.
   */
  private spawnPipe(
    id: string,
    cwd: string,
    shell: ResolvedShell,
    cols: number,
    rows: number,
    label: string | null,
  ): LiveSession {
    const env = sanitizedEnv();
    env.TERM = env.TERM || "xterm-256color";
    const child: ChildProcessWithoutNullStreams = spawn(shell.file, shell.args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const info: PtySessionInfo = {
      id,
      pid: child.pid ?? null,
      cwd,
      shell: shell.file,
      backend: "spawn-pipe",
      cols,
      rows,
      label,
      createdAt: new Date().toISOString(),
    };
    const push = (buf: Buffer | string) => {
      const data = typeof buf === "string" ? buf : buf.toString("utf8");
      if (data) this.events.onData(id, data);
    };
    child.stdout.on("data", push);
    child.stderr.on("data", push);
    child.on("error", (err) => {
      this.events.onData(id, `\r\n[pty error] ${err.message}\r\n`);
    });
    child.on("exit", (code, signal) => {
      this.sessions.delete(id);
      this.events.onExit(id, code, signal);
    });
    // Banner so UI can tell degraded mode
    queueMicrotask(() => {
      this.events.onData(
        id,
        `\r\n[HFQ PTY] backend=spawn-pipe (install node-pty for ConPTY)\r\ncwd=${cwd}\r\n\r\n`,
      );
    });
    return {
      info,
      write: (data) => {
        if (child.stdin.destroyed) return;
        child.stdin.write(data);
      },
      resize: () => {
        /* pipe backend cannot resize */
      },
      kill: () => {
        try {
          if (process.platform === "win32" && child.pid) {
            spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              windowsHide: true,
              stdio: "ignore",
            });
          } else {
            child.kill("SIGTERM");
          }
        } catch {
          try {
            child.kill();
          } catch {
            /* ignore */
          }
        }
      },
    };
  }
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}
