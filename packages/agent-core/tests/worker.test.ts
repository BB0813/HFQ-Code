import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionEvent } from "@hfq/shared";
import { SessionWorkerHost } from "../src/worker/host.js";

const temps: string[] = [];
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entryPath = path.join(packageRoot, "dist", "worker", "entry.js");

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-worker-"));
  temps.push(dir);
  await fs.writeFile(path.join(dir, "README.md"), "# fixture\n", "utf8");
  await fs.writeFile(
    path.join(dir, "AGENTS.md"),
    "# test workspace\nPrefer tools over guessing.\n",
    "utf8",
  );
  return dir;
}

async function makeHost(onEvent?: (e: SessionEvent) => void): Promise<SessionWorkerHost> {
  // Ensure built entry exists (pnpm build before tests in CI; local may need rebuild).
  await fs.access(entryPath);
  const host = new SessionWorkerHost({
    entryPath,
    preferSystemNode: false,
    nodePath: process.execPath,
    timeoutMs: 45_000,
    onEvent,
    onLog: (level, message) => {
      if (level === "error") console.error("[worker]", message);
    },
  });
  await host.start();
  await host.configure({
    bundledSkillsDir: path.join(packageRoot, "..", "..", "skills", "bundled"),
    memoryEnabled: false,
  });
  return host;
}

describe("SessionWorkerHost", () => {
  it("pings and reports ready protocol", async () => {
    const host = await makeHost();
    try {
      const pong = await host.ping();
      expect(pong.pong).toBe(true);
      expect(pong.pid).toBeGreaterThan(0);
      expect(host.isAlive).toBe(true);
    } finally {
      await host.shutdown();
    }
  });

  it("runs list + read tools in the child process", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const host = await makeHost((e) => {
      events.push(e);
    });
    try {
      const session = await host.create({
        workspacePath: ws,
        title: "worker-test",
        provider: { id: "mock", kind: "mock" },
        model: "mock-hfq",
      });
      expect(session.id).toBeTruthy();

      await host.send(session.id, "list");
      await host.send(session.id, "read README.md");

      const toolNames = events
        .filter((e) => e.type === "tool.completed")
        .map((e) => (e.type === "tool.completed" ? e.name : ""));
      expect(toolNames).toContain("list_dir");
      expect(toolNames).toContain("read_file");
      expect(events.some((e) => e.type === "session.completed")).toBe(true);

      // Child process must not be the test runner pid.
      expect(host.pid).toBeDefined();
      expect(host.pid).not.toBe(process.pid);
    } finally {
      await host.shutdown();
    }
  });

  it("surfaces permission.requested and continues after resolve", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const host = await makeHost(async (e) => {
      events.push(e);
      if (e.type === "permission.requested") {
        await host.resolvePermission(e.requestId, "allow");
      }
    });
    try {
      const session = await host.create({
        workspacePath: ws,
        provider: { id: "mock", kind: "mock" },
        model: "mock-hfq",
      });
      await host.send(session.id, "write demo to out/worker.txt");
      const written = await fs.readFile(path.join(ws, "out/worker.txt"), "utf8");
      expect(written).toMatch(/HFQ Code demo/);
      expect(events.some((e) => e.type === "permission.requested")).toBe(true);
      expect(events.some((e) => e.type === "permission.resolved")).toBe(true);
    } finally {
      await host.shutdown();
    }
  });

  it("restarts after the child process dies", async () => {
    const ws = await makeWorkspace();
    const host = await makeHost();
    try {
      await host.create({
        workspacePath: ws,
        provider: { id: "mock", kind: "mock" },
        model: "mock-hfq",
      });
      const childPid = host.pid;
      expect(childPid).toBeTruthy();
      try {
        process.kill(childPid!);
      } catch {
        // Already gone
      }
      // Wait for exit handler
      await new Promise((r) => setTimeout(r, 500));
      expect(host.isAlive).toBe(false);
      await host.restart();
      const pong = await host.ping();
      expect(pong.pong).toBe(true);
      const again = await host.create({
        workspacePath: ws,
        title: "after-restart",
        provider: { id: "mock", kind: "mock" },
        model: "mock-hfq",
      });
      expect(again.title).toMatch(/after-restart/);
    } finally {
      await host.shutdown();
    }
  });
});
