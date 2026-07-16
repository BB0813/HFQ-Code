import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildDiagnosticsBundle } from "./diagnostics.js";
import { ensureDataDirs, hfqDataDir } from "./paths.js";

const cleanup: string[] = [];

afterEach(async () => {
  while (cleanup.length) {
    const d = cleanup.pop();
    if (d) await fs.rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe("buildDiagnosticsBundle", () => {
  it("exports redacted config and never credentials body", async () => {
    const dirs = await ensureDataDirs();
    const credPath = path.join(hfqDataDir(), "credentials.json");
    await fs.mkdir(path.dirname(credPath), { recursive: true });
    await fs.writeFile(
      credPath,
      JSON.stringify({
        version: 1,
        providerApiKeys: { p1: "sk-super-secret-value-here" },
        mcpHeaders: {},
      }),
      "utf8",
    );

    // plant a tiny session transcript with a secret-looking line
    const sess = path.join(dirs.sessions, "diag-test-session.jsonl");
    await fs.writeFile(
      sess,
      `${JSON.stringify({
        type: "message.completed",
        sessionId: "diag-test-session",
        messageId: "m1",
        role: "user",
        text: "use key sk-abcdefghijklmnopqrstuv please",
        at: new Date().toISOString(),
      })}\n`,
      "utf8",
    );

    const bundle = await buildDiagnosticsBundle({
      config: {
        providers: [{ id: "p1", name: "P", apiKey: "sk-should-redact-this-key" }],
        prefs: { theme: "dark" },
      },
      appVersion: "1.0.9-test",
      workspacePath: "D:/fake/ws",
      sessionBackend: "local",
      credentialsPath: credPath,
    });
    cleanup.push(bundle.dir);

    expect(bundle.files).toContain("meta.json");
    expect(bundle.files).toContain("config.redacted.json");
    expect(bundle.files).toContain("credentials.OMITTED.txt");
    expect(bundle.files).toContain("env.redacted.json");
    expect(bundle.files).toContain("README.txt");

    const allNames = await fs.readdir(bundle.dir);
    expect(allNames.some((n) => /credentials\.json/i.test(n))).toBe(false);

    const configRaw = await fs.readFile(path.join(bundle.dir, "config.redacted.json"), "utf8");
    expect(configRaw).not.toContain("sk-should-redact");
    expect(configRaw).toMatch(/REDACTED/);

    const meta = JSON.parse(await fs.readFile(path.join(bundle.dir, "meta.json"), "utf8")) as {
      credentials: { present: boolean };
      redaction: { version: number };
    };
    expect(meta.credentials.present).toBe(true);
    expect(meta.redaction.version).toBe(2);

    const omitted = await fs.readFile(path.join(bundle.dir, "credentials.OMITTED.txt"), "utf8");
    expect(omitted).toMatch(/never include/i);
    expect(omitted).not.toContain("sk-super-secret");

    // walk all files — no live secret fragments
    for (const name of allNames) {
      const full = path.join(bundle.dir, name);
      const st = await fs.stat(full);
      if (!st.isFile()) continue;
      const body = await fs.readFile(full, "utf8");
      expect(body).not.toContain("sk-super-secret-value-here");
      expect(body).not.toContain("sk-should-redact-this-key");
    }

    if (bundle.files.includes("session-sample.redacted.json")) {
      const sample = await fs.readFile(
        path.join(bundle.dir, "session-sample.redacted.json"),
        "utf8",
      );
      expect(sample).toMatch(/REDACTED|sk-\*\*\*/);
      expect(sample).not.toMatch(/sk-abcdefghijklmnop/);
    }
  });
});
