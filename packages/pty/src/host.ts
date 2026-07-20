import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolveWorkspaceCwd } from "./paths.js";
import { resolveShell, sanitizedEnv, type ResolvedShell, type ShellKind } from "./shells.js";

export type PtyBackend = "node-pty" | "spawn-pipe";

/** Soft cap for reattach scrollback (chars). FE remount / tab switch replays this. */
export const DEFAULT_PTY_SCROLLBACK_CHARS = 200_000;

export interface PtyCreateParams {
  workspaceRoot: string;
  cwd?: string | null;
  shell?: string | null;
  cols?: number;
  rows?: number;
  /** Optional tag for UI (e.g. session id) — not security boundary. */
  label?: string | null;
  /** Override ring-buffer size (chars). Clamped 4k..2M. */
  scrollbackChars?: number;
}

export interface PtySessionInfo {
  id: string;
  pid: number | null;
  cwd: string;
  shell: string;
  /** Whitelisted kind when known (powershell / pwsh / cmd). */
  shellKind: ShellKind | null;
  backend: PtyBackend;
  cols: number;
  rows: number;
  label: string | null;
  createdAt: string;
  /** Always true for list()/get() results (dead sessions are removed). */
  alive: true;
}

export interface PtyScrollback {
  id: string;
  data: string;
  /** True when older output was dropped to stay under the ring cap. */
  truncated: boolean;
  bytes: number;
  chars: number;
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
  /** Ring buffer of recent output for reattach. */
  scrollback: string[];
  scrollbackChars: number;
  scrollbackCap: number;
  scrollbackTruncated: boolean;
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
  private defaultScrollbackCap: number;

  constructor(events: PtyHostEvents, opts?: { scrollbackChars?: number }) {
    this.events = events;
    this.defaultScrollbackCap = clampScrollbackCap(
      opts?.scrollbackChars ?? DEFAULT_PTY_SCROLLBACK_CHARS,
    );
  }

  list(): PtySessionInfo[] {
    return [...this.sessions.values()].map((s) => ({ ...s.info }));
  }

  get(id: string): PtySessionInfo | null {
    const s = this.sessions.get(id);
    return s ? { ...s.info } : null;
  }

  /**
   * Return recent output for a live session so the renderer can reattach
   * after remount / page switch without losing history (1.1.9 B1-2).
   */
  getScrollback(id: string, maxChars?: number): PtyScrollback {
    const s = this.sessions.get(String(id || "").trim());
    if (!s) throw new Error(`unknown pty: ${id}`);
    // Read-side max can be smaller than the ring floor (4k); only used to slice response.
    const cap =
      maxChars != null && Number.isFinite(Number(maxChars)) && Number(maxChars) > 0
        ? Math.min(s.scrollbackCap, Math.floor(Number(maxChars)))
        : s.scrollbackCap;
    let data = s.scrollback.join("");
    let truncated = s.scrollbackTruncated;
    if (data.length > cap) {
      data = data.slice(data.length - cap);
      truncated = true;
    }
    return {
      id: s.info.id,
      data,
      truncated,
      bytes: Buffer.byteLength(data, "utf8"),
      chars: data.length,
    };
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
    const scrollbackCap = clampScrollbackCap(
      params.scrollbackChars ?? this.defaultScrollbackCap,
    );

    const nodePty = await tryLoadNodePty();
    const live =
      nodePty != null
        ? this.spawnNodePty(id, cwd, shell, cols, rows, label, scrollbackCap, nodePty)
        : this.spawnPipe(id, cwd, shell, cols, rows, label, scrollbackCap);

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

  private pushScrollback(live: LiveSession, data: string): void {
    if (!data) return;
    live.scrollback.push(data);
    live.scrollbackChars += data.length;
    while (live.scrollbackChars > live.scrollbackCap && live.scrollback.length > 0) {
      const dropped = live.scrollback.shift()!;
      live.scrollbackChars -= dropped.length;
      live.scrollbackTruncated = true;
    }
    // Rare edge: single chunk larger than cap
    if (live.scrollbackChars > live.scrollbackCap && live.scrollback.length === 1) {
      const only = live.scrollback[0]!;
      const keep = only.slice(only.length - live.scrollbackCap);
      live.scrollback[0] = keep;
      live.scrollbackChars = keep.length;
      live.scrollbackTruncated = true;
    }
  }

  private emitData(live: LiveSession, data: string): void {
    if (!data) return;
    this.pushScrollback(live, data);
    this.events.onData(live.info.id, data);
  }

  private spawnNodePty(
    id: string,
    cwd: string,
    shell: ResolvedShell,
    cols: number,
    rows: number,
    label: string | null,
    scrollbackCap: number,
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
      shellKind: shell.kind,
      backend: "node-pty",
      cols,
      rows,
      label,
      createdAt: new Date().toISOString(),
      alive: true,
    };
    const live: LiveSession = {
      info,
      scrollback: [],
      scrollbackChars: 0,
      scrollbackCap,
      scrollbackTruncated: false,
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
    term.onData((data) => {
      this.emitData(live, data);
    });
    term.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.events.onExit(id, exitCode ?? null, null);
    });
    return live;
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
    scrollbackCap: number,
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
      shellKind: shell.kind,
      backend: "spawn-pipe",
      cols,
      rows,
      label,
      createdAt: new Date().toISOString(),
      alive: true,
    };
    const live: LiveSession = {
      info,
      scrollback: [],
      scrollbackChars: 0,
      scrollbackCap,
      scrollbackTruncated: false,
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
    const push = (buf: Buffer | string) => {
      const data = typeof buf === "string" ? buf : buf.toString("utf8");
      if (data) this.emitData(live, data);
    };
    child.stdout.on("data", push);
    child.stderr.on("data", push);
    child.on("error", (err) => {
      this.emitData(live, `\r\n[pty error] ${err.message}\r\n`);
    });
    child.on("exit", (code, signal) => {
      this.sessions.delete(id);
      this.events.onExit(id, code, signal);
    });
    // Banner so UI can tell degraded mode
    queueMicrotask(() => {
      this.emitData(
        live,
        `\r\n[HFQ PTY] backend=spawn-pipe (install node-pty for ConPTY)\r\ncwd=${cwd}\r\n\r\n`,
      );
    });
    return live;
  }
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function clampScrollbackCap(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_PTY_SCROLLBACK_CHARS;
  return Math.min(2_000_000, Math.max(4_000, Math.floor(v)));
}
