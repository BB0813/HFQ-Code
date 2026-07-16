/**
 * Build a diagnostic folder dump (JSON) for support.
 * Never includes credentials.json contents or raw API keys.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ensureDataDirs, hfqDataDir } from "./paths.js";
import {
  redactEnvSnapshot,
  redactJsonValue,
  redactSecrets,
} from "./redact.js";

export async function buildDiagnosticsBundle(opts?: {
  config?: unknown;
  appVersion?: string;
  workspacePath?: string | null;
  maxSessionMeta?: number;
  /** worker | local | null — process model for support. */
  sessionBackend?: string | null;
  /** Absolute path to credentials.json if known (only presence is recorded). */
  credentialsPath?: string | null;
}): Promise<{ dir: string; files: string[] }> {
  const dirs = await ensureDataDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(dirs.logs, `diagnostics-${stamp}`);
  await fs.mkdir(outDir, { recursive: true });
  const files: string[] = [];

  const credPath =
    opts?.credentialsPath || path.join(hfqDataDir(), "credentials.json");
  let credentialsPresent = false;
  try {
    await fs.access(credPath);
    credentialsPresent = true;
  } catch {
    credentialsPresent = false;
  }

  const meta = {
    at: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    // Redact homedir path slightly? Keep for support pathing; no secrets.
    homedir: os.homedir(),
    dataDir: hfqDataDir(),
    appVersion: opts?.appVersion ?? "unknown",
    workspacePath: opts?.workspacePath ?? null,
    sessionBackend: opts?.sessionBackend ?? null,
    credentials: {
      path: credPath,
      present: credentialsPresent,
      note: "credentials.json is never exported; only presence is recorded",
    },
    redaction: {
      version: 2,
      policy:
        "config redacted via redactJsonValue; logs via redactSecrets; env allowlist; no credentials body",
    },
  };
  await fs.writeFile(path.join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  files.push("meta.json");

  if (opts?.config) {
    const safe = redactJsonValue(opts.config);
    await fs.writeFile(
      path.join(outDir, "config.redacted.json"),
      `${JSON.stringify(safe, null, 2)}\n`,
    );
    files.push("config.redacted.json");
  }

  // Explicitly do NOT copy credentials.json — write a sentinel only.
  await fs.writeFile(
    path.join(outDir, "credentials.OMITTED.txt"),
    [
      "HFQ Code diagnostics never include credentials.json contents.",
      `present=${credentialsPresent}`,
      `path=${credPath}`,
      "",
    ].join("\n"),
  );
  files.push("credentials.OMITTED.txt");

  // Safe env snapshot
  try {
    const envSafe = redactEnvSnapshot(process.env);
    await fs.writeFile(
      path.join(outDir, "env.redacted.json"),
      `${JSON.stringify(envSafe, null, 2)}\n`,
    );
    files.push("env.redacted.json");
  } catch {
    /* ignore */
  }

  // Session index (no full transcripts — support can ask for a specific id)
  try {
    const ids = await fs.readdir(dirs.sessions);
    const jsonl = ids.filter((f) => f.endsWith(".jsonl")).slice(0, opts?.maxSessionMeta ?? 40);
    const index = [];
    for (const f of jsonl) {
      const full = path.join(dirs.sessions, f);
      const st = await fs.stat(full);
      index.push({ file: f, bytes: st.size, mtime: st.mtime.toISOString() });
    }
    await fs.writeFile(
      path.join(outDir, "sessions-index.json"),
      `${JSON.stringify(index, null, 2)}\n`,
    );
    files.push("sessions-index.json");
  } catch {
    /* ignore */
  }

  // Optional: redacted tail of the most recent transcript (events only, capped)
  try {
    const ids = await fs.readdir(dirs.sessions);
    const jsonl = ids.filter((f) => f.endsWith(".jsonl"));
    if (jsonl.length) {
      const withStat = await Promise.all(
        jsonl.map(async (f) => {
          const full = path.join(dirs.sessions, f);
          const st = await fs.stat(full);
          return { f, full, mtime: st.mtimeMs };
        }),
      );
      withStat.sort((a, b) => b.mtime - a.mtime);
      const newest = withStat[0];
      if (newest) {
        const raw = await fs.readFile(newest.full, "utf8");
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const tailLines = lines.slice(-80);
        const redacted: unknown[] = [];
        for (const line of tailLines) {
          try {
            redacted.push(redactJsonValue(JSON.parse(line)));
          } catch {
            redacted.push({ _raw: redactSecrets(line.slice(0, 2_000)) });
          }
        }
        await fs.writeFile(
          path.join(outDir, "session-sample.redacted.json"),
          `${JSON.stringify({ file: newest.f, events: redacted }, null, 2)}\n`,
        );
        files.push("session-sample.redacted.json");
      }
    }
  } catch {
    /* ignore */
  }

  // Tail of recent log files if any
  try {
    const logFiles = (await fs.readdir(dirs.logs))
      .filter((f) => f.endsWith(".log"))
      .slice(0, 5);
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

  await fs.writeFile(
    path.join(outDir, "README.txt"),
    [
      "HFQ Code diagnostics bundle",
      "",
      "Contents are redacted for support. Do not re-add secrets before sharing.",
      "- config.redacted.json: public config with keys masked",
      "- credentials.OMITTED.txt: credentials.json is never included",
      "- env.redacted.json: allowlisted env + secret key presence flags only",
      "- sessions-index.json: file sizes only",
      "- session-sample.redacted.json: last ~80 events of newest session, redacted",
      "",
    ].join("\n"),
  );
  files.push("README.txt");

  return { dir: outDir, files };
}
