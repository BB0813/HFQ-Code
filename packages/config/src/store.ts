import fs from "node:fs/promises";
import path from "node:path";
import {
  AppConfigSchema,
  McpServerConfigSchema,
  defaultAppConfig,
  defaultCodingProfiles,
  normalizeProviderConfig,
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

function migratePermissionModePrefs(cfg: AppConfig, raw: unknown): AppConfig {
  const rawPrefs =
    raw && typeof raw === "object" && raw !== null && "prefs" in raw
      ? (raw as { prefs?: Record<string, unknown> }).prefs
      : undefined;
  const hadExplicitMode =
    rawPrefs && typeof rawPrefs === "object" && rawPrefs !== null && "permissionMode" in rawPrefs;
  if (hadExplicitMode) return cfg;
  // Legacy configs only set planModeDefault=true → promote to plan access mode once.
  if (cfg.prefs?.planModeDefault && cfg.prefs.permissionMode === "confirm_before_change") {
    return {
      ...cfg,
      prefs: {
        ...cfg.prefs,
        permissionMode: "plan",
      },
    };
  }
  return cfg;
}

/**
 * If active* points at a missing provider, clear or re-point to a remaining channel.
 * Does **not** invent mock/anthropic templates.
 */
function reconcileActiveSelection(cfg: AppConfig): AppConfig {
  const providers = cfg.providers ?? [];
  if (providers.length === 0) {
    if (cfg.activeProviderId === "" && cfg.activeModel === "") return cfg;
    return { ...cfg, activeProviderId: "", activeModel: "" };
  }
  const active = providers.find((p) => p.id === cfg.activeProviderId);
  if (active) {
    const models = Array.isArray(active.models) ? active.models : [];
    const modelOk =
      cfg.activeModel &&
      (models.includes(cfg.activeModel) || cfg.activeModel === active.defaultModel);
    if (modelOk) return cfg;
    return {
      ...cfg,
      activeModel:
        active.defaultModel ||
        (models[0] ?? "") ||
        cfg.activeModel ||
        "",
    };
  }
  const fallback =
    providers.find((p) => p.enabled !== false) ?? providers[0]!;
  return {
    ...cfg,
    activeProviderId: fallback.id,
    activeModel:
      fallback.defaultModel ||
      (Array.isArray(fallback.models) ? fallback.models[0] : undefined) ||
      "",
  };
}

export async function loadAppConfig(configPath: string): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    // Do NOT force-inject mock on load — user may have deleted all channels.
    let cfg = reconcileActiveSelection(AppConfigSchema.parse(parsed));
    cfg = migratePermissionModePrefs(cfg, parsed);
    // Seed built-in coding profiles once when missing/empty (additive; user can clear later by replacing list).
    if (!cfg.prefs?.codingProfiles?.length) {
      cfg = {
        ...cfg,
        prefs: {
          ...cfg.prefs,
          codingProfiles: defaultCodingProfiles(),
        },
      };
    }
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
      // First run only: seed defaultAppConfig (includes mock template).
      const cfg = defaultAppConfig();
      await saveAppConfig(configPath, cfg);
      return cfg;
    }
    throw err;
  }
}

