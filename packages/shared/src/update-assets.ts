/**
 * Helpers for in-app update download (D3): pick NSIS/portable assets and allowlist hosts.
 * No network I/O — pure functions for main + unit tests.
 */

export type UpdateAssetLike = {
  name?: string;
  url?: string;
  mirrorUrl?: string;
  size?: number;
  contentType?: string;
};

const DEFAULT_ALLOWED_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "githubusercontent.com",
  "ungh.cc",
  "ghproxy.com",
  "mirror.ghproxy.com",
  "gh-proxy.com",
  "ghfast.top",
  "gh.ddlc.top",
  "ghproxy.net",
  "gitclone.com",
]);

/** Score higher = preferred for Windows in-app install. */
export function scoreUpdateAsset(name: string): number {
  const n = String(name || "").toLowerCase();
  if (!n.endsWith(".exe")) return -1;
  // Skip blockmaps / yml / unrelated
  if (n.endsWith(".blockmap") || n.endsWith(".yml") || n.endsWith(".yaml")) return -1;
  if (n.includes("portable")) return 40;
  // Prefer NSIS / setup-like names
  if (n.includes("setup") || n.includes("nsis") || n.includes("-x64")) return 100;
  // Product name patterns
  if (n.includes("hfq") && n.includes("code")) return 90;
  if (n.endsWith(".exe")) return 50;
  return 0;
}

/**
 * Pick the best Windows installer asset from a release asset list.
 * Prefers non-portable NSIS x64 when present.
 */
export function pickUpdateAsset(
  assets: UpdateAssetLike[] | null | undefined,
  opts?: { preferPortable?: boolean },
): UpdateAssetLike | null {
  const list = Array.isArray(assets) ? assets : [];
  let best: UpdateAssetLike | null = null;
  let bestScore = -1;
  for (const a of list) {
    if (!a?.url && !a?.mirrorUrl) continue;
    let score = scoreUpdateAsset(String(a.name || ""));
    if (score < 0) continue;
    if (opts?.preferPortable && /portable/i.test(String(a.name || ""))) {
      score += 30;
    } else if (!opts?.preferPortable && /portable/i.test(String(a.name || ""))) {
      score -= 20;
    }
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

/** Safe local filename from asset name (no path separators). */
export function sanitizeUpdateFileName(name: string): string {
  let base = String(name || "HFQ-Code-update.exe").trim();
  base = base.replace(/[/\\?%*:|"<>]/g, "_");
  base = base.replace(/\.\.+/g, ".");
  if (!base.toLowerCase().endsWith(".exe")) {
    base = `${base || "HFQ-Code-update"}.exe`;
  }
  // Cap length
  if (base.length > 180) {
    base = `${base.slice(0, 160)}.exe`;
  }
  return base;
}

export function isAllowedUpdateDownloadHost(
  hostname: string,
  extraHosts?: Iterable<string> | null,
): boolean {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host) return false;
  if (DEFAULT_ALLOWED_HOSTS.has(host)) return true;
  // Subdomains of githubusercontent
  if (host.endsWith(".githubusercontent.com")) return true;
  if (extraHosts) {
    for (const h of extraHosts) {
      if (String(h || "").trim().toLowerCase() === host) return true;
    }
  }
  return false;
}

/**
 * Validate download URL for update installer.
 * Only https; host allowlisted; path should look like a release asset when on github.com.
 */
export function assertAllowedUpdateDownloadUrl(
  rawUrl: string,
  opts?: { extraHosts?: string[] },
): URL {
  let url: URL;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("invalid download URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("only https download URLs allowed");
  }
  if (!isAllowedUpdateDownloadHost(url.hostname, opts?.extraHosts)) {
    throw new Error(`download host not allowed: ${url.hostname}`);
  }
  // Soft check: github.com should be under /owner/repo or releases
  if (url.hostname.toLowerCase() === "github.com") {
    const p = url.pathname.toLowerCase();
    if (!p.includes("/releases/") && !p.includes("/download/")) {
      // still allow if it's our repo path — mirrors sometimes rewrite
      if (!/hfq-code/i.test(p)) {
        throw new Error("github.com URL is not a release download");
      }
    }
  }
  return url;
}

/** Resolve which URL to download (prefer mirror when present). */
export function resolveAssetDownloadUrl(
  asset: UpdateAssetLike,
  preferMirror = true,
): string {
  const mirror = String(asset.mirrorUrl || "").trim();
  const direct = String(asset.url || "").trim();
  if (preferMirror && mirror) return mirror;
  if (direct) return direct;
  if (mirror) return mirror;
  throw new Error("asset has no download URL");
}
