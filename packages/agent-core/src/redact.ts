/**
 * Redact secrets before durable transcript / diagnostic export.
 */

const PATTERNS: Array<{ re: RegExp; replace: string }> = [
  // OpenAI / Anthropic style
  { re: /\b(sk-ant-[a-zA-Z0-9_-]{8,})\b/g, replace: "sk-ant-***REDACTED***" },
  { re: /\b(sk-[a-zA-Z0-9_-]{8,})\b/g, replace: "sk-***REDACTED***" },
  // GitHub PATs
  { re: /\b(ghp_[a-zA-Z0-9]{20,})\b/g, replace: "ghp_***REDACTED***" },
  { re: /\b(gho_[a-zA-Z0-9]{20,})\b/g, replace: "gho_***REDACTED***" },
  { re: /\b(ghu_[a-zA-Z0-9]{20,})\b/g, replace: "ghu_***REDACTED***" },
  { re: /\b(ghs_[a-zA-Z0-9]{20,})\b/g, replace: "ghs_***REDACTED***" },
  { re: /\b(ghr_[a-zA-Z0-9]{20,})\b/g, replace: "ghr_***REDACTED***" },
  { re: /\b(github_pat_[a-zA-Z0-9_]{20,})\b/g, replace: "github_pat_***REDACTED***" },
  // Slack
  { re: /\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/g, replace: "xox***REDACTED***" },
  // AWS access key id
  { re: /\b(AKIA[0-9A-Z]{16})\b/g, replace: "AKIA***REDACTED***" },
  // JWT (header.payload.sig)
  {
    re: /\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
    replace: "eyJ***REDACTED***",
  },
  // PEM private keys (single-line or multi-line-ish)
  {
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    replace: "-----BEGIN PRIVATE KEY-----***REDACTED***-----END PRIVATE KEY-----",
  },
  // Key-value assignments
  {
    re: /(api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|passwd|credential)\s*[:=]\s*["']?([^\s"',]{8,})/gi,
    replace: "$1=***REDACTED***",
  },
  { re: /(authorization\s*:\s*bearer\s+)([^\s]+)/gi, replace: "$1***REDACTED***" },
  { re: /(authorization\s*:\s*)([^\s]+)/gi, replace: "$1***REDACTED***" },
  // URL userinfo user:pass@host
  { re: /(\/\/)([^/\s:@]+):([^/\s@]+)@/g, replace: "$1$2:***REDACTED***@" },
];

/** Object keys whose string values are always fully masked. */
const SENSITIVE_KEY =
  /api[_-]?key|apikey|password|passwd|secret|token|authorization|credential|private[_-]?key|access[_-]?key|client[_-]?secret|refresh[_-]?token|session[_-]?token|cookie|set-cookie/i;

export function redactSecrets(text: string): string {
  let out = String(text ?? "");
  for (const { re, replace } of PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

export function isSensitiveKeyName(key: string): boolean {
  return SENSITIVE_KEY.test(String(key ?? ""));
}

export function redactJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[max-depth]";
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((v) => redactJsonValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKeyName(k)) {
        if (typeof v === "string") {
          out[k] = v ? "***REDACTED***" : v;
        } else if (v && typeof v === "object") {
          // Nested secret maps (e.g. headers) — mask leaf strings
          out[k] = redactJsonValue(v, depth + 1);
        } else {
          out[k] = v == null ? v : "***REDACTED***";
        }
      } else {
        out[k] = redactJsonValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/**
 * Safe process.env snapshot for diagnostics: only allowlisted keys +
 * existence flags for secret-looking names (never values).
 */
export function redactEnvSnapshot(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string | boolean | null> {
  const allow = new Set([
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "OS",
    "PROCESSOR_ARCHITECTURE",
    "NUMBER_OF_PROCESSORS",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "USERNAME",
    "USER",
    "LANG",
    "ComSpec",
    "TERM",
    "NODE_ENV",
    "ELECTRON_RUN_AS_NODE",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "http_proxy",
    "https_proxy",
    "NO_PROXY",
    "no_proxy",
    "ALL_PROXY",
    "all_proxy",
  ]);
  const out: Record<string, string | boolean | null> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v == null) continue;
    if (isSensitiveKeyName(k) || /api[_-]?key|token|secret|password|credential/i.test(k)) {
      out[k] = true; // present, value omitted
      continue;
    }
    if (allow.has(k)) {
      out[k] = redactSecrets(String(v).slice(0, 2_000));
    }
  }
  return out;
}
