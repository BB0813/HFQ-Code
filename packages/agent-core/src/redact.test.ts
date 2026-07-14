import { describe, expect, it } from "vitest";
import { redactJsonValue, redactSecrets } from "./redact.js";

describe("redactSecrets", () => {
  it("masks openai-style keys and bearer tokens", () => {
    expect(redactSecrets("key sk-abcdefghijklmnopqrstuv")).toMatch(/REDACTED/);
    expect(redactSecrets("Authorization: Bearer supersecrettokenvalue")).toMatch(/REDACTED/);
    expect(redactSecrets('api_key: "mysecretvalue123"')).toMatch(/REDACTED/);
  });

  it("redacts json fields", () => {
    const out = redactJsonValue({ apiKey: "sk-secret-key-value", nested: { token: "abcdefghi" } }) as {
      apiKey: string;
      nested: { token: string };
    };
    expect(out.apiKey).toBe("***REDACTED***");
    expect(out.nested.token).toBe("***REDACTED***");
  });
});
