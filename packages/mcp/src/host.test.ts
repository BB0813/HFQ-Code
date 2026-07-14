import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMcpHost, mcpAgentToolName } from "./index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("mcp host agent bundle", () => {
  it("exposes callable agent tools after real stdio connect", async () => {
    const fixture = path.join(here, "fixtures", "fake-mcp-server.mjs");
    const host = createMcpHost([
      {
        id: "fake",
        name: "Fake",
        transport: "stdio",
        command: process.execPath,
        args: [fixture],
        enabled: true,
        description: "test",
      },
    ]);
    const state = await host.connect("fake");
    expect(state.status).toBe("connected");
    expect(state.toolCount).toBe(2);

    const bundle = host.getAgentToolBundle();
    const echoName = mcpAgentToolName("fake", "demo.echo");
    expect(bundle.defs.map((d) => d.name)).toContain(echoName);

    const result = (await bundle.call(echoName, { text: "hi-mcp" })) as {
      content?: Array<{ text?: string }>;
    };
    expect(result.content?.[0]?.text).toBe("hi-mcp");

    host.disconnect("fake");
    expect(host.getAgentToolBundle().defs).toHaveLength(0);
  });
});
