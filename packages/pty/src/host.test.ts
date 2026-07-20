import { describe, expect, it } from "vitest";
import { PtyHost, resetNodePtyCacheForTests } from "./host.js";
import { resolveWorkspaceCwd, isInsideWorkspace } from "./paths.js";
import { listAvailableShells, sanitizedEnv } from "./shells.js";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

describe("pty paths", () => {
  const root = path.join(os.tmpdir(), `hfq-pty-ws-${Date.now()}`);

  it("resolves cwd under workspace and rejects escape", () => {
    fs.mkdirSync(root, { recursive: true });
    expect(resolveWorkspaceCwd(root)).toBe(path.resolve(root));
    const sub = path.join(root, "src");
    fs.mkdirSync(sub, { recursive: true });
    expect(resolveWorkspaceCwd(root, "src")).toBe(path.resolve(sub));
    expect(() => resolveWorkspaceCwd(root, "..")).toThrow(/escapes/);
    expect(isInsideWorkspace(root, sub)).toBe(true);
    expect(isInsideWorkspace(root, path.join(root, ".."))).toBe(false);
  });
});

describe("sanitizedEnv", () => {
  it("strips secret-like keys", () => {
    const env = sanitizedEnv({
      PATH: "/bin",
      OPENAI_API_KEY: "sk-test",
      HFQ_SECRET: "x",
      NORMAL: "ok",
    } as NodeJS.ProcessEnv);
    expect(env.PATH).toBe("/bin");
    expect(env.NORMAL).toBe("ok");
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.HFQ_SECRET).toBeUndefined();
  });
});

describe("listAvailableShells", () => {
  it("returns at least one shell entry", () => {
    const shells = listAvailableShells();
    expect(shells.length).toBeGreaterThan(0);
    expect(shells[0]?.file).toBeTruthy();
    expect(shells[0]?.available).toBe(true);
  });
});

describe("PtyHost spawn-pipe smoke", () => {
  it("create → write → data → kill", async () => {
    resetNodePtyCacheForTests();
    // Force no node-pty by leaving optional dep unloaded; host falls back automatically.
    const root = path.join(os.tmpdir(), `hfq-pty-host-${Date.now()}`);
    fs.mkdirSync(root, { recursive: true });

    const chunks: string[] = [];
    const exits: Array<{ id: string; code: number | null }> = [];
    const host = new PtyHost({
      onData: (_id, data) => {
        chunks.push(data);
      },
      onExit: (id, code) => {
        exits.push({ id, code });
      },
    });

    const info = await host.create({
      workspaceRoot: root,
      cols: 80,
      rows: 24,
      shell: process.platform === "win32" ? "cmd" : undefined,
    });
    expect(info.id).toBeTruthy();
    expect(info.cwd).toBe(path.resolve(root));
    expect(info.alive).toBe(true);
    expect(info.shellKind).toBeTruthy();
    expect(["node-pty", "spawn-pipe"]).toContain(info.backend);
    expect(host.list().length).toBe(1);
    expect(host.list()[0]?.shellKind).toBe(info.shellKind);

    // Give shell a moment, then send a trivial command
    await new Promise((r) => setTimeout(r, 400));
    if (process.platform === "win32") {
      host.write(info.id, "echo HFQ_PTY_OK\r\n");
    } else {
      host.write(info.id, "echo HFQ_PTY_OK\n");
    }
    await new Promise((r) => setTimeout(r, 800));

    const joined = chunks.join("");
    // Banner or echo should produce some output
    expect(joined.length).toBeGreaterThan(0);

    const sb = host.getScrollback(info.id);
    expect(sb.id).toBe(info.id);
    expect(sb.data.length).toBeGreaterThan(0);
    expect(sb.chars).toBe(sb.data.length);

    host.kill(info.id);
    expect(host.list().length).toBe(0);
    expect(() => host.getScrollback(info.id)).toThrow(/unknown pty/);
    host.killAll();
  }, 15_000);

  it("scrollback ring truncates under cap (1.1.9 reattach)", async () => {
    resetNodePtyCacheForTests();
    const root = path.join(os.tmpdir(), `hfq-pty-sb-${Date.now()}`);
    fs.mkdirSync(root, { recursive: true });

    const host = new PtyHost(
      {
        onData: () => {},
        onExit: () => {},
      },
      { scrollbackChars: 4_000 },
    );

    const info = await host.create({
      workspaceRoot: root,
      cols: 80,
      rows: 24,
      shell: process.platform === "win32" ? "cmd" : undefined,
      scrollbackChars: 4_000,
    });

    // Deterministic overflow: inject via private emitData (compiled JS field access).
    const sessions = (host as unknown as { sessions: Map<string, unknown> }).sessions;
    const live = sessions.get(info.id) as {
      scrollback: string[];
      scrollbackChars: number;
      scrollbackCap: number;
      scrollbackTruncated: boolean;
    };
    expect(live).toBeTruthy();
    const emit = (
      host as unknown as {
        emitData: (s: typeof live, data: string) => void;
      }
    ).emitData.bind(host);
    for (let i = 0; i < 20; i++) {
      emit(live, `CHUNK-${i}-` + "X".repeat(400));
    }

    const full = host.getScrollback(info.id);
    expect(full.chars).toBeLessThanOrEqual(4_000);
    expect(full.truncated).toBe(true);
    expect(full.data.endsWith("X".repeat(50)) || full.data.includes("CHUNK-")).toBe(true);

    const tiny = host.getScrollback(info.id, 100);
    expect(tiny.chars).toBeLessThanOrEqual(100);
    expect(tiny.truncated).toBe(true);

    host.killAll();
  }, 15_000);
});
