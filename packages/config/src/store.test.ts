import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultAppConfig,
  loadAppConfig,
  maskSecret,
  mergeProviderUpdate,
  publicConfigView,
  saveAppConfig,
  toPersistedMcpServers,
  touchRecentWorkspace,
  removeProvider,
  upsertProvider,
  withMcpServers,
  withPrefs,
} from "./index.js";

const temps: string[] = [];
const prevPlain = process.env.HFQ_CREDENTIALS_PLAIN;

// Store tests assert credentials.json plaintext shape; force plain encoding.
beforeEach(() => {
  process.env.HFQ_CREDENTIALS_PLAIN = "1";
});

afterEach(async () => {
  if (prevPlain === undefined) delete process.env.HFQ_CREDENTIALS_PLAIN;
  else process.env.HFQ_CREDENTIALS_PLAIN = prevPlain;
  await Promise.all(
    temps.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("config store", () => {
  it("creates default config when missing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    const cfg = await loadAppConfig(file);
    expect(cfg.activeProviderId).toBe("mock");
    expect(cfg.providers.some((p) => p.id === "mock")).toBe(true);
    expect(cfg.prefs?.theme).toBe("dark");
    const disk = JSON.parse(await fs.readFile(file, "utf8")) as { version: number };
    expect(disk.version).toBe(1);
  });

  it("merges UI prefs", () => {
    const cfg = withPrefs(defaultAppConfig(), {
      theme: "light",
      proxyUrl: "http://127.0.0.1:7890",
      memoryEnabled: false,
      terminalShell: "pwsh",
    });
    expect(cfg.prefs.theme).toBe("light");
    expect(cfg.prefs.proxyUrl).toMatch(/7890/);
    expect(cfg.prefs.memoryEnabled).toBe(false);
    expect(cfg.prefs.compactMaxChars).toBe(48_000);
    expect(cfg.prefs.terminalShell).toBe("pwsh");
    const auto = withPrefs(cfg, { terminalShell: "" });
    expect(auto.prefs.terminalShell).toBe("");
  });

  it("merges permissionMode and keeps planModeDefault in sync", () => {
    const cfg = withPrefs(defaultAppConfig(), {
      permissionMode: "auto_edit",
    });
    expect(cfg.prefs.permissionMode).toBe("auto_edit");
    expect(cfg.prefs.planModeDefault).toBe(false);

    const plan = withPrefs(cfg, { permissionMode: "plan" });
    expect(plan.prefs.permissionMode).toBe("plan");
    expect(plan.prefs.planModeDefault).toBe(true);

    const yolo = withPrefs(plan, { permissionMode: "full_access" });
    expect(yolo.prefs.permissionMode).toBe("full_access");
    expect(yolo.prefs.planModeDefault).toBe(false);
  });

  it("defaults update checks to ghproxy and merges update source prefs", () => {
    const base = defaultAppConfig();
    expect(base.prefs.updateSource).toBe("ghproxy");
    expect(base.prefs.updateProxyBase).toBe("https://ghproxy.com/");

    const direct = withPrefs(base, { updateSource: "direct" });
    expect(direct.prefs.updateSource).toBe("direct");
    expect(direct.prefs.updateProxyBase).toBe("https://ghproxy.com/");

    const custom = withPrefs(direct, {
      updateSource: "ghproxy",
      updateProxyBase: "https://mirror.ghproxy.com",
    });
    expect(custom.prefs.updateSource).toBe("ghproxy");
    expect(custom.prefs.updateProxyBase).toBe("https://mirror.ghproxy.com");

    const blankBase = withPrefs(custom, { updateProxyBase: "   " });
    expect(blankBase.prefs.updateProxyBase).toBe("https://ghproxy.com/");

    // invalid enum values are ignored; previous source kept / default applied
    const ignored = withPrefs(custom, {
      // @ts-expect-error intentional invalid value
      updateSource: "ftp",
    });
    expect(ignored.prefs.updateSource).toBe("ghproxy");
  });

  it("defaults and merges updatePolicy (1.1.7 L1+L2)", () => {
    const base = defaultAppConfig();
    expect(base.prefs.updatePolicy).toEqual({
      autoCheck: true,
      autoDownload: false,
      checkIntervalHours: 24,
      silentInstall: false,
      silentInstallAcceptedAt: null,
    });

    const on = withPrefs(base, {
      updatePolicy: {
        autoDownload: true,
        checkIntervalHours: 48,
        silentInstall: true,
        silentInstallAcceptedAt: "2026-07-20T00:00:00.000Z",
      },
    });
    expect(on.prefs.updatePolicy.autoCheck).toBe(true);
    expect(on.prefs.updatePolicy.autoDownload).toBe(true);
    expect(on.prefs.updatePolicy.checkIntervalHours).toBe(48);
    expect(on.prefs.updatePolicy.silentInstall).toBe(true);
    expect(on.prefs.updatePolicy.silentInstallAcceptedAt).toBe("2026-07-20T00:00:00.000Z");

    // Partial patch keeps previous values
    const partial = withPrefs(on, { updatePolicy: { autoDownload: false } });
    expect(partial.prefs.updatePolicy.autoDownload).toBe(false);
    expect(partial.prefs.updatePolicy.checkIntervalHours).toBe(48);
    expect(partial.prefs.updatePolicy.silentInstall).toBe(true);

    // Clamp hours to 1..168
    const low = withPrefs(base, { updatePolicy: { checkIntervalHours: 0 } });
    expect(low.prefs.updatePolicy.checkIntervalHours).toBe(1);
    const high = withPrefs(base, { updatePolicy: { checkIntervalHours: 999 } });
    expect(high.prefs.updatePolicy.checkIntervalHours).toBe(168);
    const rounded = withPrefs(base, { updatePolicy: { checkIntervalHours: 12.6 } });
    expect(rounded.prefs.updatePolicy.checkIntervalHours).toBe(13);

    // Empty / undefined patch preserves defaults
    const empty = withPrefs(base, { updatePolicy: undefined });
    expect(empty.prefs.updatePolicy.autoDownload).toBe(false);
    expect(empty.prefs.updatePolicy.autoCheck).toBe(true);
  });

  it("soft-migrates legacy planModeDefault into permissionMode on load", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    const raw = defaultAppConfig();
    await saveAppConfig(file, {
      ...raw,
      prefs: {
        ...raw.prefs,
        planModeDefault: true,
        // simulate pre-1.0.2 config without permissionMode field
      },
    });
    // rewrite disk without permissionMode key
    const disk = JSON.parse(await fs.readFile(file, "utf8")) as {
      prefs: Record<string, unknown>;
    };
    delete disk.prefs.permissionMode;
    disk.prefs.planModeDefault = true;
    await fs.writeFile(file, JSON.stringify(disk, null, 2), "utf8");

    const loaded = await loadAppConfig(file);
    expect(loaded.prefs.planModeDefault).toBe(true);
    expect(loaded.prefs.permissionMode).toBe("plan");
  });

  it("round-trips save/load and masks secrets in public view", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    let cfg = defaultAppConfig();
    cfg = upsertProvider(cfg, {
      id: "openai-compatible",
      name: "OpenAI Compatible",
      kind: "openai_compatible",
      enabled: true,
      baseURL: "https://example.com/v1",
      apiKey: "sk-test-secret-key-123456",
      models: ["gpt-test"],
      defaultModel: "gpt-test",
    });
    cfg.activeProviderId = "openai-compatible";
    cfg.activeModel = "gpt-test";
    await saveAppConfig(file, cfg);

    const loaded = await loadAppConfig(file);
    expect(loaded.providers.find((p) => p.id === "openai-compatible")?.apiKey).toBe(
      "sk-test-secret-key-123456",
    );

    // Secrets must not live in config.json after save
    const diskCfg = JSON.parse(await fs.readFile(file, "utf8")) as {
      providers: Array<{ id: string; apiKey?: string }>;
    };
    expect(diskCfg.providers.find((p) => p.id === "openai-compatible")?.apiKey || "").toBe("");
    const credRaw = await fs.readFile(path.join(dir, "credentials.json"), "utf8");
    expect(credRaw).toContain("sk-test-secret-key-123456");

    const pub = publicConfigView(loaded);
    const masked = pub.providers.find((p) => p.id === "openai-compatible")?.apiKey ?? "";
    expect(masked).not.toContain("secret-key");
    expect(maskSecret("sk-test-secret-key-123456")).toBe(masked);
  });

  it("migrates inline secrets from legacy config.json into credentials.json", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    const legacy = defaultAppConfig();
    legacy.providers = legacy.providers.map((p) =>
      p.id === "openai-compatible" ? { ...p, apiKey: "sk-legacy-inline-key-xyz" } : p,
    );
    legacy.mcpServers = [
      {
        id: "remote",
        name: "Remote",
        transport: "http",
        url: "https://mcp.example/rpc",
        headers: { authorization: "Bearer legacy-token-value", "x-tenant": "acme" },
        enabled: true,
      },
    ];
    await fs.writeFile(file, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");

    const loaded = await loadAppConfig(file);
    expect(loaded.providers.find((p) => p.id === "openai-compatible")?.apiKey).toBe(
      "sk-legacy-inline-key-xyz",
    );
    expect(loaded.mcpServers[0]?.headers?.authorization).toBe("Bearer legacy-token-value");
    expect(loaded.mcpServers[0]?.headers?.["x-tenant"]).toBe("acme");

    const disk = JSON.parse(await fs.readFile(file, "utf8")) as {
      providers: Array<{ apiKey?: string }>;
      mcpServers: Array<{ headers?: Record<string, string> }>;
    };
    expect(disk.providers.some((p) => (p.apiKey || "").includes("legacy"))).toBe(false);
    expect(disk.mcpServers[0]?.headers?.authorization).toBeUndefined();
    expect(disk.mcpServers[0]?.headers?.["x-tenant"]).toBe("acme");

    const creds = JSON.parse(await fs.readFile(path.join(dir, "credentials.json"), "utf8")) as {
      providerApiKeys: Record<string, string>;
      mcpHeaders: Record<string, Record<string, string>>;
    };
    expect(creds.providerApiKeys["openai-compatible"]).toBe("sk-legacy-inline-key-xyz");
    expect(creds.mcpHeaders.remote?.authorization).toBe("Bearer legacy-token-value");
  });

  it("publicConfigView masks MCP authorization headers", () => {
    const cfg = defaultAppConfig();
    cfg.mcpServers = [
      {
        id: "remote",
        name: "Remote",
        transport: "http",
        url: "https://mcp.example/rpc",
        headers: {
          authorization: "Bearer super-secret-token-value",
          "x-custom": "ok",
        },
        enabled: true,
      },
    ];
    const pub = publicConfigView(cfg);
    const headers = pub.mcpServers[0]?.headers ?? {};
    expect(headers.authorization).not.toContain("super-secret");
    expect(headers.authorization).toMatch(/…|\*{4,}/);
    expect(headers["x-custom"]).toBe("ok");
  });

  it("mergeProviderUpdate keeps real key when masked placeholder sent", () => {
    const existing = {
      id: "openai-compatible",
      name: "OpenAI Compatible",
      kind: "openai_compatible" as const,
      enabled: true,
      apiKey: "sk-real-key-abcdef",
      models: ["gpt-4.1"],
    };
    const merged = mergeProviderUpdate(existing, {
      id: "openai-compatible",
      apiKey: maskSecret("sk-real-key-abcdef"),
      baseURL: "https://new.example/v1",
    });
    expect(merged.apiKey).toBe("sk-real-key-abcdef");
    expect(merged.baseURL).toBe("https://new.example/v1");
  });

  it("touchRecentWorkspace dedupes and caps list", () => {
    let cfg = defaultAppConfig();
    cfg = touchRecentWorkspace(cfg, "C:\\proj\\a");
    cfg = touchRecentWorkspace(cfg, "C:\\proj\\b");
    cfg = touchRecentWorkspace(cfg, "C:\\proj\\a");
    expect(cfg.recentWorkspaces[0]?.toLowerCase()).toContain("proj\\a");
    expect(cfg.recentWorkspaces.length).toBe(2);
  });

  it("removeProvider drops channel and reassigns active", () => {
    let cfg = defaultAppConfig();
    cfg = upsertProvider(cfg, {
      id: "custom-zen",
      name: "Zen",
      kind: "openai_compatible",
      enabled: true,
      baseURL: "https://example.com/v1",
      models: ["m1"],
      defaultModel: "m1",
    });
    cfg.activeProviderId = "custom-zen";
    cfg.activeModel = "m1";
    cfg = removeProvider(cfg, "custom-zen");
    expect(cfg.providers.some((p) => p.id === "custom-zen")).toBe(false);
    expect(cfg.activeProviderId).not.toBe("custom-zen");
    expect(cfg.activeProviderId.length).toBeGreaterThan(0);
  });

  it("removeProvider can delete mock and last channel", () => {
    let cfg = defaultAppConfig();
    // strip down to mock only
    for (const id of cfg.providers.map((p) => p.id).filter((id) => id !== "mock")) {
      cfg = removeProvider(cfg, id);
    }
    expect(cfg.providers.map((p) => p.id)).toEqual(["mock"]);
    cfg = removeProvider(cfg, "mock");
    expect(cfg.providers).toEqual([]);
    expect(cfg.activeProviderId).toBe("");
    expect(cfg.activeModel).toBe("");
  });

  it("empty providers round-trips without resurrecting mock", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    let cfg = defaultAppConfig();
    for (const id of [...cfg.providers.map((p) => p.id)]) {
      cfg = removeProvider(cfg, id);
    }
    expect(cfg.providers).toEqual([]);
    await saveAppConfig(file, cfg);
    const loaded = await loadAppConfig(file);
    expect(loaded.providers).toEqual([]);
    expect(loaded.activeProviderId).toBe("");
    expect(loaded.activeModel).toBe("");
    // Second save/load still empty (fail-closed seed only on missing config file).
    await saveAppConfig(file, loaded);
    const again = await loadAppConfig(file);
    expect(again.providers).toEqual([]);
  });

  it("removeProvider does not resurrect deleted anthropic or mock on save/load", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    let cfg = defaultAppConfig();
    cfg = removeProvider(cfg, "anthropic");
    cfg = removeProvider(cfg, "mock");
    await saveAppConfig(file, cfg);
    const loaded = await loadAppConfig(file);
    expect(loaded.providers.some((p) => p.id === "anthropic")).toBe(false);
    expect(loaded.providers.some((p) => p.id === "mock")).toBe(false);
  });

  it("removeProvider drops credentials for deleted provider id", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    let cfg = defaultAppConfig();
    cfg = upsertProvider(cfg, {
      id: "temp-chan",
      name: "Temp",
      kind: "openai_compatible",
      enabled: true,
      baseURL: "https://example.com/v1",
      apiKey: "sk-temp-secret-key-9999",
      models: ["m-temp"],
      defaultModel: "m-temp",
    });
    await saveAppConfig(file, cfg);
    const credBefore = await fs.readFile(path.join(dir, "credentials.json"), "utf8");
    expect(credBefore).toContain("sk-temp-secret-key-9999");
    cfg = removeProvider(await loadAppConfig(file), "temp-chan");
    await saveAppConfig(file, cfg);
    const credAfter = await fs.readFile(path.join(dir, "credentials.json"), "utf8");
    expect(credAfter).not.toContain("sk-temp-secret-key-9999");
    expect(credAfter).not.toMatch(/temp-chan/);
  });

  it("upsertProvider rejects empty models and missing baseURL", () => {
    const cfg = defaultAppConfig();
    expect(() =>
      upsertProvider(cfg, {
        id: "bad",
        name: "Bad",
        kind: "openai_compatible",
        enabled: true,
        baseURL: "https://example.com/v1",
        models: [],
      }),
    ).toThrow(/models/i);
    expect(() =>
      upsertProvider(cfg, {
        id: "bad2",
        name: "Bad2",
        kind: "openai_compatible",
        enabled: true,
        models: ["m1"],
      }),
    ).toThrow(/baseURL/i);
  });

  it("round-trips mcpServers registry without runtime fields", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cfg-"));
    temps.push(dir);
    const file = path.join(dir, "config.json");
    let cfg = defaultAppConfig();
    cfg = withMcpServers(cfg, [
      {
        id: "custom",
        name: "Custom",
        transport: "stdio",
        command: "npx",
        args: ["-y", "demo"],
        enabled: true,
        description: "persist me",
      },
    ]);
    await saveAppConfig(file, cfg);
    const loaded = await loadAppConfig(file);
    expect(loaded.mcpServers).toHaveLength(1);
    expect(loaded.mcpServers[0]?.id).toBe("custom");
    expect(loaded.mcpServers[0]?.args).toEqual(["-y", "demo"]);
    // Runtime-only keys must not be required on disk.
    const disk = JSON.parse(await fs.readFile(file, "utf8")) as {
      mcpServers: Array<Record<string, unknown>>;
    };
    expect(disk.mcpServers[0]?.status).toBeUndefined();
    expect(toPersistedMcpServers(loaded.mcpServers)[0]?.command).toBe("npx");
  });
});
