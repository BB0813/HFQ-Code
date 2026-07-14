import fs from "node:fs/promises";
import path from "node:path";
import {
  AppConfigSchema,
  McpServerConfigSchema,
  defaultAppConfig,
  type AppConfig,
  type McpServerConfig,
  type ProviderConfig,
} from "./schema.js";
import {
  configHasInlineSecrets,
  credentialsPathFor,
  emptyCredentials,
  extractCredentials,
  loadCredentialsFile,
  mergeCredentials,
  saveCredentialsFile,
  stripSecretsForPublicConfig,
} from "./credentials.js";

export async function loadAppConfig(configPath: string): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    let cfg = ensureMockProvider(AppConfigSchema.parse(parsed));
    const credPath = credentialsPathFor(configPath);
    let creds = await loadCredentialsFile(credPath);

    // Soft-migrate: secrets still living in config.json → credentials.json
    if (configHasInlineSecrets(cfg)) {
      const extracted = extractCredentials(cfg);
      // credentials.json wins on conflict; fill gaps from legacy config.json
      creds = {
        version: 1,
        providerApiKeys: { ...extracted.providerApiKeys, ...creds.providerApiKeys },
        mcpHeaders: { ...extracted.mcpHeaders, ...creds.mcpHeaders },
      };
      await saveCredentialsFile(credPath, creds);
      const publicCfg = stripSecretsForPublicConfig(cfg);
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, `${JSON.stringify(publicCfg, null, 2)}\n`, "utf8");
      cfg = publicCfg;
    }

    return mergeCredentials(cfg, creds);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const cfg = defaultAppConfig();
      await saveAppConfig(configPath, cfg);
      return cfg;
    }
    throw err;
  }
}

export async function saveAppConfig(configPath: string, config: AppConfig): Promise<void> {
  const cfg = ensureMockProvider(AppConfigSchema.parse(config));
  const creds = extractCredentials(cfg);
  const publicCfg = stripSecretsForPublicConfig(cfg);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await saveCredentialsFile(credentialsPathFor(configPath), creds);
  await fs.writeFile(configPath, `${JSON.stringify(publicCfg, null, 2)}\n`, "utf8");
}

/** Path helper for UI / diagnostics. */
export function getCredentialsPath(configPath: string): string {
  return credentialsPathFor(configPath);
}

export { emptyCredentials, extractCredentials, mergeCredentials, stripSecretsForPublicConfig };

function ensureMockProvider(cfg: AppConfig): AppConfig {
  const defaults = defaultAppConfig().providers;
  let providers = [...cfg.providers];
  let changed = false;
  if (!providers.some((p) => p.id === "mock")) {
    const mock = defaults.find((p) => p.id === "mock");
    if (mock) {
      providers = [mock, ...providers];
      changed = true;
    }
  }
  // Soft-migrate: add Anthropic template if missing (empty key).
  if (!providers.some((p) => p.id === "anthropic")) {
    const ant = defaults.find((p) => p.id === "anthropic");
    if (ant) {
      providers = [...providers, ant];
      changed = true;
    }
  }
  return changed ? { ...cfg, providers } : cfg;
}

export function upsertProvider(cfg: AppConfig, provider: ProviderConfig): AppConfig {
  const others = cfg.providers.filter((p) => p.id !== provider.id);
  return {
    ...cfg,
    providers: [...others, provider].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * Push a workspace path to the front of recentWorkspaces (deduped).
 */
export function touchRecentWorkspace(
  cfg: AppConfig,
  workspacePath: string,
  max = 8,
): AppConfig {
  const resolved = path.resolve(workspacePath);
  const norm = (p: string) => path.resolve(p).toLowerCase();
  const rest = (cfg.recentWorkspaces ?? []).filter((p) => norm(p) !== norm(resolved));
  return {
    ...cfg,
    recentWorkspaces: [resolved, ...rest].slice(0, max),
  };
}

/** Strip runtime MCP state and keep only registry fields for config.json. */
export function toPersistedMcpServers(
  servers: Array<Partial<McpServerConfig> & { id: string; name: string; transport: "stdio" | "http" }>,
): McpServerConfig[] {
  return servers.map((s) =>
    McpServerConfigSchema.parse({
      id: s.id,
      name: s.name,
      transport: s.transport,
      command: s.command,
      args: s.args,
      url: s.url,
      headers: s.headers,
      enabled: s.enabled !== false,
      description: s.description,
    }),
  );
}

export function withMcpServers(cfg: AppConfig, servers: McpServerConfig[]): AppConfig {
  return {
    ...cfg,
    mcpServers: toPersistedMcpServers(servers),
  };
}

export function withPrefs(
  cfg: AppConfig,
  patch: Partial<AppConfig["prefs"]>,
): AppConfig {
  return {
    ...cfg,
    prefs: {
      theme: patch.theme ?? cfg.prefs?.theme ?? "dark",
      proxyUrl: patch.proxyUrl ?? cfg.prefs?.proxyUrl ?? "",
      memoryEnabled: patch.memoryEnabled ?? cfg.prefs?.memoryEnabled ?? true,
      compactMaxChars: patch.compactMaxChars ?? cfg.prefs?.compactMaxChars ?? 48_000,
      usageInputPerMillion:
        patch.usageInputPerMillion ?? cfg.prefs?.usageInputPerMillion ?? 0,
      usageOutputPerMillion:
        patch.usageOutputPerMillion ?? cfg.prefs?.usageOutputPerMillion ?? 0,
      planModeDefault: patch.planModeDefault ?? cfg.prefs?.planModeDefault ?? false,
    },
  };
}

export function withMcpServerHeaders(
  server: McpServerConfig,
  headers?: Record<string, string>,
): McpServerConfig {
  return McpServerConfigSchema.parse({
    ...server,
    headers: headers && Object.keys(headers).length ? headers : undefined,
  });
}

function maskHeaderMap(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers || !Object.keys(headers).length) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = String(k);
    if (/authorization|api[_-]?key|token|secret|password|cookie/i.test(key) && v) {
      out[key] = maskSecret(String(v));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

export function publicConfigView(cfg: AppConfig): AppConfig {
  return {
    ...cfg,
    providers: cfg.providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? maskSecret(p.apiKey) : "",
    })),
    mcpServers: (cfg.mcpServers ?? []).map((s) => ({
      ...s,
      headers: maskHeaderMap(s.headers),
    })),
  };
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return "********";
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}

/** Merge UI updates without wiping an existing real apiKey when masked. */
export function mergeProviderUpdate(
  existing: ProviderConfig | undefined,
  patch: Partial<ProviderConfig> & { id: string },
): ProviderConfig {
  const base: ProviderConfig = existing ?? {
    id: patch.id,
    name: patch.name ?? patch.id,
    kind: patch.kind ?? "openai_compatible",
    enabled: true,
    models: [],
  };

  const nextApiKey =
    patch.apiKey === undefined
      ? base.apiKey
      : patch.apiKey.includes("…") || patch.apiKey === "********"
        ? base.apiKey
        : patch.apiKey;

  return {
    ...base,
    ...patch,
    apiKey: nextApiKey,
    models: patch.models ?? base.models,
    enabled: patch.enabled ?? base.enabled,
    kind: patch.kind ?? base.kind,
    name: patch.name ?? base.name,
  };
}
