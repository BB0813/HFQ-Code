/**
 * Redact secrets before durable transcript / diagnostic export.
 */

const PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\b(sk-[a-zA-Z0-9_-]{8,})\b/g, replace: "sk-***REDACTED***" },
  { re: /\b(sk-ant-[a-zA-Z0-9_-]{8,})\b/g, replace: "sk-ant-***REDACTED***" },
  { re: /(api[_-]?key|apikey|token|secret|password)\s*[:=]\s*["']?([^\s"',]{8,})/gi, replace: "$1=***REDACTED***" },
  { re: /(authorization\s*:\s*bearer\s+)([^\s]+)/gi, replace: "$1***REDACTED***" },
  { re: /(authorization\s*:\s*)([^\s]+)/gi, replace: "$1***REDACTED***" },
];

export function redactSecrets(text: string): string {
  let out = String(text ?? "");
  for (const { re, replace } of PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

export function redactJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((v) => redactJsonValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/apiKey|api_key|password|secret|token|authorization/i.test(k) && typeof v === "string") {
        out[k] = v ? "***REDACTED***" : v;
      } else {
        out[k] = redactJsonValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}
