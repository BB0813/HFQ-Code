import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { connectStdioMcp } from "./stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("stdio MCP client", () => {
  it("initializes and lists tools from a fake server", async () => {
    const fixture = path.join(here, "fixtures", "fake-mcp-server.mjs");
    const session = await connectStdioMcp({
      command: process.execPath,
      args: [fixture],
      timeoutMs: 8_000,
    });
    expect(session.tools.map((t) => t.name)).toEqual(["demo.echo", "demo.add"]);
    const echoed = (await session.callTool("demo.echo", { text: "hfq" })) as {
      content?: Array<{ text?: string }>;
    };
    expect(echoed.content?.[0]?.text).toBe("hfq");
    session.close();
  });

  it("times out when process never answers", async () => {
    // node -e "setInterval(()=>{}, 1e9)" never speaks JSON-RPC
    await expect(
      connectStdioMcp({
        command: process.execPath,
        args: ["-e", "setInterval(() => {}, 1e9)"],
        timeoutMs: 400,
      }),
    ).rejects.toThrow(/timeout/i);
  }, 10_000);
});

describe("spawn sanity", () => {
  it("can spawn node", () => {
    const child = spawn(process.execPath, ["-e", "process.exit(0)"], { windowsHide: true });
    expect(child.pid).toBeTruthy();
  });
});
