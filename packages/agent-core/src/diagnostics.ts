/**
 * Build a diagnostic zip-less folder dump (JSON) for support (Phase-2).
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ensureDataDirs, hfqDataDir } from "./paths.js";
import { redactJsonValue, redactSecrets } from "./redact.js";

export async function buildDiagnosticsBundle(opts?: {
  config?: unknown;
  appVersion?: string;
  workspacePath?: string | null;
  maxSessionMeta?: number;
  /** worker | local | null — process model for support. */
  sessionBackend?: string | null;
}): Promise<{ dir: string; files: string[] }> {
  const dirs = await ensureDataDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(dirs.logs, `diagnostics-${stamp}`);
  await fs.mkdir(outDir, { recursive: true });
  const files: string[] = [];

  const meta = {
    at: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    homedir: os.homedir(),
    dataDir: hfqDataDir(),
    appVersion: opts?.appVersion ?? "unknown",
    workspacePath: opts?.workspacePath ?? null,
    sessionBackend: opts?.sessionBackend ?? null,
  };
  await fs.writeFile(path.join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  files.push("meta.json");

  if (opts?.config) {
    const safe = redactJsonValue(opts.config);
    await fs.writeFile(path.join(outDir, "config.redacted.json"), `${JSON.stringify(safe, null, 2)}\n`);
    files.push("config.redacted.json");
  }

  // Session index (no full transcripts)
  try {
    const ids = await fs.readdir(dirs.sessions);
    const jsonl = ids.filter((f) => f.endsWith(".jsonl")).slice(0, opts?.maxSessionMeta ?? 40);
    const index = [];
    for (const f of jsonl) {
      const full = path.join(dirs.sessions, f);
      const st = await fs.stat(full);
      index.push({ file: f, bytes: st.size, mtime: st.mtime.toISOString() });
    }
    await fs.writeFile(path.join(outDir, "sessions-index.json"), `${JSON.stringify(index, null, 2)}\n`);
    files.push("sessions-index.json");
  } catch {
    /* ignore */
  }

  // Tail of recent log files if any
  try {
    const logFiles = (await fs.readdir(dirs.logs)).filter((f) => f.endsWith(".log")).slice(0, 5);
    for (const lf of logFiles) {
      const raw = await fs.readFile(path.join(dirs.logs, lf), "utf8");
      const tail = redactSecrets(raw.slice(-32_000));
      const name = `log-tail-${lf}`;
      await fs.writeFile(path.join(outDir, name), tail);
      files.push(name);
    }
  } catch {
    /* ignore */
  }

  return { dir: outDir, files };
}
