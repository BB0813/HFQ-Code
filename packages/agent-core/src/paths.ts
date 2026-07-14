import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Product data root (%APPDATA%/HFQ-Code on Windows).
 * Override with HFQ_DATA_DIR for eval / unit tests so they never touch the user's real store.
 */
export function hfqDataDir(): string {
  const override = process.env.HFQ_DATA_DIR?.trim();
  if (override) return path.resolve(override);

  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "HFQ-Code");
  }
  return path.join(os.homedir(), ".config", "hfq-code");
}

export async function ensureDataDirs(): Promise<{
  root: string;
  sessions: string;
  skills: string;
  logs: string;
  memory: string;
}> {
  const root = hfqDataDir();
  const sessions = path.join(root, "sessions");
  const skills = path.join(root, "skills");
  const logs = path.join(root, "logs");
  const memory = path.join(root, "memory");
  await fs.mkdir(sessions, { recursive: true });
  await fs.mkdir(skills, { recursive: true });
  await fs.mkdir(logs, { recursive: true });
  await fs.mkdir(memory, { recursive: true });
  return { root, sessions, skills, logs, memory };
}
