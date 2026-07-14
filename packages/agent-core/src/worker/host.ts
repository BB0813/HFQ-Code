/**
 * Session worker host — spawns the child process and speaks NDJSON RPC.
 * Used by Electron main (and tests) so agent loops do not block the UI process.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { SessionEvent, SessionInfo } from "@hfq/shared";
import type { SessionSnapshot } from "../history.js";
import type { SubagentProfile } from "../subagent.js";
import type { PermissionDecision } from "../manager.js";
import {
  WORKER_PROTOCOL_VERSION,
  type WorkerConfigureParams,
  type WorkerCreateParams,
  type WorkerOpenParams,
  type WorkerOutbound,
  type WorkerProviderSpec,
  type WorkerRequest,
  type WorkerRequestMethod,
  type WorkerSpawnResult,
} from "./protocol.js";

export interface SessionWorkerHostOptions {
  /** Absolute path to worker entry (defaults to package dist/worker/entry.js). */
  entryPath?: string;
  /** node executable (default process.execPath — may be Electron binary). */
  nodePath?: string;
  /**
   * When running under Electron, prefer system `node` on PATH.
   * Default **false**: use `process.execPath` + `ELECTRON_RUN_AS_NODE=1` so packaged
   * apps do not require a separate Node install.
   */
  preferSystemNode?: boolean;
  env?: NodeJS.ProcessEnv;
  onEvent?: (event: SessionEvent) => void | Promise<void>;
  onLog?: (level: "info" | "warn" | "error", message: string) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  /** Max wait for ready / RPC (ms). */
  timeoutMs?: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function defaultEntryPath(): string {
  // host.js lives at dist/worker/host.js → entry.js sibling
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "entry.js");
}

function resolveNodeBinary(opts: SessionWorkerHostOptions): {
  bin: string;
  runAsNode: boolean;
} {
  if (opts.nodePath) {
    return { bin: opts.nodePath, runAsNode: false };
  }
  const exec = process.execPath;
  const looksLikeElectron =
    /electron/i.test(exec) || Boolean(process.versions.electron);
  if (opts.preferSystemNode && looksLikeElectron) {
    return {
      bin: process.platform === "win32" ? "node.exe" : "node",
      runAsNode: false,
    };
  }
  // Packaged Electron: re-enter the same binary as plain Node.
  return { bin: exec, runAsNode: looksLikeElectron };
}

export class SessionWorkerHost {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private readonly pending = new Map<string, Pending>();
  private ready = false;
  private readyWaiters: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private dead = false;
  private readonly timeoutMs: number;
  private configureParams: WorkerConfigureParams = {};
  private starting: Promise<void> | null = null;

  constructor(private readonly opts: SessionWorkerHostOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  get isAlive(): boolean {
    return Boolean(this.child && !this.dead && this.child.exitCode === null);
  }

  async start(): Promise<void> {
    if (this.isAlive && this.ready) return;
    if (this.starting) return this.starting;
    this.starting = this.spawnChild().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async spawnChild(): Promise<void> {
    this.teardownChild(false);
    this.dead = false;
    this.ready = false;

    const entry = this.opts.entryPath ?? defaultEntryPath();
    const { bin: nodeBin, runAsNode } = resolveNodeBinary(this.opts);
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...this.opts.env,
      HFQ_SESSION_WORKER: "1",
    };
    if (runAsNode) {
      childEnv.ELECTRON_RUN_AS_NODE = "1";
    }
    const child = spawn(nodeBin, [entry], {
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv,
      windowsHide: true,
    });
    this.child = child;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => this.onStdout(chunk));
    child.stderr.on("data", (chunk: string) => {
      const msg = String(chunk).trim();
      if (msg) this.opts.onLog?.("warn", `[worker stderr] ${msg}`);
    });

    child.on("error", (err) => {
      this.opts.onLog?.("error", `worker spawn error: ${err.message}`);
      this.failAllPending(err);
      this.failReady(err);
    });

    child.on("exit", (code, signal) => {
      this.dead = true;
      this.ready = false;
      const err = new Error(
        `session worker exited (code=${code ?? "null"} signal=${signal ?? "null"})`,
      );
      this.failAllPending(err);
      this.opts.onExit?.(code, signal);
    });

    await this.waitReady();
    if (Object.keys(this.configureParams).length) {
      await this.configure(this.configureParams);
    }
  }

