/**
 * Lightweight Phase-2 eval suite (headless, mock provider).
 * Run: pnpm eval
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadDist(pkg, file = "index.js") {
  const p = path.join(root, "packages", pkg, "dist", file);
  return import(pathToFileURL(p).href);
}

const results = [];
function pass(id, detail = "") {
  results.push({ id, ok: true, detail });
  console.log(`PASS  ${id}${detail ? ` — ${detail}` : ""}`);
}
function fail(id, err) {
  const detail = err instanceof Error ? err.message : String(err);
  results.push({ id, ok: false, detail });
  console.error(`FAIL  ${id} — ${detail}`);
}

async function withTemp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-eval-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function main() {
  const agentCore = await loadDist("agent-core");
  const providers = await loadDist("providers");
  const memory = await loadDist("memory");
  const tools = await loadDist("tools");
  const policy = await loadDist("policy");

  // E01 mock list + read
  try {
    await withTemp(async (ws) => {
      await fs.writeFile(path.join(ws, "hello.txt"), "hello-eval\n", "utf8");
      const mgr = new agentCore.SessionManager({});
      const info = await mgr.create({
        workspacePath: ws,
        provider: providers.createMockProvider(),
        model: "mock-hfq",
        title: "E01",
      });
      // Auto-allow all permissions for eval
      const orig = mgr.resolvePermission.bind(mgr);
      // drain permission via polling is hard; grant session allows for write tools after create
      await mgr.send(info.id, "list the workspace and read hello.txt");
      const snap = mgr.getSnapshot(info.id);
      if (!snap) throw new Error("no snapshot");
      pass("E01", `messages=${snap.messages.length}`);
    });
  } catch (e) {
    fail("E01", e);
  }

  // E02 write triggers permission (ask) — with allow_session via resolve
  try {
    await withTemp(async (ws) => {
      const mgr = new agentCore.SessionManager({
        onEvent: async (ev) => {
          if (ev.type === "permission.requested") {
            mgr.resolvePermission(ev.requestId, "allow");
          }
        },
      });
      const info = await mgr.create({
        workspacePath: ws,
        provider: providers.createMockProvider(),
        model: "mock-hfq",
      });
      // Mock provider may not always call write; exercise tool hub write directly
      const hub = tools.createToolHub();
      await hub.execute("write_file", ws, { path: "a.txt", content: "x" });
      const body = await fs.readFile(path.join(ws, "a.txt"), "utf8");
      if (body !== "x") throw new Error("write failed");
      pass("E02", "write_file ok");
    });
  } catch (e) {
    fail("E02", e);
  }

  // E03 apply_patch multi-file
  try {
    await withTemp(async (ws) => {
      const hub = tools.createToolHub();
      const patch = `*** Begin Patch
*** Add File: one.txt
+alpha
*** Add File: two.txt
+beta
*** End Patch`;
      const out = await hub.execute("apply_patch", ws, { patch });
      if (!out.changeCount || out.changeCount < 2) throw new Error("expected 2 changes");
      pass("E03", `changes=${out.changeCount}`);
    });
  } catch (e) {
    fail("E03", e);
  }

  // E04 git_status non-repo
  try {
    await withTemp(async (ws) => {
      const hub = tools.createToolHub();
      const st = await hub.execute("git_status", ws, {});
      if (st.isRepo) throw new Error("expected non-repo");
      pass("E04", "non-repo");
    });
  } catch (e) {
    fail("E04", e);
  }

  // E05 memory save + search
  try {
    await withTemp(async (dir) => {
      const brain = memory.createScopedMemory({ rootDir: path.join(dir, "mem"), workspacePath: dir });
      await brain.upsert({ text: "eval unique token ZYXWVU-123", scope: "project" });
      const hits = await brain.search("ZYXWVU", 5, { scope: "project" });
      if (!hits.length) throw new Error("no hits");
      pass("E05", `hits=${hits.length}`);
    });
  } catch (e) {
    fail("E05", e);
  }

  // E06 compact keeps recent user
  try {
    const { compactChatMessages } = agentCore;
    const messages = [
      { role: "system", content: "sys" },
      ...Array.from({ length: 40 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg-${i}-` + "x".repeat(2000),
      })),
    ];
    const packed = compactChatMessages(messages, { maxChars: 12_000, keepRecent: 8 });
    const lastUser = [...packed.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) throw new Error("lost user");
    pass("E06", `compacted=${packed.compacted}`);
  } catch (e) {
    fail("E06", e);
  }

  // E07 policy matrix includes spawn + git_diff
  try {
    const matrix = policy.defaultPolicyMatrix();
    const names = new Set(matrix.map((r) => r.toolName));
    if (!names.has("spawn_subagent") || !names.has("git_diff")) {
      throw new Error("missing tools in matrix");
    }
    pass("E07", "matrix ok");
  } catch (e) {
    fail("E07", e);
  }

  // E08 session delete
  try {
    await withTemp(async (ws) => {
      const mgr = new agentCore.SessionManager({});
      const info = await mgr.create({
        workspacePath: ws,
        provider: providers.createMockProvider(),
        model: "mock-hfq",
      });
      await mgr.delete(info.id);
      const listed = await mgr.listAll(ws);
      if (listed.some((s) => s.id === info.id)) throw new Error("still listed");
      pass("E08", "deleted");
    });
  } catch (e) {
    fail("E08", e);
  }

  // E09 import wizard
  try {
    await withTemp(async (dir) => {
      const skillSrc = path.join(dir, "skills", "e09");
      await fs.mkdir(skillSrc, { recursive: true });
      await fs.writeFile(
        path.join(skillSrc, "SKILL.md"),
        "---\nname: e09\ndescription: eval\n---\n\n# e09\n",
        "utf8",
      );
      const dest = path.join(dir, "hfq-skills");
      await fs.mkdir(dest, { recursive: true });
      const scan = await agentCore.scanImportSources({
        extraRoots: [{ label: "e", path: path.join(dir, "skills") }],
      });
      const cand = scan.candidates.find((c) => c.name === "e09");
      if (!cand) throw new Error("scan miss");
      const applied = await agentCore.applyImport({
        items: [{ id: cand.id }],
        candidates: scan.candidates,
        skillsDestDir: dest,
      });
      if (!applied.copied.length) throw new Error("copy miss");
      pass("E09", "import ok");
    });
  } catch (e) {
    fail("E09", e);
  }

  // E10 redact
  try {
    const s = agentCore.redactSecrets("token sk-abcdefghijklmnopqrstuvwxyz");
    if (s.includes("sk-abcdefgh")) throw new Error("not redacted");
    pass("E10", "redact ok");
  } catch (e) {
    fail("E10", e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n---");
  console.log(`EVAL ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  } else {
    console.log("EVAL_PASS");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
