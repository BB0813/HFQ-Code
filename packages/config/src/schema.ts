import { z } from "zod";

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
});

export type UiPrefs = z.infer<typeof UiPrefsSchema>;

export const AppConfigSchema = z.object({
  version: z.literal(1).default(1),
  activeProviderId: z.string().default("mock"),
  activeModel: z.string().default("mock-hfq"),
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
