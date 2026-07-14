import { describe, expect, it } from "vitest";
import { SessionEventSchema } from "./events.js";

describe("SessionEventSchema", () => {
  it("accepts tool.completed events", () => {
    const parsed = SessionEventSchema.parse({
      type: "tool.completed",
      sessionId: "s1",
      callId: "c1",
      name: "read_file",
      ok: true,
      output: { content: "x" },
      at: new Date().toISOString(),
    });
    expect(parsed.type).toBe("tool.completed");
  });

  it("rejects unknown event types", () => {
    expect(() =>
      SessionEventSchema.parse({
        type: "not.real",
        at: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("accepts enriched diff / terminal / task events", () => {
    expect(
      SessionEventSchema.parse({
        type: "diff.updated",
        sessionId: "s1",
        path: "a.txt",
        kind: "create",
        before: "",
        after: "hello",
        at: new Date().toISOString(),
      }).type,
    ).toBe("diff.updated");

    expect(
      SessionEventSchema.parse({
        type: "terminal.output",
        sessionId: "s1",
        callId: "c1",
        command: "echo hi",
        stdout: "hi\n",
        stderr: "",
        code: 0,
        ok: true,
        at: new Date().toISOString(),
      }).type,
    ).toBe("terminal.output");

    expect(
      SessionEventSchema.parse({
        type: "task.updated",
        sessionId: "s1",
        taskId: "t1",
        title: "write a.txt",
        status: "completed",
        detail: "ok",
        at: new Date().toISOString(),
      }).type,
    ).toBe("task.updated");

    expect(
      SessionEventSchema.parse({
        type: "session.aborted",
        sessionId: "s1",
        reason: "user_stop",
        at: new Date().toISOString(),
      }).type,
    ).toBe("session.aborted");

    expect(
      SessionEventSchema.parse({
        type: "session.meta",
        sessionId: "s1",
        title: "Rename me",
        model: "mock-hfq",
        at: new Date().toISOString(),
      }).type,
    ).toBe("session.meta");
  });
});
