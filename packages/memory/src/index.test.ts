import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFileMemory,
  createScopedMemory,
  formatMemoryForPrompt,
  projectScopeKey,
} from "./index.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("file memory", () => {
  it("upserts and searches notes", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-mem-"));
    temps.push(dir);
    const mem = createFileMemory({ dir });
    const id = await mem.upsert({
      text: "HFQ Code uses workspace-scoped tools and JSONL transcripts.",
      source: "user",
    });
    expect(id).toBeTruthy();

    const hits = await mem.search("JSONL workspace");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.text).toMatch(/JSONL/);

    const listed = await mem.list();
    expect(listed.some((d) => d.id === id)).toBe(true);

    const prompt = formatMemoryForPrompt(hits);
    expect(prompt).toMatch(/Memory notes/);

    expect(await mem.remove(id)).toBe(true);
    expect(await mem.search("JSONL")).toHaveLength(0);
  });
});

describe("scoped memory", () => {
  it("isolates user vs project scopes", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-mem-scope-"));
    temps.push(root);
    const wsA = path.join(root, "ws-a");
    const wsB = path.join(root, "ws-b");
    await fs.mkdir(wsA);
    await fs.mkdir(wsB);

    const memA = createScopedMemory({ rootDir: root, workspacePath: wsA });
    await memA.upsert({ text: "project A secret token ALPHA", scope: "project", source: "test" });
    await memA.upsert({ text: "user prefers TypeScript ESM", scope: "user", source: "test" });

    const memB = createScopedMemory({ rootDir: root, workspacePath: wsB });
    const projectHits = await memB.search("ALPHA", 5, { scope: "project" });
    expect(projectHits).toHaveLength(0);

    const userHits = await memB.search("TypeScript ESM", 5, { scope: "user" });
    expect(userHits.length).toBeGreaterThan(0);
    expect(userHits[0]?.text).toMatch(/TypeScript/);

    expect(projectScopeKey(wsA)).not.toBe(projectScopeKey(wsB));
  });

  it("migrates legacy notes.json into user scope", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-mem-mig-"));
    temps.push(root);
    await fs.writeFile(
      path.join(root, "notes.json"),
      JSON.stringify({
        version: 1,
        docs: [
          {
            id: "legacy1",
            text: "legacy note about HFQ JSONL recovery",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );
    const mem = createScopedMemory({ rootDir: root });
    const hits = await mem.search("JSONL recovery", 5, { scope: "user" });
    expect(hits.some((h) => h.id === "legacy1")).toBe(true);
  });
});
