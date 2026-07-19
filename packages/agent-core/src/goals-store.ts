import fs from "node:fs/promises";
import path from "node:path";
import type { SessionEvent } from "@hfq/shared";
import type { UiTask } from "./history.js";
import { ensureDataDirs } from "./paths.js";

const GOALS_CAP = 100;

export interface StoredGoal {
  taskId: string;
  title: string;
  status: string;
  kind?: "goal" | "tool" | "subagent";
  objective?: string;
  progress?: number;
  budget?: { maxRounds?: number; maxToolCalls?: number };
  parentTaskId?: string | null;
  blockedReason?: string | null;
  acceptance?: string | null;
  detail?: string;
  updatedAt: string;
}

function safeSessionSegment(sessionId: string): string {
  return String(sessionId).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function goalsSidecarPath(sessionsDir: string, sessionId: string): string {
  return path.join(sessionsDir, `${safeSessionSegment(sessionId)}.goals.json`);
}

export function isGoalTaskEvent(
  event: Extract<SessionEvent, { type: "task.updated" }>,
): boolean {
  if (event.kind === "goal") return true;
  return String(event.title || "")
    .trim()
    .toLowerCase()
    .startsWith("goal:");
}

export function eventToStoredGoal(
  event: Extract<SessionEvent, { type: "task.updated" }>,
): StoredGoal {
  return {
    taskId: event.taskId,
    title: event.title,
    status: event.status,
    kind: event.kind ?? "goal",
    objective: event.objective,
    progress: event.progress,
    budget: event.budget,
    parentTaskId: event.parentTaskId ?? null,
    blockedReason: event.blockedReason ?? null,
    acceptance: event.acceptance ?? null,
    detail: event.detail,
    updatedAt: event.at || new Date().toISOString(),
  };
}

export function storedGoalToUiTask(g: StoredGoal): UiTask {
  return {
    taskId: g.taskId,
    title: g.title,
    status: g.status,
    detail: g.detail,
    at: g.updatedAt,
    kind: g.kind === "tool" || g.kind === "subagent" || g.kind === "goal" ? g.kind : "goal",
    objective: g.objective,
    progress: g.progress,
    budget: g.budget,
    parentTaskId: g.parentTaskId ?? undefined,
    blockedReason: g.blockedReason ?? undefined,
    acceptance: g.acceptance ?? undefined,
  };
}

export async function loadGoalsFromDisk(sessionId: string): Promise<StoredGoal[]> {
  const id = String(sessionId || "").trim();
  if (!id) return [];
  try {
    const dirs = await ensureDataDirs();
    const file = goalsSidecarPath(dirs.sessions, id);
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { goals?: unknown })?.goals)
        ? (parsed as { goals: unknown[] }).goals
        : [];
    const cleaned: StoredGoal[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const g = item as Record<string, unknown>;
      const taskId = String(g.taskId ?? "").trim();
      if (!taskId) continue;
      cleaned.push({
        taskId,
        title: String(g.title ?? taskId),
        status: String(g.status ?? "pending"),
        kind:
          g.kind === "tool" || g.kind === "subagent" || g.kind === "goal"
            ? g.kind
            : "goal",
        objective: g.objective != null ? String(g.objective) : undefined,
        progress:
          typeof g.progress === "number" && Number.isFinite(g.progress)
            ? Math.max(0, Math.min(100, g.progress))
            : undefined,
        budget:
          g.budget && typeof g.budget === "object"
            ? (g.budget as StoredGoal["budget"])
            : undefined,
        parentTaskId:
          g.parentTaskId == null || g.parentTaskId === ""
            ? null
            : String(g.parentTaskId),
        blockedReason:
          g.blockedReason == null ? null : String(g.blockedReason),
        acceptance: g.acceptance == null ? null : String(g.acceptance),
        detail: g.detail != null ? String(g.detail) : undefined,
        updatedAt: String(g.updatedAt ?? g.at ?? new Date().toISOString()),
      });
    }
    return cleaned.slice(-GOALS_CAP);
  } catch {
    return [];
  }
}

export async function persistGoalsToDisk(
  sessionId: string,
  goals: StoredGoal[],
): Promise<void> {
  const id = String(sessionId || "").trim();
  if (!id) return;
  try {
    const dirs = await ensureDataDirs();
    const file = goalsSidecarPath(dirs.sessions, id);
    const capped = goals.slice(-GOALS_CAP);
    await fs.writeFile(
      file,
      `${JSON.stringify({ version: 1, sessionId: id, goals: capped })}\n`,
      "utf8",
    );
  } catch {
    /* best-effort */
  }
}

export async function upsertGoalFromEvent(
  event: Extract<SessionEvent, { type: "task.updated" }>,
): Promise<void> {
  if (!isGoalTaskEvent(event)) return;
  const sessionId = String(event.sessionId || "").trim();
  if (!sessionId) return;
  const next = eventToStoredGoal(event);
  const list = await loadGoalsFromDisk(sessionId);
  const idx = list.findIndex((g) => g.taskId === next.taskId);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  if (list.length > GOALS_CAP) list.splice(0, list.length - GOALS_CAP);
  await persistGoalsToDisk(sessionId, list);
}

export async function deleteGoalsSidecar(sessionId: string): Promise<void> {
  const id = String(sessionId || "").trim();
  if (!id) return;
  try {
    const dirs = await ensureDataDirs();
    await fs.unlink(goalsSidecarPath(dirs.sessions, id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      /* ignore */
    }
  }
}

function taskTime(t: { at?: string; updatedAt?: string }): number {
  const s = t.updatedAt || t.at || "";
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : 0;
}

/** Merge history tasks with disk goals; same taskId keeps the newer updatedAt/at. */
export function mergeTasksWithGoals(historyTasks: UiTask[], goals: StoredGoal[]): UiTask[] {
  const byId = new Map<string, UiTask>();
  for (const t of historyTasks) {
    if (!t?.taskId) continue;
    byId.set(t.taskId, t);
  }
  for (const g of goals) {
    const ui = storedGoalToUiTask(g);
    const prev = byId.get(g.taskId);
    if (!prev || taskTime(ui) >= taskTime(prev)) {
      byId.set(g.taskId, prev ? { ...prev, ...ui, at: ui.at || prev.at } : ui);
    }
  }
  return [...byId.values()].sort((a, b) => (taskTime(a) < taskTime(b) ? 1 : -1));
}
