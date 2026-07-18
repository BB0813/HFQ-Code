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

  it("abort only denies permissions for the aborted session tree", async () => {
    const ws = await makeWorkspace();
    const mgr = new SessionManager();
    const a = await mgr.create({ workspacePath: ws, title: "sess-a" });
    const b = await mgr.create({ workspacePath: ws, title: "sess-b" });

    // Inject waiters as the permission modal queue would (unit-level isolation).
    type Pending = {
      resolve: (d: "allow" | "deny" | "allow_session") => void;
      sessionId: string;
    };
    const pending = (
      mgr as unknown as { pending: Map<string, Pending> }
    ).pending;

    let gotA: string | null = null;
    let gotB: string | null = null;
    pending.set("req-a", {
      sessionId: a.id,
      resolve: (d) => {
        gotA = d;
      },
    });
    pending.set("req-b", {
      sessionId: b.id,
      resolve: (d) => {
        gotB = d;
      },
    });

    expect(mgr.abort(a.id)).toBe(true);
    expect(gotA).toBe("deny");
    expect(gotB).toBeNull();
    expect(pending.has("req-a")).toBe(false);
    expect(pending.has("req-b")).toBe(true);

    expect(mgr.resolvePermission("req-b", "allow")).toBe(true);
    expect(gotB).toBe("allow");
    expect(pending.has("req-b")).toBe(false);
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

  it("listAll cold-start always exposes model + providerId keys", async () => {
    const ws = await makeWorkspace();
    const mgr = new SessionManager();
    const session = await mgr.create({ workspacePath: ws, title: "identity" });
    // Live create always has identity keys.
    expect(Object.prototype.hasOwnProperty.call(session, "model")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(session, "providerId")).toBe(true);
    expect(session.model).toBeTruthy();
    expect(session.providerId).toBeTruthy();

    await mgr.send(session.id, "list the workspace root");

    // Cold manager: rebuild from JSONL only — keys must still exist.
    const cold = new SessionManager();
    const listed = await cold.listAll(ws);
    const row = listed.find((s) => s.id === session.id);
    expect(row).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(row!, "model")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(row!, "providerId")).toBe(true);
    expect(String(row!.model ?? "")).toBeTruthy();
    expect(String(row!.providerId ?? "")).toBeTruthy();
  });

  it("list/listAll attach permissionMode+planMode for live sessions only", async () => {
    const ws = await makeWorkspace();
    const mgr = new SessionManager();
    const session = await mgr.create({
      workspacePath: ws,
      title: "access-mode",
      permissionMode: "auto_edit",
    });

    // create / get / list enrich live access mode (no extra IPC needed).
    expect(session.permissionMode).toBe("auto_edit");
    expect(session.planMode).toBe(false);
    expect(mgr.get(session.id)?.permissionMode).toBe("auto_edit");
    expect(mgr.get(session.id)?.planMode).toBe(false);

    const listedLive = await mgr.listAll(ws);
    const liveRow = listedLive.find((s) => s.id === session.id);
    expect(liveRow?.permissionMode).toBe("auto_edit");
    expect(liveRow?.planMode).toBe(false);

    expect(mgr.setPermissionMode(session.id, "plan")).toBe(true);
    const afterPlan = (await mgr.listAll(ws)).find((s) => s.id === session.id);
    expect(afterPlan?.permissionMode).toBe("plan");
    expect(afterPlan?.planMode).toBe(true);

    // Cold disk-only row must omit authoritative mode (UI falls back to getPermissionMode/prefs).
    await mgr.send(session.id, "list the workspace root");
    const cold = new SessionManager();
    const coldRow = (await cold.listAll(ws)).find((s) => s.id === session.id);
    expect(coldRow).toBeTruthy();
    expect(coldRow!.permissionMode).toBeUndefined();
    expect(coldRow!.planMode).toBeUndefined();
  });

  it("runs /goal as a long-running task with elevated budget markers", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
      },
    });
    const session = await mgr.create({ workspacePath: ws, title: "goal-test" });
    await mgr.send(session.id, "/goal list the workspace and summarize");

    const goalTasks = events.filter(
      (e) => e.type === "task.updated" && String(e.title || "").startsWith("goal:"),
    );
    expect(goalTasks.length).toBeGreaterThanOrEqual(2);
    expect(goalTasks.some((e) => e.type === "task.updated" && e.status === "in_progress")).toBe(
      true,
    );
    expect(goalTasks.some((e) => e.type === "task.updated" && e.status === "completed")).toBe(
      true,
    );

    // F1 Goal Driver fields on task.updated (live stream).
    const inProg = goalTasks.find(
      (e) => e.type === "task.updated" && e.status === "in_progress",
    );
    expect(inProg && "kind" in inProg ? inProg.kind : undefined).toBe("goal");
    expect(inProg && "objective" in inProg ? inProg.objective : "").toMatch(/list the workspace/i);
    expect(inProg && "progress" in inProg ? inProg.progress : undefined).toBe(0);
    expect(
      inProg && "budget" in inProg && inProg.budget
        ? Number(inProg.budget.maxRounds) > 0
        : false,
    ).toBe(true);

    const done = goalTasks.find((e) => e.type === "task.updated" && e.status === "completed");
    expect(done && "kind" in done ? done.kind : undefined).toBe("goal");
    expect(done && "progress" in done ? done.progress : undefined).toBe(100);
    expect(done && "objective" in done ? done.objective : "").toMatch(/list the workspace/i);

    // Snapshot rebuild preserves goal driver fields (Tasks cold open).
    const snap = mgr.getSnapshot(session.id);
    expect(snap).toBeTruthy();
    const goalSnap = snap!.tasks.find(
      (t) => t.kind === "goal" || String(t.title || "").startsWith("goal:"),
    );
    expect(goalSnap).toBeTruthy();
    expect(goalSnap!.status).toBe("completed");
    expect(goalSnap!.objective).toMatch(/list the workspace/i);
    expect(goalSnap!.progress).toBe(100);
    expect(goalSnap!.budget?.maxRounds).toBeGreaterThan(0);

    const userMsg = events.find(
      (e) => e.type === "message.completed" && e.role === "user",
    );
    expect(userMsg && "text" in userMsg ? userMsg.text : "").toMatch(/^\/goal /);

    // Bare /goal should not start a failed turn — system usage hint only.
    const before = events.length;
    await mgr.send(session.id, "/goal");
    const after = events.slice(before);
    expect(
      after.some(
        (e) => e.type === "message.completed" && e.role === "system" && /\/goal/.test(e.text || ""),
      ),
    ).toBe(true);
    expect(after.some((e) => e.type === "session.failed")).toBe(false);
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

  it("delete clears spawn-attempts sidecar and parent children links", async () => {
    const ws = await makeWorkspace();
    const mgr = new SessionManager();
    const parent = await mgr.create({ workspacePath: ws, title: "parent-del" });

    const spawned = await mgr.spawnSubagent({
      parentSessionId: parent.id,
      goal: "list the workspace root",
      profile: "explore",
    });
    expect(spawned.ok).toBe(true);
    expect(spawned.childSessionId).toBeTruthy();

    // Force a failed attempt on parent so sidecar has content.
    const noGoal = await mgr.spawnSubagent({
      parentSessionId: parent.id,
      goal: "  ",
      profile: "explore",
    });
    expect(noGoal.errorCode).toBe("goal_required");

    const before = await mgr.listSpawnAttempts(parent.id);
    expect(before.some((a) => a.errorCode === "goal_required")).toBe(true);
    expect((await mgr.listChildren(parent.id)).length).toBeGreaterThan(0);

    const del = await mgr.delete(parent.id);
    expect(del.ok).toBe(true);

    // Same process: attempts sidecar + memory cleared.
    expect(await mgr.listSpawnAttempts(parent.id)).toEqual([]);
    // Children are NOT cascade-deleted: disk JSONL still has parentSessionId →
    // listChildren may still return them (orphan recovery / Tasks history).
    const kidsAfter = await mgr.listChildren(parent.id);
    expect(kidsAfter.some((c) => c.id === spawned.childSessionId)).toBe(true);

    // Cold manager: sidecar file removed — no resurrected attempts.
    const cold = new SessionManager();
    expect(await cold.listSpawnAttempts(parent.id)).toEqual([]);
    expect((await cold.listAll(ws)).some((s) => s.id === parent.id)).toBe(false);
    expect(
      (await cold.listChildren(parent.id)).some((c) => c.id === spawned.childSessionId),
    ).toBe(true);
  });

  it("spawns sub-agents with listChildren + failed spawn reasons", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
      },
    });
    const parent = await mgr.create({ workspacePath: ws, title: "parent" });

    const spawned = await mgr.spawnSubagent({
      parentSessionId: parent.id,
      goal: "list the workspace root",
      profile: "explore",
    });
    expect(spawned.ok).toBe(true);
    expect(spawned.childSessionId).toBeTruthy();

    const children = await mgr.listChildren(parent.id);
    expect(children.some((c) => c.id === spawned.childSessionId)).toBe(true);
    const child = children.find((c) => c.id === spawned.childSessionId);
    expect(child?.parentSessionId).toBe(parent.id);
    expect(child?.subagentProfile).toBe("explore");
    expect(child?.goal).toMatch(/list the workspace/i);
    expect(child?.subagentDepth).toBe(1);
    // listAll must not drop model/provider/parent fields (sidebar + return-to-parent).
    const listed = await mgr.listAll(ws);
    const listedChild = listed.find((s) => s.id === spawned.childSessionId);
    expect(listedChild?.model).toBeTruthy();
    expect(listedChild?.providerId).toBeTruthy();
    expect(listedChild?.parentSessionId).toBe(parent.id);
    expect(listedChild?.goal).toMatch(/list the workspace/i);

    const attempts = await mgr.listSpawnAttempts(parent.id);
    expect(attempts.some((a) => a.status === "completed" && a.childSessionId)).toBe(true);

    const subEvents = events.filter((e) => e.type === "subagent.updated");
    expect(subEvents.some((e) => e.type === "subagent.updated" && e.status === "started")).toBe(
      true,
    );
    expect(subEvents.some((e) => e.type === "subagent.updated" && e.status === "completed")).toBe(
      true,
    );

    // Depth limit from a depth-1 child should fail with errorCode depth (or from depth-2 if we nest).
    const childSess = mgr.get(spawned.childSessionId!);
    expect(childSess).toBeTruthy();
    // Manually create a depth-2 child then attempt spawn from it → depth > 2 fails early.
    const d2 = await mgr.create({
      workspacePath: ws,
      title: "depth2",
      parentSessionId: spawned.childSessionId,
      subagentDepth: 2,
      subagentProfile: "explore",
      goal: "deep",
    });
    // Wire depth via creating under d2 as parent requires live session depth getter.
    // spawnSubagent uses parent.getSubagentDepth()+1 — open d2 session depth is 2, so +1=3 > 2.
    const deepFail = await mgr.spawnSubagent({
      parentSessionId: d2.id,
      goal: "should fail depth",
      profile: "explore",
    });
    expect(deepFail.ok).toBe(false);
    expect(deepFail.errorCode).toBe("depth");
    expect(deepFail.childSessionId).toBe("");

    const failAttempts = await mgr.listSpawnAttempts(d2.id);
    expect(failAttempts.some((a) => a.status === "failed" && a.errorCode === "depth")).toBe(true);

    // Cold start: new manager instance rebuilds children + failed attempts from disk.
    const cold = new SessionManager();
    const coldChildren = await cold.listChildren(parent.id);
    expect(coldChildren.some((c) => c.id === spawned.childSessionId)).toBe(true);
    const coldChild = coldChildren.find((c) => c.id === spawned.childSessionId);
    expect(coldChild?.parentSessionId).toBe(parent.id);
    expect(coldChild?.goal).toMatch(/list the workspace/i);
    expect(coldChild?.subagentProfile).toBe("explore");
    expect(coldChild?.subagentDepth).toBe(1);

    const coldFailAttempts = await cold.listSpawnAttempts(d2.id);
    expect(
      coldFailAttempts.some((a) => a.status === "failed" && a.errorCode === "depth"),
    ).toBe(true);
    // attemptId always present for frontend keying (attemptId preferred over id).
    expect(coldFailAttempts.every((a) => Boolean(a.attemptId))).toBe(true);

    // goal_required also persists for Tasks failure chips after restart.
    const noGoal = await mgr.spawnSubagent({
      parentSessionId: parent.id,
      goal: "   ",
      profile: "explore",
    });
    expect(noGoal.ok).toBe(false);
    expect(noGoal.errorCode).toBe("goal_required");
    const coldGoal = await new SessionManager().listSpawnAttempts(parent.id);
    expect(
      coldGoal.some((a) => a.status === "failed" && a.errorCode === "goal_required"),
    ).toBe(true);

    const empty = await cold.listChildren("no-such-parent");
    expect(empty).toEqual([]);
    expect(
      events.some(
        (e) =>
          e.type === "subagent.updated" &&
          e.parentSessionId === d2.id &&
          e.status === "failed" &&
          e.errorCode === "depth",
      ),
    ).toBe(true);
  });

  it("emits thinking.delta / thinking.completed when mock CoT is requested", async () => {
    const ws = await makeWorkspace();
    const events: SessionEvent[] = [];
    const mgr = new SessionManager({
      onEvent: async (e) => {
        events.push(e);
      },
    });
    const session = await mgr.create({ workspacePath: ws, title: "think" });
    await mgr.send(session.id, "show 思考过程 please");

    const deltas = events.filter((e) => e.type === "thinking.delta");
    const done = events.find((e) => e.type === "thinking.completed");
    expect(deltas.length).toBeGreaterThan(0);
    expect(done && done.type === "thinking.completed" && done.text).toMatch(/mock thinking/i);
    if (done && done.type === "thinking.completed") {
      const sameId = deltas.every(
        (d) => d.type === "thinking.delta" && d.messageId === done.messageId,
      );
      expect(sameId).toBe(true);
    }
    // Live deltas must not land in durable snapshot event log.
    const snap = mgr.getSnapshot(session.id);
    expect(snap).toBeTruthy();
    expect(snap!.events.some((e) => e.type === "thinking.delta")).toBe(false);
    expect(snap!.events.some((e) => e.type === "thinking.completed")).toBe(true);
    expect(snap!.messages.some((m) => m.role === "thinking")).toBe(true);
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
