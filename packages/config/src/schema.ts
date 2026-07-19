import { z } from "zod";

/**
 * Provider channel schema.
 * Note: empty `models` is still parseable for legacy disk files; `normalizeProviderConfig`
 * / upsert path enforces ≥1 model for writes.
 */
export const ProviderConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["mock", "openai_compatible", "anthropic"]),
  enabled: z.boolean().default(true),
  baseURL: z.string().optional(),
  apiKey: z.string().optional(),
  models: z.array(z.string()).default([]),
  defaultModel: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** Persisted MCP registry entry (no runtime connection state). */
export const McpServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  transport: z.enum(["stdio", "http"]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  /**
   * Optional HTTP headers. Sensitive values (Authorization, etc.) are stored in
   * credentials.json; non-sensitive headers may remain in config.json.
   */
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const PermissionModeSchema = z.enum([
  "confirm_before_change",
  "auto_edit",
  "plan",
  "full_access",
]);

export type PermissionMode = z.infer<typeof PermissionModeSchema>;

/** Optional provider+model override for non-chat roles (title / compression). */
export const ModelRoleRefSchema = z.object({
  providerId: z.string().optional(),
  model: z.string().optional(),
});

export type ModelRoleRef = z.infer<typeof ModelRoleRefSchema>;

/**
 * Coding profile (Kivio-style assistants, coding-only).
 * Empty providerId/model → use global active channel.
 */
export const CodingProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  /** Appended to system prompt for this profile. */
  systemAddon: z.string().optional(),
  /** Soft skill preference for progressive inject. */
  skillIds: z.array(z.string()).default([]),
  permissionMode: PermissionModeSchema.optional(),
  providerId: z.string().optional(),
  model: z.string().optional(),
  builtIn: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type CodingProfile = z.infer<typeof CodingProfileSchema>;

export const ModelRolesSchema = z.object({
  title: ModelRoleRefSchema.optional(),
  compression: ModelRoleRefSchema.optional(),
});

export type ModelRoles = z.infer<typeof ModelRolesSchema>;

export const SkillMatchPrefsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Max full skill bodies injected under the index. */
  maxBodies: z.number().int().min(0).max(8).default(2),
  maxBodyChars: z.number().int().min(500).max(40_000).default(6_000),
});

export type SkillMatchPrefs = z.infer<typeof SkillMatchPrefsSchema>;

/**
 * Update ladder policy (1.1.7 L1+L2; 1.1.8 L3 silentInstall opt-in).
 * All fields optional — missing object / keys keep product defaults.
 */
export const UpdatePolicySchema = z.object({
  /** Background / interval checks. default true (aligned with checkUpdatesOnStartup). */
  autoCheck: z.boolean().default(true),
  /** After updateAvailable, download installer in background. default false. */
  autoDownload: z.boolean().default(false),
  /** Check interval hours. default 24; clamp 1..168 in withPrefs. */
  checkIntervalHours: z.number().int().min(1).max(168).default(24),
  /**
   * L3: allow silent NSIS install after ready (opt-in; default false).
   * Requires FE secondary confirm; main stamps silentInstallAcceptedAt when enabling.
   * Portable runtime refuses enable / schedule.
   */
  silentInstall: z.boolean().default(false),
  /** ISO time user accepted silentInstall (audit). */
  silentInstallAcceptedAt: z.string().nullable().optional(),
});

export type UpdatePolicy = z.infer<typeof UpdatePolicySchema>;

/** Built-in coding profiles (seeded when prefs.codingProfiles is empty). */
export function defaultCodingProfiles(): CodingProfile[] {
  return [
    {
      id: "profile_refactor",
      name: "Refactor",
      description: "Small focused refactors; preserve behavior; explain diffs.",
      icon: "🔧",
      systemAddon:
        "Profile: Refactor. Prefer minimal, reviewable edits. Match project style. Do not rewrite unrelated code. After changes, summarize what moved and why.",
      skillIds: ["diagram"],
      builtIn: true,
      enabled: true,
    },
    {
      id: "profile_debug",
      name: "Debug",
      description: "Reproduce, isolate root cause, fix with evidence.",
      icon: "🐛",
      systemAddon:
        "Profile: Debug. Gather evidence before changing code. Prefer read/grep/shell diagnostics first. State root cause, then apply the smallest fix. Do not paper over symptoms.",
      skillIds: [],
      builtIn: true,
      enabled: true,
    },
    {
      id: "profile_review",
      name: "Review",
      description: "Code review: risks, tests, design notes; plan-friendly.",
      icon: "👀",
      systemAddon:
        "Profile: Review. Default to analysis over edits unless asked to fix. Call out bugs, security, missing tests, and API risks. Prefer structured findings with severity.",
      skillIds: ["diagram"],
      permissionMode: "plan",
      builtIn: true,
      enabled: true,
    },
    {
      id: "profile_docs",
      name: "Docs",
      description: "README, ADRs, API notes, changelogs.",
      icon: "📄",
      systemAddon:
        "Profile: Docs. Write concise, accurate project docs. Prefer existing tone. Flag unknowns instead of inventing APIs. Use tables sparingly when comparison helps.",
      skillIds: ["diagram"],
      builtIn: true,
      enabled: true,
    },
    {
      id: "profile_frontend",
      name: "Frontend",
      description: "UI components, layout, interaction polish.",
      icon: "🎨",
      systemAddon:
        "Profile: Frontend. Follow the repo's UI stack and design tokens. Avoid generic AI aesthetics. Prefer accessible, responsive components that match surrounding code.",
      skillIds: ["diagram"],
      builtIn: true,
      enabled: true,
    },
    {
      id: "profile_research",
      name: "Research",
      description: "Codebase / docs research; cite paths; avoid silent edits.",
      icon: "🔍",
      systemAddon:
        "Profile: Research. Prioritize read-only exploration. Cite file paths and evidence. Separate facts from inference. Only edit when the user asks for implementation.",
      skillIds: ["diagram"],
      permissionMode: "confirm_before_change",
      builtIn: true,
      enabled: true,
    },
  ];
}

