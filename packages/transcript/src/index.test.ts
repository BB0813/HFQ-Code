import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonlTranscript } from "./index.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("JsonlTranscript", () => {
  it("appends and reads events", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-tr-"));
    temps.push(dir);
    const tr = await JsonlTranscript.create(dir, "sess-1");
    await tr.append({ type: "session.started", sessionId: "sess-1", workspacePath: "/w", at: "t0" });
    await tr.append({ type: "ping", n: 1 });
    const all = await tr.readAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ type: "session.started" });
  });

  it("lists and reopens session files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-tr-"));
    temps.push(dir);
    await JsonlTranscript.create(dir, "a");
    await JsonlTranscript.create(dir, "b");
    const ids = await JsonlTranscript.listSessionIds(dir);
    expect(ids).toEqual(expect.arrayContaining(["a", "b"]));
    const opened = await JsonlTranscript.openExisting(dir, "a");
    expect(opened).not.toBeNull();
    expect(await JsonlTranscript.openExisting(dir, "missing")).toBeNull();
  });

  it("deletes session files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-tr-"));
    temps.push(dir);
    await JsonlTranscript.create(dir, "to-drop");
    expect(await JsonlTranscript.delete(dir, "to-drop")).toBe(true);
    expect(await JsonlTranscript.openExisting(dir, "to-drop")).toBeNull();
    expect(await JsonlTranscript.delete(dir, "to-drop")).toBe(false);
  });
});
