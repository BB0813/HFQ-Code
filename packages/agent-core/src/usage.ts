/**
 * Aggregate usage.updated events from session JSONL files (Phase-2).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { JsonlTranscript } from "@hfq/transcript";
import type { SessionEvent } from "@hfq/shared";
import { ensureDataDirs } from "./paths.js";
import { buildSessionSnapshot } from "./history.js";

export interface SessionUsageRow {
  sessionId: string;
  title: string;
  model?: string;
  workspacePath?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  updatedAt: string;
  day: string;
}

export interface DailyUsageRow {
  day: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessions: number;
  estimatedCostUsd?: number;
}

export interface UsageSummary {
  sessions: SessionUsageRow[];
  daily: DailyUsageRow[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    sessions: number;
    estimatedCostUsd?: number;
  };
  pricing?: { inputPerMillion: number; outputPerMillion: number };
}

export interface UsagePricing {
  /** USD per 1M input tokens */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
}

function dayKey(iso: string): string {
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "unknown";
}

function estimateCost(
  input: number,
  output: number,
  pricing?: UsagePricing,
): number | undefined {
  if (!pricing) return undefined;
  return (
    (input / 1_000_000) * pricing.inputPerMillion +
    (output / 1_000_000) * pricing.outputPerMillion
  );
}

export async function aggregateUsage(opts?: {
  sessionsDir?: string;
  pricing?: UsagePricing;
  limitSessions?: number;
}): Promise<UsageSummary> {
  const dirs = opts?.sessionsDir
    ? { sessions: opts.sessionsDir }
    : await ensureDataDirs();
  const ids = await JsonlTranscript.listSessionIds(dirs.sessions);
  const limit = opts?.limitSessions ?? 200;
  const sessions: SessionUsageRow[] = [];

  for (const id of ids.slice(0, limit)) {
    const tr = await JsonlTranscript.openExisting(dirs.sessions, id);
    if (!tr) continue;
    let events: SessionEvent[];
    try {
      events = await tr.readEvents();
    } catch {
      continue;
    }
    if (!events.length) continue;
    const snap = buildSessionSnapshot(events, { id });
    const inputTokens = snap.usage.inputTokens || 0;
    const outputTokens = snap.usage.outputTokens || 0;
    if (!inputTokens && !outputTokens && !events.some((e) => e.type === "usage.updated")) {
      // still list sessions with zero usage for completeness? skip empties with no usage events
    }
    const updatedAt = snap.info.updatedAt || events[events.length - 1]?.at || "";
    const cost = estimateCost(inputTokens, outputTokens, opts?.pricing);
    sessions.push({
      sessionId: id,
      title: snap.info.title || id.slice(0, 8),
      model: snap.info.model,
      workspacePath: snap.info.workspacePath,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: cost,
      updatedAt,
      day: dayKey(updatedAt),
    });
  }

  sessions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const byDay = new Map<string, DailyUsageRow>();
  for (const s of sessions) {
    const cur = byDay.get(s.day) ?? {
      day: s.day,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      sessions: 0,
      estimatedCostUsd: opts?.pricing ? 0 : undefined,
    };
    cur.inputTokens += s.inputTokens;
    cur.outputTokens += s.outputTokens;
    cur.totalTokens += s.totalTokens;
    cur.sessions += 1;
    if (opts?.pricing) {
      cur.estimatedCostUsd = (cur.estimatedCostUsd || 0) + (s.estimatedCostUsd || 0);
    }
    byDay.set(s.day, cur);
  }

  const daily = [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  const totals = {
    inputTokens: sessions.reduce((a, s) => a + s.inputTokens, 0),
    outputTokens: sessions.reduce((a, s) => a + s.outputTokens, 0),
    totalTokens: 0,
    sessions: sessions.length,
    estimatedCostUsd: opts?.pricing
      ? sessions.reduce((a, s) => a + (s.estimatedCostUsd || 0), 0)
      : undefined,
  };
  totals.totalTokens = totals.inputTokens + totals.outputTokens;

  return {
    sessions,
    daily,
    totals,
    pricing: opts?.pricing,
  };
}

export async function exportUsageJson(summary: UsageSummary, outPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}