export const UiPrefsSchema = z.object({
  /** dark is the product default; light is a soft inversion. */
  theme: z.enum(["dark", "light"]).default("dark"),
  /** Optional HTTP(S) proxy for model / network_fetch (empty = system / none). */
  proxyUrl: z.string().default(""),
  /** Inject local memory notes into system prompt. */
  memoryEnabled: z.boolean().default(true),
  /** Soft character budget before chat compaction. */
  compactMaxChars: z.number().int().min(8_000).max(200_000).default(48_000),
  /** Optional USD per 1M tokens for usage estimates. */
  usageInputPerMillion: z.number().min(0).max(1_000).default(0),
  usageOutputPerMillion: z.number().min(0).max(1_000).default(0),
  /**
   * Legacy boolean default for plan mode. Soft-migrated into permissionMode when missing.
   * Prefer permissionMode for new code.
   */
  planModeDefault: z.boolean().default(false),
  /**
   * Default access mode for new sessions (Claude Code / ZCode style).
   * full_access is YOLO (including dangerous shell).
   */
  permissionMode: PermissionModeSchema.default("confirm_before_change"),
  /**
   * When true, desktop quietly queries GitHub Releases on startup (manual download only).
   */
  checkUpdatesOnStartup: z.boolean().default(true),
  /** ISO timestamp of last successful/attempted update check (best-effort). */
  lastUpdateCheckAt: z.string().optional(),
  /**
   * How to reach GitHub Releases for update checks.
   * `ghproxy` (default) wraps api.github.com via a public mirror — better for CN networks.
   * `direct` hits GitHub API as-is.
   */
  updateSource: z.enum(["ghproxy", "direct"]).default("ghproxy"),
  /**
   * Optional ghproxy base, e.g. https://ghproxy.com/ or https://mirror.ghproxy.com/
   * Only used when updateSource is ghproxy.
   */
  updateProxyBase: z.string().default("https://ghproxy.com/"),
  /**
   * Preferred interactive terminal shell (Windows: powershell | pwsh | cmd).
   * Empty = auto (prefer powershell → pwsh → cmd).
   */
  terminalShell: z.enum(["", "powershell", "pwsh", "cmd"]).default(""),
  /**
   * Coding profiles (Kivio-style assistants, coding-only).
   * Empty array is allowed; runtime may seed defaults for UI.
   */
  codingProfiles: z.array(CodingProfileSchema).default([]),
  /** Active coding profile id; empty = none. */
  activeCodingProfileId: z.string().default(""),
  /** Optional model roles for title / compression (fallback = active chat model). */
  modelRoles: ModelRolesSchema.default({}),
  /** Progressive skill match / body inject prefs. */
  skillMatch: SkillMatchPrefsSchema.default({
    enabled: true,
    maxBodies: 2,
    maxBodyChars: 6_000,
  }),
  /**
   * Update ladder (1.1.7 L1+L2 · 1.1.8 L3). autoDownload / silentInstall default false.
   */
  updatePolicy: UpdatePolicySchema.default({
    autoCheck: true,
    autoDownload: false,
    checkIntervalHours: 24,
    silentInstall: false,
    silentInstallAcceptedAt: null,
  }),
});

export type UiPrefs = z.infer<typeof UiPrefsSchema>;

