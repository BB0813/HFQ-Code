import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@hfq/shared";
import { buildSessionSnapshot } from "../src/history.js";

describe("buildSessionSnapshot", () => {
  it("rebuilds messages, diffs, terminal and tasks", () => {
    const events: SessionEvent[] = [
      {
        type: "session.started",
        sessionId: "s1",
        workspacePath: "D:/proj",
        at: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "message.completed",
        sessionId: "s1",
        messageId: "m1",
        role: "user",
        text: "write demo to a.txt",
        at: "2026-01-01T00:00:01.000Z",
      },
      {
        type: "tool.started",
        sessionId: "s1",
        callId: "tc1",
        name: "write_file",
        input: { path: "a.txt", content: "hello" },
        at: "2026-01-01T00:00:01.500Z",
      },
      {
        type: "tool.completed",
        sessionId: "s1",
        callId: "tc1",
        name: "write_file",
        ok: true,
        output: { path: "a.txt", bytes: 5, kind: "create" },
        at: "2026-01-01T00:00:01.800Z",
      },
      {
        type: "diff.updated",
        sessionId: "s1",
        path: "a.txt",
        kind: "create",
        before: "",
        after: "hello",
        at: "2026-01-01T00:00:02.000Z",
      },
      {
        type: "terminal.output",
        sessionId: "s1",
        callId: "c1",
        command: "echo hi",
        stdout: "hi\n",
        ok: true,
        code: 0,
        at: "2026-01-01T00:00:03.000Z",
      },
      {
        type: "task.updated",
        sessionId: "s1",
        taskId: "c1",
        title: "shell: echo hi",
        status: "completed",
        at: "2026-01-01T00:00:03.000Z",
      },
      {
        type: "thinking.completed",
        sessionId: "s1",
        messageId: "m-think",
        text: "I will write a.txt with hello",
        at: "2026-01-01T00:00:01.200Z",
      },
      {
        type: "usage.updated",
        sessionId: "s1",
        inputTokens: 10,
        outputTokens: 20,
        at: "2026-01-01T00:00:03.500Z",
      },
      {
        type: "usage.updated",
        sessionId: "s1",
        inputTokens: 5,
        outputTokens: 7,
        at: "2026-01-01T00:00:03.600Z",
      },
      {
        type: "session.meta",
        sessionId: "s1",
        title: "Custom title",
        at: "2026-01-01T00:00:03.700Z",
      },
      {
        type: "session.completed",
        sessionId: "s1",
        at: "2026-01-01T00:00:04.000Z",
      },
    ];

    const snap = buildSessionSnapshot(events, { id: "s1" });
    expect(snap.info.workspacePath).toBe("D:/proj");
    expect(snap.info.status).toBe("idle");
    expect(snap.info.title).toBe("Custom title");
    expect(snap.usage).toEqual({ inputTokens: 15, outputTokens: 27 });
    expect(snap.messages.some((m) => m.role === "user")).toBe(true);
    const think = snap.messages.find((m) => m.role === "thinking");
    expect(think?.text).toContain("write a.txt");
    expect(think?.thinking).toBe(true);
    expect(think?.messageId).toBe("m-think");
    // CoT must not pollute model history.
    expect(snap.chatMessages.some((m) => (m as { role: string }).role === "thinking")).toBe(
      false,
    );
    expect(snap.changes[0]?.path).toBe("a.txt");
    expect(snap.changes[0]?.after).toBe("hello");
    expect(snap.terminal[0]?.command).toBe("echo hi");
    expect(snap.tasks[0]?.status).toBe("completed");
    expect(snap.chatMessages.some((m) => m.role === "user")).toBe(true);
    const assistantWithTools = snap.chatMessages.find(
      (m) => m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0,
    );
    expect(assistantWithTools?.tool_calls?.[0]?.id).toBe("tc1");
    expect(
      snap.chatMessages.some((m) => m.role === "tool" && m.tool_call_id === "tc1"),
    ).toBe(true);
    expect(snap.events.length).toBe(events.length);
    expect(snap.events[0]?.type).toBe("session.started");
  });

  it("derives title from first user message when no session.meta", () => {
    const events: SessionEvent[] = [
      {
        type: "session.started",
        sessionId: "s2",
        workspacePath: "D:/proj",
        at: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "message.completed",
        sessionId: "s2",
        messageId: "m1",
        role: "user",
        text: "fix the login bug please",
        at: "2026-01-01T00:00:01.000Z",
      },
    ];
    const snap = buildSessionSnapshot(events, { id: "s2" });
    expect(snap.info.title).toBe("fix the login bug please");
  });

  it("restores model + providerId + subagent fields from session.meta", () => {
    const events: SessionEvent[] = [
      {
        type: "session.started",
        sessionId: "s3",
        workspacePath: "D:/proj",
        at: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "session.meta",
        sessionId: "s3",
        title: "child scan",
        model: "mimo-v2.5-free",
        providerId: "opencode",
        parentSessionId: "parent-9",
        subagentProfile: "explore",
        subagentDepth: 1,
        goal: "list root",
        at: "2026-01-01T00:00:01.000Z",
      },
    ];
    const snap = buildSessionSnapshot(events, { id: "s3" });
    expect(snap.info.model).toBe("mimo-v2.5-free");
    expect(snap.info.providerId).toBe("opencode");
    expect(snap.info.parentSessionId).toBe("parent-9");
    expect(snap.info.subagentProfile).toBe("explore");
    expect(snap.info.subagentDepth).toBe(1);
    expect(snap.info.goal).toBe("list root");
  });

  it("always includes model + providerId keys (empty string when unknown)", () => {
    const events: SessionEvent[] = [
      {
        type: "session.started",
        sessionId: "s4",
        workspacePath: "D:/legacy",
        at: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "message.completed",
        sessionId: "s4",
        messageId: "m1",
        role: "user",
        text: "hello legacy",
        at: "2026-01-01T00:00:01.000Z",
      },
    ];
    const snap = buildSessionSnapshot(events, { id: "s4" });
    // UX1: keys present even without session.meta identity.
    expect(Object.prototype.hasOwnProperty.call(snap.info, "model")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(snap.info, "providerId")).toBe(true);
    expect(snap.info.model).toBe("");
    expect(snap.info.providerId).toBe("");
  });
});
