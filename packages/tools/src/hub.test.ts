import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createToolHub } from "./hub.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

async function makeWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hfq-tools-"));
  temps.push(dir);
  await fs.writeFile(path.join(dir, "note.txt"), "hello hfq\n", "utf8");
  await fs.mkdir(path.join(dir, "sub"));
  return dir;
}

describe("tool hub builtins", () => {
  it("lists builtin tools with risks", () => {
    const hub = createToolHub();
    const names = hub.list().map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "read_file",
        "read_document",
        "list_dir",
        "write_file",
        "grep",
        "apply_patch",
        "shell",
        "network_fetch",
        "git_status",
        "memory_search",
        "memory_save",
      ]),
    );
    expect(hub.riskOf("read_file")).toBe("low");
    expect(hub.riskOf("read_document")).toBe("low");
    expect(hub.riskOf("grep")).toBe("low");
    expect(hub.riskOf("git_status")).toBe("low");
    expect(hub.riskOf("memory_search")).toBe("low");
    expect(hub.riskOf("memory_save")).toBe("medium");
    expect(hub.riskOf("apply_patch")).toBe("medium");
    expect(hub.riskOf("network_fetch")).toBe("medium");
    expect(hub.riskOf("shell")).toBe("high");
  });

  it("read_document reads text and docx; rejects path escape", async () => {
    const zlib = await import("node:zlib");
    const { promisify } = await import("node:util");
    const deflateRaw = promisify(zlib.deflateRaw);

    const ws = await makeWorkspace();
    await fs.writeFile(path.join(ws, "readme.md"), "# hello document\nline2\n", "utf8");

    // Minimal store-method ZIP with word/document.xml (docx-like).
    const xml = Buffer.from(
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX body</w:t></w:r></w:p></w:body></w:document>',
      "utf8",
    );
    const name = Buffer.from("word/document.xml", "utf8");
    const local = Buffer.alloc(30 + name.length + xml.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method store
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14); // crc
    local.writeUInt32LE(xml.length, 18);
    local.writeUInt32LE(xml.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    xml.copy(local, 30 + name.length);
    // central directory + EOCD (not required by our simple reader, but makes a valid-ish file)
    const docxPath = path.join(ws, "sample.docx");
    await fs.writeFile(docxPath, local);

    const hub = createToolHub();
    const textRes = (await hub.execute("read_document", ws, { path: "readme.md" })) as {
      ok?: boolean;
      content?: string;
    };
    expect(textRes.ok).toBe(true);
    expect(textRes.content).toMatch(/hello document/i);

    const docxRes = (await hub.execute("read_document", ws, { path: "sample.docx" })) as {
      ok?: boolean;
      content?: string;
      format?: string;
    };
    expect(docxRes.ok).toBe(true);
    expect(docxRes.format).toBe("docx");
    expect(docxRes.content).toMatch(/Hello DOCX body/);

    await expect(
      hub.execute("read_document", ws, { path: "../outside.txt" }),
    ).rejects.toThrow(/escape|outside|workspace/i);

    void deflateRaw; // keep import used if store-only path above
  });

  it("network_fetch rejects non-http schemes and credentials", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    await expect(
      hub.execute("network_fetch", ws, { url: "file:///etc/passwd" }),
    ).rejects.toThrow(/only http\/https/);
    await expect(
      hub.execute("network_fetch", ws, { url: "https://user:pass@example.com/" }),
    ).rejects.toThrow(/credentials/);
    await expect(
      hub.execute("network_fetch", ws, { url: "http://169.254.169.254/latest/meta-data/" }),
    ).rejects.toThrow(/blocked|metadata|SSRF/i);
  });

  it("network_fetch can GET a local HTTP server", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("hfq-network-ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      server.close();
      throw new Error("failed to bind test server");
    }
    try {
      const result = (await hub.execute("network_fetch", ws, {
        url: `http://127.0.0.1:${addr.port}/`,
        method: "GET",
        timeoutMs: 5_000,
        maxBytes: 50_000,
      })) as { status: number; ok: boolean; body: string; url: string };
      expect(result.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.body).toContain("hfq-network-ok");
      expect(result.url).toMatch(/^https?:\/\//);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("applies multi-file patches inside workspace", async () => {
    const ws = await makeWorkspace();
    await fs.writeFile(path.join(ws, "note.txt"), "hello hfq\nline2\n", "utf8");
    const hub = createToolHub();
    const patch = [
      "*** Begin Patch",
      "*** Update File: note.txt",
      "@@",
      "-hello hfq",
      "+hello HFQ Code",
      " line2",
      "*** Add File: nested/from-patch.txt",
      "+patched",
      "*** End Patch",
    ].join("\n");
    const result = (await hub.execute("apply_patch", ws, { patch })) as {
      changeCount: number;
      changes: Array<{ path: string; kind: string; content: string | null }>;
    };
    expect(result.changeCount).toBe(2);
    expect(await fs.readFile(path.join(ws, "note.txt"), "utf8")).toContain("hello HFQ Code");
    expect(await fs.readFile(path.join(ws, "nested", "from-patch.txt"), "utf8")).toBe("patched");

    const delPatch = [
      "*** Begin Patch",
      "*** Delete File: nested/from-patch.txt",
      "*** End Patch",
    ].join("\n");
    await hub.execute("apply_patch", ws, { patch: delPatch });
    await expect(fs.access(path.join(ws, "nested", "from-patch.txt"))).rejects.toThrow();

    await expect(
      hub.execute("apply_patch", ws, {
        patch: "*** Begin Patch\n*** Add File: ../escape.txt\n+x\n*** End Patch",
      }),
    ).rejects.toThrow(/escapes workspace/);
  });

  it("greps text files inside workspace", async () => {
    const ws = await makeWorkspace();
    await fs.writeFile(path.join(ws, "sub", "code.ts"), "export const HFQ = 1;\n", "utf8");
    const hub = createToolHub();
    const found = (await hub.execute("grep", ws, {
      pattern: "HFQ",
      path: ".",
    })) as { matches: Array<{ path: string; line: number }>; matchCount: number };
    expect(found.matchCount).toBeGreaterThan(0);
    expect(found.matches.some((m) => m.path.includes("code.ts"))).toBe(true);
  });

  it("reads and lists files inside workspace", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    const read = (await hub.execute("read_file", ws, { path: "note.txt" })) as {
      content: string;
    };
    expect(read.content).toContain("hello hfq");

    const listed = (await hub.execute("list_dir", ws, { path: "." })) as {
      entries: Array<{ name: string }>;
    };
    expect(listed.entries.map((e) => e.name)).toEqual(
      expect.arrayContaining(["note.txt", "sub"]),
    );
  });

  it("writes files and refuses path escape", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    const created = (await hub.execute("write_file", ws, {
      path: "out/a.txt",
      content: "x",
    })) as { kind: string; previous: string | null; content: string };
    expect(created.kind).toBe("create");
    expect(created.previous).toBeNull();
    expect(created.content).toBe("x");

    const modified = (await hub.execute("write_file", ws, {
      path: "out/a.txt",
      content: "y",
    })) as { kind: string; previous: string | null };
    expect(modified.kind).toBe("modify");
    expect(modified.previous).toBe("x");

    const text = await fs.readFile(path.join(ws, "out/a.txt"), "utf8");
    expect(text).toBe("y");
    await expect(hub.execute("read_file", ws, { path: "../nope.txt" })).rejects.toThrow(
      /escapes workspace/,
    );
  });

  it("runs a safe shell command in workspace", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    const command =
      process.platform === "win32" ? "echo hfq-shell-ok" : "echo hfq-shell-ok";
    const result = (await hub.execute("shell", ws, { command, timeoutMs: 10_000 })) as {
      code: number | null;
      stdout: string;
    };
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("hfq-shell-ok");
  });

  it("git_status reports non-repo workspaces without throwing", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    const result = (await hub.execute("git_status", ws, {
      includeLog: false,
      timeoutMs: 10_000,
    })) as { isRepo: boolean; error?: string };
    expect(result.isRepo).toBe(false);
    expect(String(result.error || "")).toMatch(/not a git repository|fatal/i);
  });

  it("git_status returns branch and dirty entries for a real repo", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    const init = (await hub.execute("shell", ws, {
      command: "git init && git config user.email test@example.com && git config user.name hfq-test",
      timeoutMs: 15_000,
    })) as { code: number | null; stderr: string };
    // git init may print to stderr; success is exit 0
    expect(init.code).toBe(0);

    await fs.writeFile(path.join(ws, "tracked.txt"), "v1\n", "utf8");
    const add = (await hub.execute("shell", ws, {
      command: 'git add tracked.txt && git commit -m "init"',
      timeoutMs: 15_000,
    })) as { code: number | null };
    expect(add.code).toBe(0);

    await fs.writeFile(path.join(ws, "tracked.txt"), "v2\n", "utf8");
    await fs.writeFile(path.join(ws, "new.txt"), "new\n", "utf8");

    const status = (await hub.execute("git_status", ws, {
      includeLog: true,
      timeoutMs: 15_000,
    })) as {
      isRepo: boolean;
      dirty: boolean;
      branch: string;
      entries: Array<{ path: string; xy: string }>;
      recent?: Array<{ sha: string; subject: string }>;
      head?: string;
    };

    expect(status.isRepo).toBe(true);
    expect(status.dirty).toBe(true);
    expect(status.branch).toBeTruthy();
    expect(status.head).toBeTruthy();
    expect(status.entries.some((e) => e.path.includes("tracked.txt"))).toBe(true);
    expect(status.entries.some((e) => e.path.includes("new.txt"))).toBe(true);
    expect(status.recent?.length).toBeGreaterThan(0);
    expect(status.recent?.[0]?.subject).toMatch(/init/i);
  });

  it("git_show and git_commit work on a real repo", async () => {
    const ws = await makeWorkspace();
    const hub = createToolHub();
    const init = (await hub.execute("shell", ws, {
      command:
        "git init && git config user.email test@example.com && git config user.name hfq-test",
      timeoutMs: 15_000,
    })) as { code: number | null };
    expect(init.code).toBe(0);

    await fs.writeFile(path.join(ws, "a.txt"), "one\n", "utf8");
    const first = (await hub.execute("shell", ws, {
      command: 'git add a.txt && git commit -m "first"',
      timeoutMs: 15_000,
    })) as { code: number | null };
    expect(first.code).toBe(0);

    const show = (await hub.execute("git_show", ws, {
      object: "HEAD",
      timeoutMs: 15_000,
    })) as { isRepo: boolean; content: string };
    expect(show.isRepo).toBe(true);
    expect(show.content).toMatch(/first|a\.txt|one/i);

    await fs.writeFile(path.join(ws, "a.txt"), "two\n", "utf8");
    const committed = (await hub.execute("git_commit", ws, {
      message: "second via tool",
      paths: ["a.txt"],
      timeoutMs: 15_000,
    })) as { ok: boolean; sha: string | null; isRepo: boolean };
    expect(committed.isRepo).toBe(true);
    expect(committed.ok).toBe(true);
    expect(committed.sha).toBeTruthy();

    await expect(
      hub.execute("git_show", ws, { object: "HEAD; rm -rf /", timeoutMs: 5_000 }),
    ).rejects.toThrow(/unsafe/i);
  });
});
