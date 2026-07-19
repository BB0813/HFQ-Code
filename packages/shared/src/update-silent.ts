/**
 * L3 silent-install helpers (pure; no Electron).
 * Used by desktop main for pending-install markers + NSIS validation.
 */

import path from "node:path";
import { compareSemver, stripVersionNoise } from "./semver.js";

export type PendingInstallMode = "silent" | "ui";

export type PendingInstallMarker = {
  version: string;
  filePath: string;
  mode: PendingInstallMode;
  scheduledAt: string;
  /** Optional sha256 of installer when known. */
  sha256?: string | null;
  /** Why scheduled (manual CTA / on-quit / auto). */
  reason?: string | null;
  currentVersionAtSchedule?: string | null;
};

export type PendingInstallBootResult =
  | { status: "none" }
  | {
      status: "success";
      marker: PendingInstallMarker;
      currentVersion: string;
      message: string;
    }
  | {
      status: "pending" | "failed";
      marker: PendingInstallMarker;
      currentVersion: string;
      message: string;
    };

/** electron-builder portable sets these; also match path fragment. */
export function isPortableRuntime(env: NodeJS.ProcessEnv = process.env, execPath = process.execPath): boolean {
  if (env.PORTABLE_EXECUTABLE_DIR || env.PORTABLE_EXECUTABLE_FILE) return true;
  const p = String(execPath || "").toLowerCase();
  if (p.includes("portable")) return true;
  return false;
}

/** Asset / local file looks like portable channel (not eligible for L3 silent). */
export function isPortableInstallerName(name: string): boolean {
  return /portable/i.test(String(name || ""));
}

/**
 * NSIS / setup-style installer eligible for silent `/S`.
 * Rejects portable; accepts setup/nsis/x64/product-named .exe.
 */
export function isNsisInstallerCandidate(name: string): boolean {
  const n = String(name || "").toLowerCase();
  if (!n.endsWith(".exe")) return false;
  if (n.endsWith(".blockmap")) return false;
  if (isPortableInstallerName(n)) return false;
  // Prefer explicit setup/nsis; also allow product release exes that are not portable
  if (n.includes("setup") || n.includes("nsis") || n.includes("-x64")) return true;
  if (n.includes("hfq") && n.includes("code")) return true;
  // Generic non-portable .exe from our updates dir is treated as NSIS candidate
  return n.endsWith(".exe");
}

/**
 * electron-builder NSIS silent flag (oneClick:false still honors /S).
 * Documented for 1.1.8; UAC may still appear when perMachine:true.
 */
export const NSIS_SILENT_ARGS = ["/S"] as const;

/**
 * Ensure installer path is a real .exe under updatesRoot (no path escape).
 */
export function assertInstallerPathInUpdatesDir(
  filePath: string,
  updatesRoot: string,
): string {
  const resolved = path.resolve(String(filePath || "").trim());
  const root = path.resolve(String(updatesRoot || "").trim());
  if (!resolved || !root) {
    throw new Error("安装包路径无效");
  }
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("安装包路径不在 updates 目录内");
  }
  if (!resolved.toLowerCase().endsWith(".exe")) {
    throw new Error("安装包必须是 .exe 文件");
  }
  if (isPortableInstallerName(path.basename(resolved))) {
    throw new Error("Portable 安装包不支持静默安装，请使用 NSIS 安装版或打开安装向导");
  }
  if (!isNsisInstallerCandidate(path.basename(resolved))) {
    throw new Error("该安装包不支持静默安装");
  }
  return resolved;
}

export function buildPendingInstallMarker(input: {
  version: string;
  filePath: string;
  mode?: PendingInstallMode;
  scheduledAt?: string;
  sha256?: string | null;
  reason?: string | null;
  currentVersionAtSchedule?: string | null;
}): PendingInstallMarker {
  const version = stripVersionNoise(String(input.version || "").trim());
  if (!version) throw new Error("pending-install: version required");
  const filePath = path.resolve(String(input.filePath || "").trim());
  if (!filePath) throw new Error("pending-install: filePath required");
  return {
    version,
    filePath,
    mode: input.mode === "ui" ? "ui" : "silent",
    scheduledAt: input.scheduledAt || new Date().toISOString(),
    sha256: input.sha256 ?? null,
    reason: input.reason ?? null,
    currentVersionAtSchedule: input.currentVersionAtSchedule ?? null,
  };
}

export function parsePendingInstallMarker(raw: unknown): PendingInstallMarker | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const version = stripVersionNoise(String(o.version || "").trim());
  const filePath = String(o.filePath || "").trim();
  if (!version || !filePath) return null;
  const mode: PendingInstallMode = o.mode === "ui" ? "ui" : "silent";
  return {
    version,
    filePath: path.resolve(filePath),
    mode,
    scheduledAt: String(o.scheduledAt || "") || new Date(0).toISOString(),
    sha256: o.sha256 == null ? null : String(o.sha256),
    reason: o.reason == null ? null : String(o.reason),
    currentVersionAtSchedule:
      o.currentVersionAtSchedule == null ? null : String(o.currentVersionAtSchedule),
  };
}

/**
 * After upgrade boot: current ≥ target → success; else still pending/failed.
 */
export function evaluatePendingInstallOnBoot(
  marker: PendingInstallMarker | null,
  currentVersion: string,
): PendingInstallBootResult {
  if (!marker) return { status: "none" };
  const cur = stripVersionNoise(currentVersion);
  const target = stripVersionNoise(marker.version);
  if (compareSemver(cur, target) >= 0) {
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

/**
 * Silent install requires opt-in prefs.
 */
export function assertSilentInstallAllowed(opts: {
  silentInstall: boolean;
  silentInstallAcceptedAt?: string | null;
  portableRuntime?: boolean;
}): void {
  if (opts.portableRuntime) {
    throw new Error("Portable 运行时不支持静默自动安装，请使用 NSIS 安装版或手动安装向导");
  }
  if (!opts.silentInstall) {
    throw new Error("未开启「下载完成后自动安装更新」，无法静默安装");
  }
  // AcceptedAt is soft: if missing but silentInstall true, caller may stamp; still allow
}
