import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonlTranscript } from "@hfq/transcript";
import { aggregateUsage } from "./usage.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("aggregateUsage", () => {
  it("sums usage.updated from JSONL", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-usage-"));
    temps.push(dir);
    const tr = await JsonlTranscript.create(dir, "sess-usage-1");
    await tr.append({
      type: "session.started",
      sessionId: "sess-usage-1",
      workspacePath: dir,
      at: "2026-07-14T10:00:00.000Z",
    });
    await tr.append({
      type: "session.meta",
      sessionId: "sess-usage-1",
      title: "Usage test",
      model: "mock-hfq",
      at: "2026-07-14T10:00:01.000Z",
    });
    await tr.append({
      type: "usage.updated",
      sessionId: "sess-usage-1",
      inputTokens: 100,
      outputTokens: 50,
      at: "2026-07-14T10:00:02.000Z",
    });
    await tr.append({
      type: "usage.updated",
      sessionId: "sess-usage-1",
      inputTokens: 20,
      outputTokens: 10,
      at: "2026-07-14T10:00:03.000Z",
    });

    const summary = await aggregateUsage({
      sessionsDir: dir,
      pricing: { inputPerMillion: 1, outputPerMillion: 2 },
    });
    expect(summary.totals.inputTokens).toBe(120);
    expect(summary.totals.outputTokens).toBe(60);
    expect(summary.sessions[0]?.title).toMatch(/Usage/);
    expect(summary.daily[0]?.day).toBe("2026-07-14");
    expect(summary.totals.estimatedCostUsd).toBeGreaterThan(0);
  });
});