export const AppConfigSchema = z.object({
  version: z.literal(1).default(1),
  /**
   * Active provider id. Empty string when no providers remain (user deleted all channels).
   * First-run defaults come from `defaultAppConfig()`, not this field default alone.
   */
  activeProviderId: z.string().default(""),
  /** Active model id; empty when no providers / no selection. */
  activeModel: z.string().default(""),
  providers: z.array(ProviderConfigSchema).default([]),
  /** Most-recent first absolute workspace paths. */
  recentWorkspaces: z.array(z.string()).default([]),
  /** User MCP server registry; empty means desktop will seed package defaults once. */
  mcpServers: z.array(McpServerConfigSchema).default([]),
  /** Desktop UI / runtime preferences (Beta). */
  prefs: UiPrefsSchema.default({
    theme: "dark",
    proxyUrl: "",
    memoryEnabled: true,
    compactMaxChars: 48_000,
    usageInputPerMillion: 0,
    usageOutputPerMillion: 0,
    planModeDefault: false,
    permissionMode: "confirm_before_change",
    checkUpdatesOnStartup: true,
    updateSource: "ghproxy",
    updateProxyBase: "https://ghproxy.com/",
    terminalShell: "",
    codingProfiles: [],
    activeCodingProfileId: "",
    modelRoles: {},
    skillMatch: { enabled: true, maxBodies: 2, maxBodyChars: 6_000 },
    updatePolicy: {
      autoCheck: true,
      autoDownload: false,
      checkIntervalHours: 24,
      silentInstall: false,
      silentInstallAcceptedAt: null,
    },
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function defaultAppConfig(): AppConfig {
  return {
    version: 1,
    activeProviderId: "mock",
    activeModel: "mock-hfq",
    recentWorkspaces: [],
    mcpServers: [],
    prefs: {
      theme: "dark",
      proxyUrl: "",
      memoryEnabled: true,
      compactMaxChars: 48_000,
      usageInputPerMillion: 0,
      usageOutputPerMillion: 0,
      planModeDefault: false,
      permissionMode: "confirm_before_change",
      checkUpdatesOnStartup: true,
      updateSource: "ghproxy",
      updateProxyBase: "https://ghproxy.com/",
      terminalShell: "",
      codingProfiles: defaultCodingProfiles(),
      activeCodingProfileId: "",
      modelRoles: {},
      skillMatch: { enabled: true, maxBodies: 2, maxBodyChars: 6_000 },
      updatePolicy: {
        autoCheck: true,
        autoDownload: false,
        checkIntervalHours: 24,
        silentInstall: false,
        silentInstallAcceptedAt: null,
      },
    },
    providers: [
      {
        id: "mock",
        name: "Mock (offline)",
        kind: "mock",
        enabled: true,
        models: ["mock-hfq"],
        defaultModel: "mock-hfq",
      },
      {
        id: "openai-compatible",
        name: "OpenAI Compatible",
        kind: "openai_compatible",
        enabled: true,
        baseURL: "https://api.openai.com/v1",
        apiKey: "",
        models: ["gpt-4.1", "gpt-4o-mini"],
        defaultModel: "gpt-4.1",
      },
      {
        id: "anthropic",
        name: "Anthropic",
        kind: "anthropic",
        enabled: true,
        baseURL: "https://api.anthropic.com",
        apiKey: "",
        models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
        defaultModel: "claude-sonnet-4-20250514",
      },
    ],
  };
}

/**
 * Normalize a provider before persist (upsert).
 * - models: trim, drop empties, require ≥1
 * - defaultModel: default models[0]; must be in models
 * - openai_compatible / anthropic: require non-empty baseURL
 */
export function normalizeProviderConfig(provider: ProviderConfig): ProviderConfig {
  const id = String(provider.id ?? "").trim();
  if (!id) throw new Error("provider id required");
  const name = String(provider.name ?? id).trim() || id;
  const kind = provider.kind;
  const models = (provider.models ?? [])
    .map((m) => String(m ?? "").trim())
    .filter(Boolean);
  // de-dupe preserving order
  const seen = new Set<string>();
  const uniqueModels = models.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
  if (uniqueModels.length === 0) {
    throw new Error(`provider ${id}: models must contain at least one model id`);
  }
  let defaultModel = String(provider.defaultModel ?? "").trim();
  if (!defaultModel || !uniqueModels.includes(defaultModel)) {
    defaultModel = uniqueModels[0]!;
  }
  let baseURL = provider.baseURL?.trim() || undefined;
  if (baseURL) baseURL = baseURL.replace(/\/+$/, "");
  if (kind === "openai_compatible" || kind === "anthropic") {
    if (!baseURL) {
      throw new Error(`provider ${id}: baseURL is required for ${kind}`);
    }
  }
  return {
    id,
    name,
    kind,
    enabled: provider.enabled !== false,
    baseURL: kind === "mock" ? undefined : baseURL,
    apiKey: provider.apiKey,
    models: uniqueModels,
    defaultModel,
  };
}
