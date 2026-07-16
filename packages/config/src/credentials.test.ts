import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  credentialsDiskEncoding,
  emptyCredentials,
  extractCredentials,
  isCredentialsEnvelope,
  loadCredentialsFile,
  mergeCredentials,
  saveCredentialsFile,
  stripSecretsForPublicConfig,
} from "./credentials.js";
import { shouldUseDpapi } from "./dpapi.js";
import { defaultAppConfig } from "./schema.js";

const temps: string[] = [];
const prevPlain = process.env.HFQ_CREDENTIALS_PLAIN;

beforeEach(() => {
  process.env.HFQ_CREDENTIALS_PLAIN = "1";
});

afterEach(async () => {
  if (prevPlain === undefined) delete process.env.HFQ_CREDENTIALS_PLAIN;
  else process.env.HFQ_CREDENTIALS_PLAIN = prevPlain;
  await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("credentials side-car", () => {
  it("saves and loads plaintext when HFQ_CREDENTIALS_PLAIN=1", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cred-"));
    temps.push(dir);
    const file = path.join(dir, "credentials.json");
    await saveCredentialsFile(file, {
      version: 1,
      providerApiKeys: { openai: "sk-test-plain" },
      mcpHeaders: { gh: { Authorization: "Bearer tok" } },
    });
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    expect(raw.version).toBe(1);
    expect(raw.providerApiKeys).toMatchObject({ openai: "sk-test-plain" });
    expect(isCredentialsEnvelope(raw)).toBe(false);

    const loaded = await loadCredentialsFile(file);
    expect(loaded.providerApiKeys.openai).toBe("sk-test-plain");
    expect(loaded.mcpHeaders.gh?.Authorization).toBe("Bearer tok");
    expect(await credentialsDiskEncoding(file)).toBe("plaintext");
  });

  it("returns empty credentials when file missing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cred-miss-"));
    temps.push(dir);
    const file = path.join(dir, "credentials.json");
    const loaded = await loadCredentialsFile(file);
    expect(loaded).toEqual(emptyCredentials());
    expect(await credentialsDiskEncoding(file)).toBe("missing");
  });

  it("extract / strip / merge round-trip", () => {
    const base = defaultAppConfig();
    const cfg = {
      ...base,
      providers: [
        {
          id: "p1",
          name: "P1",
          kind: "openai_compatible" as const,
          enabled: true,
          baseURL: "https://api.example.com",
          models: ["m"],
          defaultModel: "m",
          apiKey: "secret-key",
        },
      ],
      mcpServers: [
        {
          id: "mcp1",
          name: "MCP1",
          transport: "http" as const,
          url: "https://mcp.example.com",
          enabled: true,
          headers: { Authorization: "Bearer x", "x-tenant": "t1" },
        },
      ],
    };
    const creds = extractCredentials(cfg);
    expect(creds.providerApiKeys.p1).toBe("secret-key");
    expect(creds.mcpHeaders.mcp1?.Authorization).toBe("Bearer x");
    expect(creds.mcpHeaders.mcp1?.["x-tenant"]).toBeUndefined();

    const publicCfg = stripSecretsForPublicConfig(cfg);
    expect(publicCfg.providers[0]?.apiKey).toBe("");
    expect(publicCfg.mcpServers?.[0]?.headers?.Authorization).toBeUndefined();
    expect(publicCfg.mcpServers?.[0]?.headers?.["x-tenant"]).toBe("t1");

    const merged = mergeCredentials(publicCfg, creds);
    expect(merged.providers[0]?.apiKey).toBe("secret-key");
    expect(merged.mcpServers?.[0]?.headers?.Authorization).toBe("Bearer x");
    expect(merged.mcpServers?.[0]?.headers?.["x-tenant"]).toBe("t1");
  });
});

describe("credentials DPAPI envelope (Windows)", () => {
  it("encrypts on save and decrypts on load when DPAPI enabled", async () => {
    if (process.platform !== "win32") {
      expect(shouldUseDpapi()).toBe(false);
      return;
    }
    delete process.env.HFQ_CREDENTIALS_PLAIN;
    if (!shouldUseDpapi()) return;

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cred-dpapi-"));
    temps.push(dir);
    const file = path.join(dir, "credentials.json");
    await saveCredentialsFile(file, {
      version: 1,
      providerApiKeys: { p: "sk-dpapi-roundtrip" },
      mcpHeaders: {},
    });
    const rawText = await fs.readFile(file, "utf8");
    expect(rawText).not.toContain("sk-dpapi-roundtrip");
    const raw = JSON.parse(rawText) as unknown;
    expect(isCredentialsEnvelope(raw)).toBe(true);
    expect(await credentialsDiskEncoding(file)).toBe("dpapi-current-user");

    const loaded = await loadCredentialsFile(file);
    expect(loaded.providerApiKeys.p).toBe("sk-dpapi-roundtrip");
  }, 60_000);

  it("soft-migrates plaintext → DPAPI on next save", async () => {
    if (process.platform !== "win32") return;
    delete process.env.HFQ_CREDENTIALS_PLAIN;
    if (!shouldUseDpapi()) return;

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-cred-mig-"));
    temps.push(dir);
    const file = path.join(dir, "credentials.json");
    // Write plaintext without going through save (simulates old install).
    await fs.writeFile(
      file,
      JSON.stringify(
        { version: 1, providerApiKeys: { old: "legacy-key" }, mcpHeaders: {} },
        null,
        2,
      ),
      "utf8",
    );
    const first = await loadCredentialsFile(file);
    expect(first.providerApiKeys.old).toBe("legacy-key");
    expect(await credentialsDiskEncoding(file)).toBe("plaintext");

    await saveCredentialsFile(file, first);
    expect(await credentialsDiskEncoding(file)).toBe("dpapi-current-user");
    const disk = await fs.readFile(file, "utf8");
    expect(disk).not.toContain("legacy-key");
    const again = await loadCredentialsFile(file);
    expect(again.providerApiKeys.old).toBe("legacy-key");
  }, 60_000);
});
