import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionEvent } from "@hfq/shared";
import { SessionManager } from "../src/manager.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function makeWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-session-"));
  temps.push(dir);
  await fs.writeFile(path.join(dir, "README.md"), "# fixture\n", "utf8");
  await fs.writeFile(
    path.join(dir, "AGENTS.md"),
    "# test workspace\nPrefer tools over guessing.\n",
    "utf8",
  );
  return dir;
}

describe("SessionManager integration", () => {
  it("runs list + read without permission prompts", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
      },
    });

    const session = await mgr.create({ workspacePath: ws, title: "test" });
    expect(session.status).toBe("idle");

    await mgr.send(session.id, "list");
    await mgr.send(session.id, "read README.md");

    const toolNames = events
      .filter((e) => e.type === "tool.completed")
      .map((e) => (e.type === "tool.completed" ? e.name : ""));

    expect(toolNames).toContain("list_dir");
    expect(toolNames).toContain("read_file");
    expect(events.some((e) => e.type === "permission.requested")).toBe(false);
    expect(events.filter((e) => e.type === "session.completed").length).toBeGreaterThanOrEqual(2);
  });

  it("requests permission for write and continues after allow", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
        if (e.type === "permission.requested") {
          const ok = mgr.resolvePermission(e.requestId, "allow");
          expect(ok).toBe(true);
        }
      },
    });

    const session = await mgr.create({ workspacePath: ws });
    await mgr.send(session.id, "write demo to out/smoke.txt");

    const written = await fs.readFile(path.join(ws, "out/smoke.txt"), "utf8");
    expect(written).toMatch(/HFQ Code demo/);

    expect(events.some((e) => e.type === "permission.requested")).toBe(true);
    expect(events.some((e) => e.type === "permission.resolved")).toBe(true);
    const diff = events.find((e) => e.type === "diff.updated" && e.path === "out/smoke.txt");
    expect(diff && diff.type === "diff.updated").toBe(true);
    if (diff && diff.type === "diff.updated") {
      expect(diff.kind).toBe("create");
      expect(diff.after).toMatch(/HFQ Code demo/);
    }
    expect(
      events.some((e) => e.type === "tool.completed" && e.name === "write_file" && e.ok),
    ).toBe(true);
    expect(
      events.some(
        (e) => e.type === "task.updated" && e.status === "completed" && e.title.includes("write"),
      ),
    ).toBe(true);
  });

  it("emits terminal.output for shell after allow", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
        if (e.type === "permission.requested") {
          mgr.resolvePermission(e.requestId, "allow");
        }
      },
    });
    const session = await mgr.create({ workspacePath: ws });
    await mgr.send(session.id, "shell echo hfq-term-ok");

    const term = events.find((e) => e.type === "terminal.output");
    expect(term && term.type === "terminal.output").toBe(true);
    if (term && term.type === "terminal.output") {
      expect(term.ok).toBe(true);
      expect(String(term.stdout ?? "")).toContain("hfq-term-ok");
    }
  });

  it("denies write when permission is denied", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
        if (e.type === "permission.requested") {
          mgr.resolvePermission(e.requestId, "deny");
        }
      },
    });

    const session = await mgr.create({ workspacePath: ws });
    await mgr.send(session.id, "write demo to denied.txt");

    await expect(fs.access(path.join(ws, "denied.txt"))).rejects.toThrow();
    const completed = events.find(
      (e) => e.type === "tool.completed" && e.name === "write_file",
    );
    expect(completed && completed.type === "tool.completed" && completed.ok).toBe(false);
  });

  it("queues concurrent sends for the same session", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
      },
    });
    const session = await mgr.create({ workspacePath: ws });

    await Promise.all([mgr.send(session.id, "list"), mgr.send(session.id, "help")]);

    const userMessages = events.filter(
      (e) => e.type === "message.completed" && e.role === "user",
    );
    expect(userMessages.length).toBe(2);
    expect(events.filter((e) => e.type === "session.completed").length).toBe(2);
  });

  it("lists persisted sessions and opens them again", async () => {
    const ws = await makeWorkspace();
    const mgr = new SessionManager();
    const session = await mgr.create({ workspacePath: ws, title: "persist-me" });
    await mgr.send(session.id, "list");

    // Simulate process restart: new manager, same disk transcripts.
    const mgr2 = new SessionManager();
    const listed = await mgr2.listAll(ws);
    expect(listed.some((s) => s.id === session.id)).toBe(true);

    const snap = await mgr2.open({ sessionId: session.id, workspacePath: ws });
    expect(snap.info.id).toBe(session.id);
    expect(snap.info.workspacePath).toBe(ws);
    expect(snap.messages.some((m) => m.role === "user" && m.text === "list")).toBe(true);
    expect(snap.events.some((e) => e.type === "session.started")).toBe(true);
    expect(snap.events.some((e) => e.type === "message.completed")).toBe(true);

    await mgr2.send(session.id, "help");
    const snap2 = mgr2.getSnapshot(session.id);
    expect(snap2?.messages.some((m) => m.role === "user" && m.text === "help")).toBe(true);
    expect(snap2?.events.length).toBeGreaterThan(snap.events.length);
  });

  it("aborts a turn waiting on permission", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    let sessionId = "";
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
        if (e.type === "permission.requested" && sessionId) {
          // Cooperative stop while the loop is blocked on permission.
          queueMicrotask(() => {
            expect(mgr.abort(sessionId)).toBe(true);
          });
        }
      },
    });
    const session = await mgr.create({ workspacePath: ws });
    sessionId = session.id;
    await mgr.send(session.id, "write demo to abort-me.txt");

    expect(events.some((e) => e.type === "session.aborted")).toBe(true);
    expect(events.some((e) => e.type === "session.failed")).toBe(false);
    await expect(fs.access(path.join(ws, "abort-me.txt"))).rejects.toThrow();
    expect(mgr.get(session.id)?.status).toBe("idle");
  });

  it("auto-titles from first message and supports rename", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
      },
    });
    const session = await mgr.create({ workspacePath: ws });
    await mgr.send(session.id, "list the workspace root");
    expect(mgr.get(session.id)?.title).toMatch(/list the workspace root/i);
    expect(events.some((e) => e.type === "session.meta")).toBe(true);

    const renamed = await mgr.rename(session.id, "My renamed session");
    expect(renamed.title).toBe("My renamed session");
    expect(mgr.get(session.id)?.title).toBe("My renamed session");

    // Offline rename after drop from memory is covered by re-list path.
    const mgr2 = new SessionManager();
    const offline = await mgr2.rename(session.id, "Offline title");
    expect(offline.title).toBe("Offline title");
    const listed = await mgr2.listAll(ws);
    expect(listed.find((s) => s.id === session.id)?.title).toBe("Offline title");
  });

  it("deletes a session from memory and disk", async () => {
    const ws = await makeWorkspace();
    const mgr = new SessionManager();
    const session = await mgr.create({ workspacePath: ws, title: "delete-me" });
    await mgr.send(session.id, "list");

    const res = await mgr.delete(session.id);
    expect(res.ok).toBe(true);
    expect(res.wasLive).toBe(true);
    expect(res.removedFile).toBe(true);
    expect(mgr.get(session.id)).toBeUndefined();

    const listed = await mgr.listAll(ws);
    expect(listed.some((s) => s.id === session.id)).toBe(false);

    // Idempotent: missing session still ok, no file.
    const again = await mgr.delete(session.id);
    expect(again.ok).toBe(true);
    expect(again.wasLive).toBe(false);
    expect(again.removedFile).toBe(false);
  });

  it("injects getExtraTools (MCP-style) into the agent loop", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const toolName = "mcp__fake__demo.echo";
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
        if (e.type === "permission.requested") {
          mgr.resolvePermission(e.requestId, "allow");
        }
      },
      getExtraTools: () => ({
        defs: [
          {
            name: toolName,
            description: "[MCP:fake] Echo text",
            risk: "medium",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
        ],
        handlers: {
          [toolName]: async (_ws, input) => ({
            content: [{ type: "text", text: String(input.text ?? "") }],
          }),
        },
      }),
    });

    const session = await mgr.create({ workspacePath: ws });
    await mgr.send(session.id, "mcp_echo hi-extra");

    const completed = events.find(
      (e) => e.type === "tool.completed" && e.name === toolName,
    );
    expect(completed && completed.type === "tool.completed" && completed.ok).toBe(true);
    if (completed && completed.type === "tool.completed") {
      const output = completed.output as { content?: Array<{ text?: string }> };
      expect(output?.content?.[0]?.text).toBe("hi-extra");
    }
  });
});
