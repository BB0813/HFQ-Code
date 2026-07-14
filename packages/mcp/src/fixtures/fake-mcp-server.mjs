/**
 * Minimal newline-delimited JSON-RPC MCP fake for unit tests.
 */
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  if (msg.method === "initialize") {
    reply(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "fake-mcp", version: "0.0.1" },
    });
    return;
  }
  if (msg.method === "notifications/initialized") return;
  if (msg.method === "tools/list") {
    reply(msg.id, {
      tools: [
        {
          name: "demo.echo",
          description: "Echo text",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
        {
          name: "demo.add",
          description: "Add two numbers",
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" },
            },
          },
        },
      ],
    });
    return;
  }
  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    const args = msg.params?.arguments || {};
    if (name === "demo.echo") {
      reply(msg.id, {
        content: [{ type: "text", text: String(args.text ?? "") }],
      });
      return;
    }
    if (name === "demo.add") {
      const sum = Number(args.a || 0) + Number(args.b || 0);
      reply(msg.id, {
        content: [{ type: "text", text: String(sum) }],
      });
      return;
    }
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32601, message: `unknown tool ${name}` },
      })}\n`,
    );
  }
});
