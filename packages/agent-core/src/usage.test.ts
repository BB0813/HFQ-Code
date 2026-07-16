import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonlTranscript } from "@hfq/transcript";
import {
  aggregateUsage,
  exportUsageCsvBundle,
  usageDailyToCsv,
  usageSessionsToCsv,
} from "./usage.js";

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

  it("exports sessions/daily CSV with escaped fields", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-usage-csv-"));
    temps.push(dir);
    const tr = await JsonlTranscript.create(dir, "sess-csv-1");
    await tr.append({
      type: "session.started",
      sessionId: "sess-csv-1",
      workspacePath: dir,
      at: "2026-07-14T10:00:00.000Z",
    });
    await tr.append({
      type: "session.meta",
      sessionId: "sess-csv-1",
      title: 'Cost, "demo"',
      model: "mock-hfq",
      at: "2026-07-14T10:00:01.000Z",
    });
    await tr.append({
      type: "usage.updated",
      sessionId: "sess-csv-1",
      inputTokens: 10,
      outputTokens: 5,
      at: "2026-07-14T10:00:02.000Z",
    });

    const summary = await aggregateUsage({ sessionsDir: dir });
    const sessionsCsv = usageSessionsToCsv(summary);
    expect(sessionsCsv).toMatch(/sessionId,title,model/);
    expect(sessionsCsv).toContain('"Cost, ""demo"""');
    expect(sessionsCsv).toContain("sess-csv-1");

    const dailyCsv = usageDailyToCsv(summary);
    expect(dailyCsv).toMatch(/day,sessions,inputTokens/);
    expect(dailyCsv).toContain("2026-07-14");

    const out = path.join(dir, "export");
    const result = await exportUsageCsvBundle(summary, out);
    expect(result.files).toEqual([
      "usage-sessions.csv",
      "usage-daily.csv",
      "usage-summary.json",
    ]);
    for (const f of result.files) {
      const st = await fs.stat(path.join(result.dir, f));
      expect(st.isFile()).toBe(true);
    }
  });
});
