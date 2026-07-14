import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultAppConfig,
  loadAppConfig,
  maskSecret,
  mergeProviderUpdate,
  publicConfigView,
  saveAppConfig,
  toPersistedMcpServers,
  touchRecentWorkspace,
  upsertProvider,
  withMcpServers,
  withPrefs,
} from "./index.js";

const temps: string[] = [];

afterEach(async () => {
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
    });
    expect(cfg.prefs.theme).toBe("light");
    expect(cfg.prefs.proxyUrl).toMatch(/7890/);
    expect(cfg.prefs.memoryEnabled).toBe(false);
    expect(cfg.prefs.compactMaxChars).toBe(48_000);
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
