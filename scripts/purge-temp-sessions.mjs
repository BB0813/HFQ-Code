/**
 * One-shot cleanup: remove session transcripts whose workspace is a temp/eval dir.
 * Safe for real project workspaces. Does not touch credentials/config.
 *
 *   node scripts/purge-temp-sessions.mjs
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const markers = [
  "hfq-eval",
  "hfq-session-",
  "hfq-worker-",
  "hfq-tr-",
  "hfq-tools-",
  "hfq-mem-",
  "hfq-cfg-",
  "hfq-smoke",
  "hfq-vitest",
  "hfq-eval-data",
];

function sessionsDir() {
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "HFQ-Code", "sessions");
  }
  return path.join(os.homedir(), ".config", "hfq-code", "sessions");
}

function isTempWorkspace(ws) {
  if (!ws) return false;
  const norm = String(ws).replace(/\//g, "\\").toLowerCase();
  if (markers.some((m) => norm.includes(m.toLowerCase()))) return true;
  if (norm.includes("\\appdata\\local\\temp\\")) return true;
  if (norm.includes("\\tmp\\") && norm.includes("hfq-")) return true;
  return false;
}

async function main() {
  const dir = sessionsDir();
  let entries = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    console.log("no sessions dir:", dir);
    return;
  }

  let removed = 0;
  let kept = 0;
  for (const name of entries) {
    if (!name.endsWith(".jsonl")) continue;
    const full = path.join(dir, name);
    let ws = "";
    try {
      const raw = await fs.readFile(full, "utf8");
      const first = raw.split(/\r?\n/).find((l) => l.trim());
      if (first) {
        const ev = JSON.parse(first);
        ws = ev.workspacePath || "";
      }
    } catch {
      kept += 1;
      continue;
    }
    if (isTempWorkspace(ws)) {
      await fs.unlink(full);
      removed += 1;
      console.log("REMOVED", name, "→", ws);
    } else {
      kept += 1;
      console.log("KEEP", name, "→", ws || "(no workspace)");
    }
  }

  // Clean leftover hfq-* dirs under OS temp
  const tmp = os.tmpdir();
  let tempCleaned = 0;
  try {
    for (const name of await fs.readdir(tmp)) {
      if (!name.startsWith("hfq-")) continue;
      const full = path.join(tmp, name);
      await fs.rm(full, { recursive: true, force: true }).catch(() => undefined);
      tempCleaned += 1;
    }
  } catch {
    /* ignore */
  }

  console.log(`\nDone. removed=${removed} kept=${kept} tempDirsCleaned=${tempCleaned}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
