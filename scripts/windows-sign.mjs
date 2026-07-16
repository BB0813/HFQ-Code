/**
 * Authenticode signing for HFQ Code (HFQ-ClodBreeze self-signed cert).
 *
 * Uses local sign project (default Z:\Win软件签名) — never embeds PFX in the repo.
 *
 * Env:
 *   HFQ_SIGN_ROOT  — sign project root (default Z:\Win软件签名)
 *   HFQ_SIGN_SKIP  — set to "1" to skip signing (local debug only; prints warning)
 *   HFQ_SIGN_DIST  — trust pack source (default %HFQ_SIGN_ROOT%\dist)
 *
 * electron-builder hooks:
 *   afterPack            → scripts/after-pack.mjs (resedit then this)
 *   afterAllArtifactBuild → signArtifactPaths()
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveSignRoot() {
  const fromEnv = process.env.HFQ_SIGN_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return "Z:\\Win软件签名";
}

export function resolveSignDist() {
  const fromEnv = process.env.HFQ_SIGN_DIST?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(resolveSignRoot(), "dist");
}

export function isSignSkipped() {
  return process.env.HFQ_SIGN_SKIP === "1" || process.env.HFQ_SIGN_SKIP === "true";
}

/**
 * @param {string} filePath absolute path to .exe
 * @param {{ description?: string }} [opts]
 */
export function signFile(filePath, opts = {}) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`[windows-sign] file not found: ${abs}`);
  }
  if (isSignSkipped()) {
    console.warn(`[windows-sign] HFQ_SIGN_SKIP=1 — NOT signing ${abs}`);
    return { skipped: true, file: abs };
  }

  const root = resolveSignRoot();
  const pfx = path.join(root, "output", "root.pfx");
  const pwdFile = path.join(root, "output", "pfx.password");
  // Prefer adjacent tools\signtool.exe; fall back to PATH / Windows SDK discovery
  let tool = path.join(root, "tools", "signtool.exe");
  const description = opts.description || "HFQ Code";

  if (!fs.existsSync(root)) {
    throw new Error(
      `[windows-sign] HFQ_SIGN_ROOT missing: ${root}\n` +
        `  Set HFQ_SIGN_ROOT to the sign project, or HFQ_SIGN_SKIP=1 for unsigned local packs.`,
    );
  }

  // Direct signtool via spawnSync (array args) — avoids Start-Process space-split bugs
  // in some sign.ps1 variants when /d "HFQ Code" is used.
  if (!fs.existsSync(pfx)) throw new Error(`[windows-sign] PFX not found: ${pfx}`);
  if (!fs.existsSync(pwdFile)) throw new Error(`[windows-sign] password file missing: ${pwdFile}`);
  if (!fs.existsSync(tool)) {
    const which = spawnSync("where.exe", ["signtool.exe"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const line = (which.stdout || "").split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (line && fs.existsSync(line)) {
      tool = line;
    } else {
      throw new Error(`[windows-sign] signtool not found: ${tool}`);
    }
  }

  const password = fs.readFileSync(pwdFile, "utf8").trim();
  const trySign = (withTimestamp) => {
    /** @type {string[]} */
    const args = ["sign", "/f", pfx, "/p", password, "/fd", "SHA256", "/d", description];
    if (withTimestamp) {
      args.push("/tr", "http://timestamp.digicert.com", "/td", "SHA256");
    }
    args.push("/v", abs);
    console.log(`[windows-sign] signtool sign ${withTimestamp ? "+timestamp " : ""}${abs}`);
    return spawnSync(tool, args, { stdio: "inherit", windowsHide: true });
  };

  let r = trySign(true);
  if (r.status !== 0) {
    console.warn("[windows-sign] timestamp failed, retry without timestamp…");
    r = trySign(false);
  }
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`[windows-sign] signtool failed (${r.status}) for ${abs}`);
  }

  const v = spawnSync(tool, ["verify", "/pa", "/v", abs], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (v.status !== 0) {
    console.warn(
      "[windows-sign] verify /pa failed (root may not be trusted on this machine) — signature may still be present",
    );
  }
  return { skipped: false, file: abs, via: "signtool", tool };
}

/**
 * Sign main product exe inside win-unpacked (after resedit).
 * @param {string} appOutDir
 * @param {string} [productName]
 */
export function signUnpackedMainExe(appOutDir, productName = "HFQ Code") {
  const exePath = path.join(appOutDir, `${productName}.exe`);
  if (!fs.existsSync(exePath)) {
    // electron-builder sometimes uses productFilename without space variants
    const candidates = fs
      .readdirSync(appOutDir)
      .filter((n) => n.toLowerCase().endsWith(".exe") && !n.toLowerCase().includes("uninstall"));
    if (candidates.length === 0) {
      throw new Error(`[windows-sign] no main exe in ${appOutDir}`);
    }
    // Prefer product name match
    const prefer =
      candidates.find((n) => n.replace(/\.exe$/i, "") === productName) ||
      candidates.find((n) => /hfq/i.test(n)) ||
      candidates[0];
    return signFile(path.join(appOutDir, prefer), { description: "HFQ Code" });
  }
  return signFile(exePath, { description: "HFQ Code" });
}

/**
 * electron-builder afterAllArtifactBuild(buildResult)
 * @param {{ artifactPaths?: string[] } | string[]} buildResult
 */
export function signArtifactPaths(buildResult) {
  const paths = Array.isArray(buildResult)
    ? buildResult
    : Array.isArray(buildResult?.artifactPaths)
      ? buildResult.artifactPaths
      : [];
  const exes = paths.filter((p) => typeof p === "string" && /\.exe$/i.test(p));
  if (exes.length === 0) {
    console.warn("[windows-sign] afterAllArtifactBuild: no .exe artifacts");
    return [];
  }
  const results = [];
  for (const file of exes) {
    // Skip already-handled intermediate if any; sign all final .exe (NSIS + portable)
    results.push(signFile(file, { description: "HFQ Code" }));
  }
  return results;
}

/** Default export for electron-builder afterAllArtifactBuild hook path */
export default async function afterAllArtifactBuild(buildResult) {
  console.log("[windows-sign] afterAllArtifactBuild…");
  signArtifactPaths(buildResult);
  console.log("[windows-sign] afterAllArtifactBuild done");
  return buildResult?.artifactPaths ?? [];
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node scripts/windows-sign.mjs <path-to-exe>");
    process.exit(2);
  }
  try {
    const r = signFile(path.resolve(target), { description: "HFQ Code" });
    console.log("OK", r);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
