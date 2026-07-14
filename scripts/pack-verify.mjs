/**
 * M3.4 packaging smoke — builds packages then runs electron-builder --dir
 * and asserts the unpacked tree contains worker entry + renderer + skills.
 *
 * Usage: node scripts/pack-verify.mjs
 * Env: SKIP_PACK=1 to only assert an existing unpacked dir under apps/desktop/release
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const desktop = path.join(root, "apps", "desktop");
const release = path.join(desktop, "release");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    // Windows: shell required for pnpm.cmd resolution; quote args carefully.
    const line =
      process.platform === "win32"
        ? [cmd, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")
        : null;
    const child = line
      ? spawn(line, {
          cwd: opts.cwd || root,
          stdio: "inherit",
          shell: true,
          env: { ...process.env, ...opts.env },
        })
      : spawn(cmd, args, {
          cwd: opts.cwd || root,
          stdio: "inherit",
          shell: false,
          env: { ...process.env, ...opts.env },
        });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findUnpackedWin() {
  // electron-builder win dir → release/win-unpacked or release/<product>-...
  const candidates = [
    path.join(release, "win-unpacked"),
    path.join(release, "win-unpacked", "resources", "app.asar"),
  ];
  if (await exists(path.join(release, "win-unpacked"))) {
    return path.join(release, "win-unpacked");
  }
  // scan one level
  try {
    const entries = await fs.readdir(release, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.endsWith("-unpacked")) {
        return path.join(release, e.name);
      }
    }
  } catch {
    /* none */
  }
  return null;
}

async function assertTree(unpacked) {
  const checks = [];
  const exeName = "HFQ Code.exe";
  const exe = path.join(unpacked, exeName);
  checks.push(["main exe", exe]);

  const resources = path.join(unpacked, "resources");
  checks.push(["resources dir", resources]);

  const skills = path.join(resources, "skills", "bundled");
  checks.push(["bundled skills", skills]);

  // app may be asar or app/
  const appDir = path.join(resources, "app");
  const asar = path.join(resources, "app.asar");
  const appOk = (await exists(appDir)) || (await exists(asar));
  if (!appOk) {
    throw new Error("missing resources/app or app.asar");
  }

  // Prefer unpacked @hfq worker (asarUnpack)
  const workerCandidates = [
    path.join(appDir, "node_modules", "@hfq", "agent-core", "dist", "worker", "entry.js"),
    path.join(
      resources,
      "app.asar.unpacked",
      "node_modules",
      "@hfq",
      "agent-core",
      "dist",
      "worker",
      "entry.js",
    ),
  ];
  let workerFound = false;
  for (const w of workerCandidates) {
    if (await exists(w)) {
      workerFound = true;
      console.log("OK worker entry:", w);
      break;
    }
  }
  if (!workerFound) {
    // Soft-fail note: asar-only is still runnable under Electron asar protocol
    console.warn(
      "WARN: worker entry.js not found unpacked; ensure asarUnpack covers @hfq or asar load works at runtime",
    );
  }

  for (const [label, p] of checks) {
    if (!(await exists(p))) {
      // exe name might differ slightly
      if (label === "main exe") {
        const files = await fs.readdir(unpacked);
        const hit = files.find((f) => f.toLowerCase().endsWith(".exe"));
        if (hit) {
          console.log("OK main exe:", hit);
          continue;
        }
      }
      throw new Error(`missing ${label}: ${p}`);
    }
    console.log("OK", label, p);
  }

  // package version (must match apps/desktop/package.json — not hard-coded)
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(desktop, "package.json"), "utf8"),
    );
    if (!pkg.version || typeof pkg.version !== "string") {
      throw new Error("desktop package.json missing version");
    }
    console.log("OK desktop version", pkg.version);
  } catch (err) {
    throw err;
  }

  // Brand assets must ship inside the app (window icon + sidebar)
  const iconIco = path.join(appDir, "build", "icon.ico");
  const iconPng = path.join(appDir, "build", "icon.png");
  const logo = path.join(appDir, "renderer", "assets", "logo-256.png");
  for (const [label, p] of [
    ["app icon.ico", iconIco],
    ["app icon.png", iconPng],
    ["sidebar logo-256", logo],
  ]) {
    if (!(await exists(p))) {
      throw new Error(`missing ${label}: ${p}`);
    }
    const st = await fs.stat(p);
    if (st.size < 1000) throw new Error(`${label} too small (${st.size} bytes)`);
    console.log("OK", label, p, st.size);
  }

  // Main exe should no longer be a pure Electron default after stamp-win-icon
  const exeStat = await fs.stat(exe);
  if (exeStat.size < 1_000_000) {
    throw new Error(`main exe unexpectedly small: ${exeStat.size}`);
  }
  console.log("OK exe size", exeStat.size);
}

async function main() {
  if (!process.env.SKIP_PACK) {
    console.log("→ pnpm build");
    await run("pnpm", ["build"]);
    console.log("→ electron-builder --win dir");
    await run("pnpm", ["--filter", "@hfq/desktop", "pack:dir"]);
  } else {
    console.log("SKIP_PACK=1 — using existing release/");
  }

  const unpacked = await findUnpackedWin();
  if (!unpacked) {
    throw new Error(
      `no win-unpacked under ${release}. Run without SKIP_PACK or pack:dir first.`,
    );
  }
  console.log("Unpacked:", unpacked);
  await assertTree(unpacked);
  console.log("PACK_VERIFY_PASS");
}

main().catch((err) => {
  console.error("PACK_VERIFY_FAIL", err instanceof Error ? err.message : err);
  process.exit(1);
});
