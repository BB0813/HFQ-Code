import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { SessionManager } from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const pending = new Map();

const mgr = new SessionManager({
  bundledSkillsDir: path.join(root, "skills/bundled"),
  onEvent: async (e) => {
    console.log("EVENT", e.type, e.name || e.role || e.decision || e.path || e.error || "");
    if (e.type === "permission.requested") {
      // auto-allow for smoke
      const ok = mgr.resolvePermission(e.requestId, "allow");
      console.log("auto-allow", e.requestId.slice(0, 8), ok);
    }
  },
});

const info = await mgr.create({ workspacePath: root, title: "smoke" });
console.log("SESSION", info.id);

await mgr.send(info.id, "list");
await mgr.send(info.id, "read README.md");
await mgr.send(info.id, "write demo to hfq-smoke.txt");

const smokeFile = path.join(root, "hfq-smoke.txt");
const raw = await fs.readFile(smokeFile, "utf8");
console.log("SMOKE_FILE_OK", raw.includes("HFQ Code demo"));
await fs.unlink(smokeFile).catch(() => undefined);
console.log("SMOKE_PASS");
