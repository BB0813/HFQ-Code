/**
 * 1.1.8 L3 — pending-install marker + detached NSIS silent spawn.
 * Pure validation lives in @hfq/shared (update-silent); this file is Electron/Node I/O.
 *
 * Final NSIS flags (electron-builder, oneClick:false, perMachine:true):
 *   installer.exe /S
 * UAC may still appear for per-machine install — expected OS boundary.
 */

const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { spawn } = require("node:child_process");

const MARKER_NAME = "pending-install.json";

/** @typedef {{ version: string, filePath: string, mode: "silent"|"ui", scheduledAt: string, sha256?: string|null, reason?: string|null, currentVersionAtSchedule?: string|null }} PendingInstallMarker */

/**
 * @param {string} updatesDir
 */
function markerPath(updatesDir) {
  return path.join(updatesDir, MARKER_NAME);
}

/**
 * @param {string} name
 */
function isPortableInstallerName(name) {
  return /portable/i.test(String(name || ""));
}

/**
 * @param {string} name
 */
function isNsisInstallerCandidate(name) {
  const n = String(name || "").toLowerCase();
  if (!n.endsWith(".exe") || n.endsWith(".blockmap")) return false;
  if (isPortableInstallerName(n)) return false;
  return true;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [execPath]
 */
function isPortableRuntime(env = process.env, execPath = process.execPath) {
  if (env.PORTABLE_EXECUTABLE_DIR || env.PORTABLE_EXECUTABLE_FILE) return true;
  const p = String(execPath || "").toLowerCase();
  return p.includes("portable");
}

/**
 * @param {string} filePath
 * @param {string} updatesRoot
 */
function assertInstallerPathInUpdatesDir(filePath, updatesRoot) {
  const resolved = path.resolve(String(filePath || "").trim());
  const root = path.resolve(String(updatesRoot || "").trim());
  if (!resolved || !root) throw new Error("安装包路径无效");
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("安装包路径不在 updates 目录内");
  }
  if (!resolved.toLowerCase().endsWith(".exe")) {
    throw new Error("安装包必须是 .exe 文件");
  }
  const base = path.basename(resolved);
  if (isPortableInstallerName(base)) {
    throw new Error("Portable 安装包不支持静默安装，请使用 NSIS 安装版或打开安装向导");
  }
  if (!isNsisInstallerCandidate(base)) {
    throw new Error("该安装包不支持静默安装");
  }
  return resolved;
}

/**
 * @param {unknown} raw
 * @returns {PendingInstallMarker | null}
 */
function parsePendingInstallMarker(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const version = String(o.version || "")
    .trim()
    .replace(/^[vV]/, "");
  const filePath = String(o.filePath || "").trim();
  if (!version || !filePath) return null;
  return {
    version,
    filePath: path.resolve(filePath),
    mode: o.mode === "ui" ? "ui" : "silent",
    scheduledAt: String(o.scheduledAt || "") || new Date(0).toISOString(),
    sha256: o.sha256 == null ? null : String(o.sha256),
    reason: o.reason == null ? null : String(o.reason),
    currentVersionAtSchedule:
      o.currentVersionAtSchedule == null ? null : String(o.currentVersionAtSchedule),
  };
}

/**
 * @param {string} updatesDir
 * @returns {Promise<PendingInstallMarker | null>}
 */
async function readPendingInstall(updatesDir) {
  const p = markerPath(updatesDir);
  try {
    const text = await fsp.readFile(p, "utf8");
    return parsePendingInstallMarker(JSON.parse(text));
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return null;
    return null;
  }
}

/**
 * @param {string} updatesDir
 * @param {PendingInstallMarker} marker
 */
