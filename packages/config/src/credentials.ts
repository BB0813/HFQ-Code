/**
 * Side-car secrets store (Phase-3 M3.1 + 1.2 D1 DPAPI).
 * config.json stays non-secret; credentials.json holds api keys + MCP auth headers.
 *
 * On Windows (unless HFQ_CREDENTIALS_PLAIN=1), disk format is a DPAPI envelope:
 *   { "version": 2, "encoding": "dpapi-current-user", "ciphertext": "<base64>" }
 * Plaintext v1 remains readable and is re-saved encrypted on next write.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AppConfig, McpServerConfig, ProviderConfig } from "./schema.js";
import { dpapiProtect, dpapiUnprotect, shouldUseDpapi } from "./dpapi.js";

export const CredentialsFileSchema = z.object({
  version: z.literal(1).default(1),
  /** providerId → apiKey */
  providerApiKeys: z.record(z.string()).default({}),
  /** mcp server id → header map (typically Authorization) */
  mcpHeaders: z.record(z.record(z.string())).default({}),
});

export type CredentialsFile = z.infer<typeof CredentialsFileSchema>;

/** On-disk envelope when DPAPI is used. */
export const CredentialsEnvelopeSchema = z.object({
  version: z.literal(2),
  encoding: z.literal("dpapi-current-user"),
  ciphertext: z.string().min(1),
});

export type CredentialsEnvelope = z.infer<typeof CredentialsEnvelopeSchema>;

export function emptyCredentials(): CredentialsFile {
  return { version: 1, providerApiKeys: {}, mcpHeaders: {} };
}

export function credentialsPathFor(configPath: string): string {
  return path.join(path.dirname(configPath), "credentials.json");
}

export function isCredentialsEnvelope(raw: unknown): raw is CredentialsEnvelope {
  return CredentialsEnvelopeSchema.safeParse(raw).success;
}

export async function loadCredentialsFile(filePath: string): Promise<CredentialsFile> {
  try {
    const rawText = await fs.readFile(filePath, "utf8");
    const raw = JSON.parse(rawText) as unknown;

    if (isCredentialsEnvelope(raw)) {
      const plain = await dpapiUnprotect(raw.ciphertext, "CurrentUser");
      return CredentialsFileSchema.parse(JSON.parse(plain) as unknown);
    }

    return CredentialsFileSchema.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyCredentials();
    }
    throw err;
  }
}

export async function saveCredentialsFile(
  filePath: string,
  creds: CredentialsFile,
): Promise<void> {
  const parsed = CredentialsFileSchema.parse(creds);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  let body: string;
  if (shouldUseDpapi()) {
    const plain = `${JSON.stringify(parsed)}\n`;
    const ciphertext = await dpapiProtect(plain, "CurrentUser");
    const envelope: CredentialsEnvelope = {
      version: 2,
      encoding: "dpapi-current-user",
      ciphertext,
    };
    body = `${JSON.stringify(envelope, null, 2)}\n`;
  } else {
    body = `${JSON.stringify(parsed, null, 2)}\n`;
  }

  await fs.writeFile(filePath, body, "utf8");
  // Best-effort: restrict permissions on POSIX (no-op failure on Windows).
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    /* ignore */
  }
}

/**
 * Whether the on-disk file is a DPAPI envelope (for diagnostics / settings UI).
 */
export async function credentialsDiskEncoding(
  filePath: string,
): Promise<"missing" | "plaintext" | "dpapi-current-user" | "unknown"> {
  try {
    const rawText = await fs.readFile(filePath, "utf8");
    const raw = JSON.parse(rawText) as unknown;
    if (isCredentialsEnvelope(raw)) return "dpapi-current-user";
    if (CredentialsFileSchema.safeParse(raw).success) return "plaintext";
    return "unknown";
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    return "unknown";
  }
}

export function isSensitiveHeaderName(name: string): boolean {
  return /authorization|api[_-]?key|token|secret|password|cookie/i.test(String(name));
}

/** Pull secrets out of a full AppConfig into a credentials blob. */
export function extractCredentials(cfg: AppConfig): CredentialsFile {
  const providerApiKeys: Record<string, string> = {};
  for (const p of cfg.providers ?? []) {
    const key = (p.apiKey ?? "").trim();
    if (key) providerApiKeys[p.id] = key;
  }
  const mcpHeaders: Record<string, Record<string, string>> = {};
  for (const s of cfg.mcpServers ?? []) {
    if (!s.headers || !Object.keys(s.headers).length) continue;
    const sensitive: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.headers)) {
      if (isSensitiveHeaderName(k) && String(v ?? "").trim()) {
        sensitive[k] = String(v);
      }
    }
    if (Object.keys(sensitive).length) mcpHeaders[s.id] = sensitive;
  }
  return { version: 1, providerApiKeys, mcpHeaders };
}

/** Merge credentials into config (runtime view with real secrets). */
export function mergeCredentials(cfg: AppConfig, creds: CredentialsFile): AppConfig {
  const providers: ProviderConfig[] = (cfg.providers ?? []).map((p) => {
    const fromFile = creds.providerApiKeys?.[p.id];
    if (fromFile != null && fromFile !== "") {
      return { ...p, apiKey: fromFile };
    }
    return p;
  });

  const mcpServers: McpServerConfig[] = (cfg.mcpServers ?? []).map((s) => {
    const secretHeaders = creds.mcpHeaders?.[s.id];
    if (!secretHeaders || !Object.keys(secretHeaders).length) return s;
    return {
      ...s,
      headers: { ...(s.headers ?? {}), ...secretHeaders },
    };
  });

  return { ...cfg, providers, mcpServers };
}

/**
 * Config shape safe to write to config.json (no provider keys, no sensitive MCP headers).
 * Non-sensitive MCP headers (e.g. x-tenant) remain in config.json.
 */
export function stripSecretsForPublicConfig(cfg: AppConfig): AppConfig {
  return {
    ...cfg,
    providers: (cfg.providers ?? []).map((p) => ({
      ...p,
      apiKey: "",
    })),
    mcpServers: (cfg.mcpServers ?? []).map((s) => {
      if (!s.headers) return s;
      const publicHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(s.headers)) {
        if (!isSensitiveHeaderName(k)) publicHeaders[k] = String(v);
      }
      return {
        ...s,
        headers: Object.keys(publicHeaders).length ? publicHeaders : undefined,
      };
    }),
  };
}

/** True if config.json still embeds secrets that belong in credentials.json. */
export function configHasInlineSecrets(cfg: AppConfig): boolean {
  if ((cfg.providers ?? []).some((p) => Boolean((p.apiKey ?? "").trim()))) return true;
  for (const s of cfg.mcpServers ?? []) {
    if (!s.headers) continue;
    for (const k of Object.keys(s.headers)) {
      if (isSensitiveHeaderName(k) && String(s.headers[k] ?? "").trim()) return true;
    }
  }
  return false;
}
