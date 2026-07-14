/**
 * Minimal semver helpers for update checks (no pre-release precedence).
 * Accepts optional leading `v` and ignores build metadata (+...) and pre-release (-...).
 */

export function stripVersionNoise(raw: string): string {
  let s = String(raw || "").trim();
  if (s.startsWith("v") || s.startsWith("V")) s = s.slice(1);
  const plus = s.indexOf("+");
  if (plus >= 0) s = s.slice(0, plus);
  const dash = s.indexOf("-");
  if (dash >= 0) s = s.slice(0, dash);
  return s.trim();
}

export function parseSemver(raw: string): [number, number, number] {
  const s = stripVersionNoise(raw);
  const parts = s.split(".").map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareSemver(a: string, b: string): number {
  const A = parseSemver(a);
  const B = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] - B[i];
  }
  return 0;
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}
