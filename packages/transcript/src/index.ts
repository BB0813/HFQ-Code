import fs from "node:fs/promises";
import path from "node:path";
import type { SessionEvent } from "@hfq/shared";

export class JsonlTranscript {
  constructor(private readonly filePath: string) {}

  static pathFor(sessionsDir: string, sessionId: string): string {
    return path.join(sessionsDir, `${sessionId}.jsonl`);
  }

  static async create(sessionsDir: string, sessionId: string): Promise<JsonlTranscript> {
    await fs.mkdir(sessionsDir, { recursive: true });
    const filePath = JsonlTranscript.pathFor(sessionsDir, sessionId);
    await fs.writeFile(filePath, "", { flag: "a" });
    return new JsonlTranscript(filePath);
  }

  static async openExisting(
    sessionsDir: string,
    sessionId: string,
  ): Promise<JsonlTranscript | null> {
    const filePath = JsonlTranscript.pathFor(sessionsDir, sessionId);
    try {
      await fs.access(filePath);
      return new JsonlTranscript(filePath);
    } catch {
      return null;
    }
  }

  static async listSessionIds(sessionsDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
        .map((e) => e.name.replace(/\.jsonl$/i, ""))
        .sort();
    } catch {
      return [];
    }
  }

  /** Delete a session transcript file if present. Returns whether a file was removed. */
  static async delete(sessionsDir: string, sessionId: string): Promise<boolean> {
    const filePath = JsonlTranscript.pathFor(sessionsDir, sessionId);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
  }

  async append(event: SessionEvent | Record<string, unknown>): Promise<void> {
    await fs.appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  async readAll(): Promise<unknown[]> {
    const raw = await fs.readFile(this.filePath, "utf8");
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as unknown);
  }

  async readEvents(): Promise<SessionEvent[]> {
    const all = await this.readAll();
    return all.filter(
      (e): e is SessionEvent =>
        Boolean(e) && typeof e === "object" && typeof (e as { type?: unknown }).type === "string",
    ) as SessionEvent[];
  }

  get path(): string {
    return this.filePath;
  }
}