  private waitReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("session worker ready timeout"));
      }, this.timeoutMs);
      this.readyWaiters.push({ resolve, reject, timer });
    });
  }

  private markReady(): void {
    this.ready = true;
    for (const w of this.readyWaiters.splice(0)) {
      clearTimeout(w.timer);
      w.resolve();
    }
  }

  private failReady(err: Error): void {
    for (const w of this.readyWaiters.splice(0)) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        this.handleOutbound(JSON.parse(line) as WorkerOutbound);
      } catch (err) {
        this.opts.onLog?.(
          "warn",
          `bad worker frame: ${err instanceof Error ? err.message : String(err)} :: ${line.slice(0, 200)}`,
        );
      }
    }
  }

  private handleOutbound(msg: WorkerOutbound): void {
    if ("notify" in msg) {
      if (msg.notify === "ready") {
        if (msg.protocolVersion !== WORKER_PROTOCOL_VERSION) {
          this.opts.onLog?.(
            "warn",
            `worker protocol ${msg.protocolVersion} != host ${WORKER_PROTOCOL_VERSION}`,
          );
        }
        this.markReady();
        return;
      }
      if (msg.notify === "event") {
        void this.opts.onEvent?.(msg.event);
        return;
      }
      if (msg.notify === "log") {
        this.opts.onLog?.(msg.level, msg.message);
        return;
      }
      return;
    }

    if ("id" in msg && "ok" in msg) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error?.message || "worker error"));
    }
  }

  private failAllPending(err: Error): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }

  private sendRaw(req: WorkerRequest): Promise<unknown> {
    if (!this.child?.stdin.writable) {
      return Promise.reject(new Error("session worker not running"));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        reject(new Error(`worker RPC timeout: ${req.method}`));
      }, this.timeoutMs);
      this.pending.set(req.id, { resolve, reject, timer });
      this.child!.stdin.write(`${JSON.stringify(req)}\n`, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(req.id);
          reject(err);
        }
      });
    });
  }

  private async call<T = unknown>(
    method: WorkerRequestMethod,
    params?: Record<string, unknown>,
  ): Promise<T> {
    await this.start();
    const id = randomUUID();
    const result = await this.sendRaw({ id, method, params: params ?? {} } as WorkerRequest);
    return result as T;
  }

  async configure(params: WorkerConfigureParams): Promise<void> {
    this.configureParams = { ...this.configureParams, ...params };
    await this.call("configure", params as unknown as Record<string, unknown>);
  }

  async ping(): Promise<{ pong: boolean; pid: number; configured: boolean }> {
    return this.call("ping");
  }

  async create(params: WorkerCreateParams): Promise<SessionInfo> {
    return this.call("create", params as unknown as Record<string, unknown>);
  }

  async open(params: WorkerOpenParams): Promise<SessionSnapshot> {
    return this.call("open", params as unknown as Record<string, unknown>);
  }

  async send(sessionId: string, text: string): Promise<{ ok: true; sessionId: string }> {
    return this.call("send", { sessionId, text });
  }

  async abort(sessionId: string): Promise<{ ok: boolean; sessionId: string }> {
    return this.call("abort", { sessionId });
  }

  async get(sessionId: string): Promise<SessionInfo | null> {
    return this.call("get", { sessionId });
  }

  async list(): Promise<SessionInfo[]> {
    return this.call("list");
  }

  async listAll(workspacePath?: string): Promise<SessionInfo[]> {
    return this.call("listAll", workspacePath ? { workspacePath } : {});
  }

  async snapshot(sessionId: string): Promise<SessionSnapshot | null> {
    return this.call("snapshot", { sessionId });
  }

  async delete(
    sessionId: string,
  ): Promise<{ ok: true; removedFile: boolean; wasLive: boolean }> {
    return this.call("delete", { sessionId });
  }

  async rename(sessionId: string, title: string): Promise<SessionInfo> {
    return this.call("rename", { sessionId, title });
  }

  async setPlanMode(
    sessionId: string,
    enabled: boolean,
  ): Promise<{
    ok: boolean;
    sessionId: string;
    planMode: boolean;
    permissionMode?: string;
  }> {
    return this.call("setPlanMode", { sessionId, enabled });
  }

  async getPlanMode(
    sessionId: string,
  ): Promise<{ sessionId: string; planMode: boolean; permissionMode?: string }> {
    return this.call("getPlanMode", { sessionId });
  }

  async setPermissionMode(
    sessionId: string,
    mode: string,
  ): Promise<{
    ok: boolean;
    sessionId: string;
    permissionMode: string;
    planMode: boolean;
  }> {
    return this.call("setPermissionMode", { sessionId, mode });
  }

  async getPermissionMode(
    sessionId: string,
  ): Promise<{ sessionId: string; permissionMode: string; planMode: boolean }> {
    return this.call("getPermissionMode", { sessionId });
  }

  async listChildren(sessionId: string): Promise<SessionInfo[]> {
    return this.call("listChildren", { sessionId });
  }

  async spawnSubagent(params: {
    parentSessionId: string;
    goal: string;
    profile: SubagentProfile;
    provider?: WorkerProviderSpec;
    model?: string;
    workspacePath?: string;
  }): Promise<WorkerSpawnResult> {
    return this.call("spawnSubagent", params as unknown as Record<string, unknown>);
  }

  async resolvePermission(
    requestId: string,
    decision: PermissionDecision,
  ): Promise<{ ok: boolean; requestId: string }> {
    return this.call("resolvePermission", { requestId, decision });
  }

  async listSessionAllows(sessionId: string): Promise<string[]> {
    const res = await this.call<{ sessionAllows: string[] }>("listSessionAllows", {
      sessionId,
    });
    return res.sessionAllows ?? [];
  }

  async grantSessionAllow(sessionId: string, toolName: string): Promise<string[]> {
    const res = await this.call<{ sessionAllows: string[] }>("grantSessionAllow", {
      sessionId,
      toolName,
    });
    return res.sessionAllows ?? [];
  }

  async revokeSessionAllow(sessionId: string, toolName: string): Promise<string[]> {
    const res = await this.call<{ sessionAllows: string[] }>("revokeSessionAllow", {
      sessionId,
      toolName,
    });
    return res.sessionAllows ?? [];
  }

  async shutdown(): Promise<void> {
    if (!this.isAlive) return;
    try {
      await this.call("shutdown");
    } catch {
      /* exit may race */
    }
    this.teardownChild(true);
  }

  /**
   * Kill and respawn; re-applies last configure params.
   */
  async restart(): Promise<void> {
    this.teardownChild(true);
    await this.start();
  }

  private teardownChild(kill: boolean): void {
    const child = this.child;
    this.child = null;
    this.ready = false;
    if (!child) return;
    try {
      child.stdout.removeAllListeners();
      child.stderr.removeAllListeners();
      child.removeAllListeners();
      if (kill && child.exitCode === null) {
        child.kill("SIGTERM");
        // Windows: force if still alive shortly
        setTimeout(() => {
          try {
            if (child.exitCode === null) child.kill("SIGKILL");
          } catch {
            /* ignore */
          }
        }, 1500).unref?.();
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Resolve path to built worker entry from a known package root (optional helper).
   */
  static resolveEntryFromPackageRoot(packageRoot: string): string {
    return path.join(packageRoot, "dist", "worker", "entry.js");
  }

  /**
   * Resolve agent-core package root via require.resolve.
   */
  static resolvePackageRoot(): string {
    // host.js is under dist/worker → package root is ../..
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  }
}
