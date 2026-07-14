import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { connectHttpMcp } from "./http.js";
import { createMcpHost, mcpAgentToolName } from "./index.js";

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        }),
    ),
  );
});

function startFakeMcpHttp(): Promise<{ url: string; server: http.Server }> {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("method");
      return;
    }
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      let msg: { id?: string; method?: string; params?: Record<string, unknown> };
      try {
        msg = JSON.parse(body) as typeof msg;
      } catch {
        res.writeHead(400);
        res.end("bad json");
        return;
      }
      res.setHeader("content-type", "application/json");
      res.setHeader("mcp-session-id", "test-session");

      if (msg.method === "notifications/initialized") {
        res.writeHead(202);
        res.end();
        return;
      }
      if (msg.method === "initialize") {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "fake-http", version: "0.0.1" },
            },
          }),
        );
        return;
      }
      if (msg.method === "tools/list") {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              tools: [
                {
                  name: "demo.ping",
                  description: "ping",
                  inputSchema: {
                    type: "object",
                    properties: { text: { type: "string" } },
                  },
                },
              ],
            },
          }),
        );
        return;
      }
      if (msg.method === "tools/call") {
        const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
        const text = String(args.text ?? "pong");
        res.writeHead(200);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: { content: [{ type: "text", text: `echo:${text}` }] },
          }),
        );
        return;
      }
      res.writeHead(200);
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32601, message: `unknown method ${msg.method}` },
        }),
      );
    });
  });
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("bind failed"));
        return;
      }
      resolve({ url: `http://127.0.0.1:${addr.port}/mcp`, server });
    });
  });
}

describe("HTTP MCP client", () => {
  it("initializes, lists tools, and calls tools", async () => {
    const { url } = await startFakeMcpHttp();
    const session = await connectHttpMcp({ url, timeoutMs: 5_000 });
    expect(session.tools.map((t) => t.name)).toEqual(["demo.ping"]);
    const result = (await session.callTool("demo.ping", { text: "beta" })) as {
      content?: Array<{ text?: string }>;
    };
    expect(result.content?.[0]?.text).toBe("echo:beta");
    session.close();
  });

  it("host injects callable agent tools for HTTP transport", async () => {
    const { url } = await startFakeMcpHttp();
    const host = createMcpHost([
      {
        id: "remote",
        name: "Remote HTTP",
        transport: "http",
        url,
        enabled: true,
      },
    ]);
    const state = await host.connect("remote");
    expect(state.status).toBe("connected");
    expect(state.toolCount).toBe(1);

    const bundle = host.getAgentToolBundle();
    const name = mcpAgentToolName("remote", "demo.ping");
    expect(bundle.defs.map((d) => d.name)).toContain(name);
    const result = (await bundle.call(name, { text: "host" })) as {
      content?: Array<{ text?: string }>;
    };
    expect(result.content?.[0]?.text).toBe("echo:host");
    host.disconnect("remote");
  });
});