export async function saveAppConfig(configPath: string, config: AppConfig): Promise<void> {
  // No ensureMockProvider — empty providers is a valid persisted state.
  const cfg = reconcileActiveSelection(AppConfigSchema.parse(config));
  // extractCredentials only keeps keys for current providers → deleted ids dropped.
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

export function upsertProvider(cfg: AppConfig, provider: ProviderConfig): AppConfig {
  const normalized = normalizeProviderConfig(provider);
  const others = cfg.providers.filter((p) => p.id !== normalized.id);
  const next: AppConfig = {
    ...cfg,
    providers: [...others, normalized].sort((a, b) => a.id.localeCompare(b.id)),
  };
  // If nothing was active, select the newly upserted channel.
  if (!next.activeProviderId) {
    next.activeProviderId = normalized.id;
    next.activeModel = normalized.defaultModel || normalized.models[0] || "";
  }
  return reconcileActiveSelection(next);
}

/**
 * Remove a provider channel by id.
 * - mock **can** be deleted
 * - last channel **can** be deleted → `providers: []`, active cleared
 * - deleting active reassigns to first remaining enabled (or clears if empty)
 */
export function removeProvider(cfg: AppConfig, providerId: string): AppConfig {
  const id = String(providerId ?? "").trim();
  if (!id) throw new Error("provider id required");
  if (!cfg.providers.some((p) => p.id === id)) {
    throw new Error(`provider not found: ${id}`);
  }
  const remaining = cfg.providers.filter((p) => p.id !== id);
  let activeProviderId = cfg.activeProviderId;
  let activeModel = cfg.activeModel;
  if (remaining.length === 0) {
    activeProviderId = "";
    activeModel = "";
  } else if (activeProviderId === id || !remaining.some((p) => p.id === activeProviderId)) {
    const fallback =
      remaining.find((p) => p.enabled !== false) ?? remaining[0]!;
    activeProviderId = fallback.id;
    activeModel =
      fallback.defaultModel ||
      (Array.isArray(fallback.models) ? fallback.models[0] : undefined) ||
      "";
  }
  return {
    ...cfg,
    providers: remaining.sort((a, b) => a.id.localeCompare(b.id)),
    activeProviderId,
    activeModel,
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

/** Prefs patch: nested updatePolicy / skillMatch / modelRoles accept partials. */
export type PrefsPatch = Omit<
  Partial<AppConfig["prefs"]>,
  "updatePolicy" | "skillMatch" | "modelRoles"
> & {
  updatePolicy?: Partial<NonNullable<AppConfig["prefs"]["updatePolicy"]>>;
  skillMatch?: Partial<NonNullable<AppConfig["prefs"]["skillMatch"]>>;
  modelRoles?: Partial<NonNullable<AppConfig["prefs"]["modelRoles"]>>;
};

export function withPrefs(cfg: AppConfig, patch: PrefsPatch): AppConfig {
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
      planModeDefault:
        patch.planModeDefault ??
        (patch.permissionMode === "plan"
          ? true
          : patch.permissionMode
            ? false
            : (cfg.prefs?.planModeDefault ?? false)),
      permissionMode:
        patch.permissionMode ??
        cfg.prefs?.permissionMode ??
        (cfg.prefs?.planModeDefault ? "plan" : "confirm_before_change"),
      checkUpdatesOnStartup:
        patch.checkUpdatesOnStartup ?? cfg.prefs?.checkUpdatesOnStartup ?? true,
      lastUpdateCheckAt:
        patch.lastUpdateCheckAt !== undefined
          ? patch.lastUpdateCheckAt
          : cfg.prefs?.lastUpdateCheckAt,
      updateSource:
        patch.updateSource === "direct" || patch.updateSource === "ghproxy"
          ? patch.updateSource
          : cfg.prefs?.updateSource === "direct" || cfg.prefs?.updateSource === "ghproxy"
            ? cfg.prefs.updateSource
            : "ghproxy",
      updateProxyBase:
        typeof patch.updateProxyBase === "string"
          ? patch.updateProxyBase.trim() || "https://ghproxy.com/"
          : cfg.prefs?.updateProxyBase?.trim() || "https://ghproxy.com/",
      terminalShell: (() => {
        const raw =
          patch.terminalShell !== undefined
            ? patch.terminalShell
            : cfg.prefs?.terminalShell;
        const s = String(raw ?? "").trim().toLowerCase();
        if (s === "powershell" || s === "pwsh" || s === "cmd") return s;
        return "";
      })(),
      codingProfiles:
        patch.codingProfiles !== undefined
          ? patch.codingProfiles
          : (cfg.prefs?.codingProfiles ?? []),
      activeCodingProfileId:
        patch.activeCodingProfileId !== undefined
          ? String(patch.activeCodingProfileId ?? "")
          : (cfg.prefs?.activeCodingProfileId ?? ""),
      modelRoles:
        patch.modelRoles !== undefined
          ? {
              title: patch.modelRoles.title ?? cfg.prefs?.modelRoles?.title,
              compression:
                patch.modelRoles.compression ?? cfg.prefs?.modelRoles?.compression,
            }
          : (cfg.prefs?.modelRoles ?? {}),
      skillMatch: {
        enabled:
          patch.skillMatch?.enabled ?? cfg.prefs?.skillMatch?.enabled ?? true,
        maxBodies:
          patch.skillMatch?.maxBodies ?? cfg.prefs?.skillMatch?.maxBodies ?? 2,
        maxBodyChars:
          patch.skillMatch?.maxBodyChars ??
          cfg.prefs?.skillMatch?.maxBodyChars ??
          6_000,
      },
      updatePolicy: mergeUpdatePolicy(cfg.prefs?.updatePolicy, patch.updatePolicy),
    },
  };
}

/**
 * Merge updatePolicy patch (1.1.7+). All fields optional; clamps checkIntervalHours to 1..168.
 * silentInstall opt-in is enforced at install time in desktop main (1.1.8).
 */
function mergeUpdatePolicy(
  prev: AppConfig["prefs"]["updatePolicy"] | undefined,
  patch: Partial<NonNullable<AppConfig["prefs"]["updatePolicy"]>> | undefined,
): NonNullable<AppConfig["prefs"]["updatePolicy"]> {
  const base = {
    autoCheck: prev?.autoCheck ?? true,
    autoDownload: prev?.autoDownload ?? false,
    checkIntervalHours: prev?.checkIntervalHours ?? 24,
    silentInstall: prev?.silentInstall ?? false,
    silentInstallAcceptedAt:
      prev?.silentInstallAcceptedAt === undefined ? null : prev.silentInstallAcceptedAt,
  };
  if (!patch || typeof patch !== "object") return base;

  const next = { ...base };
  if (typeof patch.autoCheck === "boolean") next.autoCheck = patch.autoCheck;
  if (typeof patch.autoDownload === "boolean") next.autoDownload = patch.autoDownload;
  if (typeof patch.silentInstall === "boolean") next.silentInstall = patch.silentInstall;
  if (patch.silentInstallAcceptedAt !== undefined) {
    next.silentInstallAcceptedAt =
      patch.silentInstallAcceptedAt === null
        ? null
        : String(patch.silentInstallAcceptedAt || "") || null;
  }
  if (patch.checkIntervalHours != null) {
    const n = Number(patch.checkIntervalHours);
    if (Number.isFinite(n)) {
      next.checkIntervalHours = Math.max(1, Math.min(168, Math.round(n)));
    }
  }
  return next;
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

  const merged: ProviderConfig = {
    ...base,
    ...patch,
    apiKey: nextApiKey,
    models: patch.models ?? base.models,
    enabled: patch.enabled ?? base.enabled,
    kind: patch.kind ?? base.kind,
    name: patch.name ?? base.name,
  };
  return normalizeProviderConfig(merged);
}