async function writePendingInstall(updatesDir, marker) {
  await fsp.mkdir(updatesDir, { recursive: true });
  const body = {
    version: marker.version,
    filePath: path.resolve(marker.filePath),
    mode: marker.mode === "ui" ? "ui" : "silent",
    scheduledAt: marker.scheduledAt || new Date().toISOString(),
    sha256: marker.sha256 ?? null,
    reason: marker.reason ?? null,
    currentVersionAtSchedule: marker.currentVersionAtSchedule ?? null,
  };
  // Reject path escape before write
  assertInstallerPathInUpdatesDir(body.filePath, updatesDir);
  const p = markerPath(updatesDir);
  await fsp.writeFile(p, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return body;
}

/**
 * @param {string} updatesDir
 */
async function clearPendingInstall(updatesDir) {
  const p = markerPath(updatesDir);
  try {
    await fsp.unlink(p);
    return true;
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return false;
    throw err;
  }
}

/**
 * Detached delayed NSIS silent install so the app can release file locks after quit.
 * Flags: `/S` (electron-builder NSIS).
 *
 * @param {string} filePath absolute installer path
 * @param {{ spawn?: typeof spawn, delaySeconds?: number }} [opts]
 * @returns {{ ok: true, pid: number|undefined, args: string[], delayed: boolean, command: string }}
 */
function spawnSilentNsis(filePath, opts = {}) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error("安装包文件已丢失，请重新下载");
  }
  const base = path.basename(resolved);
  if (isPortableInstallerName(base)) {
    throw new Error("Portable 安装包不支持静默安装");
  }
  const delay = Math.max(1, Math.min(30, Number(opts.delaySeconds) || 3));
  // ping ~1s per count; delay then start installer with /S
  // Using cmd so we don't block quit; installer runs after short wait.
  const quoted = resolved.replace(/"/g, "");
  const cmdline = `ping 127.0.0.1 -n ${delay + 1} >nul & start "" /b "${quoted}" /S`;
  const spawnFn = opts.spawn || spawn;
  const shell = process.env.ComSpec || "cmd.exe";
  const child = spawnFn(shell, ["/d", "/s", "/c", cmdline], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd: path.dirname(resolved),
  });
  if (typeof child.unref === "function") child.unref();
  return {
    ok: true,
    pid: child.pid,
    args: ["/S"],
    delayed: true,
    command: `${base} /S`,
  };
}

/**
 * @param {string} a
 * @param {string} b
 */
function compareSemverLocal(a, b) {
  const parse = (raw) => {
    let s = String(raw || "").trim();
    if (s.startsWith("v") || s.startsWith("V")) s = s.slice(1);
    const plus = s.indexOf("+");
    if (plus >= 0) s = s.slice(0, plus);
    const dash = s.indexOf("-");
    if (dash >= 0) s = s.slice(0, dash);
    return s.split(".").map((p) => {
      const n = Number.parseInt(p, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < 3; i++) {
    const av = A[i] ?? 0;
    const bv = B[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * @param {PendingInstallMarker | null} marker
 * @param {string} currentVersion
 */
function evaluatePendingOnBoot(marker, currentVersion) {
  if (!marker) return { status: "none" };
  const cur = String(currentVersion || "").replace(/^[vV]/, "");
  const target = String(marker.version || "").replace(/^[vV]/, "");
  if (compareSemverLocal(cur, target) >= 0) {
    return {
      status: "success",
      marker,
      currentVersion: cur,
      message: `已更新到 ${cur}`,
    };
  }
  return {
    status: "pending",
    marker,
    currentVersion: cur,
    message: `升级未完成：目标 ${target}，当前 ${cur}。可重试静默安装或打开安装向导。`,
  };
}

module.exports = {
  MARKER_NAME,
  markerPath,
  isPortableInstallerName,
  isNsisInstallerCandidate,
  isPortableRuntime,
  assertInstallerPathInUpdatesDir,
  parsePendingInstallMarker,
  readPendingInstall,
  writePendingInstall,
  clearPendingInstall,
  spawnSilentNsis,
  evaluatePendingOnBoot,
  NSIS_SILENT_ARGS: ["/S"],
};
