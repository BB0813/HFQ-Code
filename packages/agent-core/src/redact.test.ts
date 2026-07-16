import { describe, expect, it } from "vitest";
import {
  isSensitiveKeyName,
  redactEnvSnapshot,
  redactJsonValue,
  redactSecrets,
} from "./redact.js";

describe("redactSecrets", () => {
  it("masks openai-style keys and bearer tokens", () => {
    expect(redactSecrets("key sk-abcdefghijklmnopqrstuv")).toMatch(/REDACTED/);
    expect(redactSecrets("Authorization: Bearer supersecrettokenvalue")).toMatch(/REDACTED/);
    expect(redactSecrets('api_key: "mysecretvalue123"')).toMatch(/REDACTED/);
  });

  it("masks github / slack / aws / jwt / pem", () => {
    expect(redactSecrets("tok ghp_abcdefghijklmnopqrstuvwx")).toMatch(/REDACTED/);
    expect(redactSecrets("github_pat_11AAAAAAAAaaaaaaaaaa_bbbbbbbbbbbb")).toMatch(/REDACTED/);
    expect(redactSecrets("xoxb-1234567890-abcdefghij")).toMatch(/REDACTED/);
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).toMatch(/REDACTED/);
    expect(
      redactSecrets(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepart",
      ),
    ).toMatch(/REDACTED/);
    expect(
      redactSecrets(
        "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg\n-----END PRIVATE KEY-----",
      ),
    ).toMatch(/REDACTED/);
  });

  it("masks url userinfo passwords", () => {
    expect(redactSecrets("https://user:s3cretPass@host/path")).toMatch(/\*\*\*REDACTED\*\*\*/);
    expect(redactSecrets("https://user:s3cretPass@host/path")).not.toContain("s3cretPass");
  });

  it("redacts json fields by key name", () => {
    const out = redactJsonValue({
      apiKey: "sk-secret-key-value",
      nested: { token: "abcdefghi", clientSecret: "supersecretvalue" },
      ok: "plain",
    }) as {
      apiKey: string;
      nested: { token: string; clientSecret: string };
      ok: string;
    };
    expect(out.apiKey).toBe("***REDACTED***");
    expect(out.nested.token).toBe("***REDACTED***");
    expect(out.nested.clientSecret).toBe("***REDACTED***");
    expect(out.ok).toBe("plain");
  });

  it("detects sensitive key names", () => {
    expect(isSensitiveKeyName("apiKey")).toBe(true);
    expect(isSensitiveKeyName("refresh_token")).toBe(true);
    expect(isSensitiveKeyName("workspacePath")).toBe(false);
  });

  it("env snapshot never leaks secret values", () => {
    const snap = redactEnvSnapshot({
      PATH: "/usr/bin",
      OPENAI_API_KEY: "sk-live-should-not-appear",
      HTTP_PROXY: "http://user:pass@proxy:8080",
      HFQ_CUSTOM_SECRET: "nope",
    } as NodeJS.ProcessEnv);
    expect(snap.PATH).toBe("/usr/bin");
    expect(snap.OPENAI_API_KEY).toBe(true);
    expect(String(snap.HTTP_PROXY)).not.toContain("pass");
    expect(snap.HFQ_CUSTOM_SECRET).toBe(true);
    expect(JSON.stringify(snap)).not.toContain("sk-live");
    expect(JSON.stringify(snap)).not.toContain("nope");
  });
});
