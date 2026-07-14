import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

export interface McpRemoteTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface StdioMcpSession {
  tools: McpRemoteTool[];
  callTool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  close(): void;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Minimal MCP client over stdio JSON-RPC:
 * initialize → tools/list → tools/call.
 */
export async function connectStdioMcp(opts: {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<StdioMcpSession> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const child: ChildProcessWithoutNullStreams = spawn(opts.command, opts.args ?? [], {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let buffer = "";
  const pending = new Map<string | number, Pending>();
  let closed = false;
  let stderrTail = "";

  const failAll = (err: Error) => {
    for (const [, p] of pending) p.reject(err);
    pending.clear();
  };

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  };

  child.stderr.on("data", (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString("utf8")).slice(-2000);
  });

  child.on("error", (err) => {
    failAll(err instanceof Error ? err : new Error(String(err)));
    closed = true;
  });

  child.on("close", (code) => {
    if (!closed) {
      failAll(
        new Error(
          `MCP process exited (${code ?? "?"})${stderrTail ? `: ${stderrTail.slice(0, 400)}` : ""}`,
        ),
      );
    }
    closed = true;
  });

  const onMessage = (msg: Record<string, unknown>) => {
    if (msg.id !== undefined && msg.id !== null && pending.has(msg.id as string | number)) {
      const p = pending.get(msg.id as string | number)!;
      pending.delete(msg.id as string | number);
      if (msg.error) {
        const e = msg.error as { message?: string; code?: number };
        p.reject(new Error(e.message || `JSON-RPC error ${e.code ?? ""}`));
      } else {
        p.resolve(msg.result);
      }
      return;
    }
    // notifications ignored for inventory phase
  };

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        onMessage(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // Some servers may emit non-JSON logs on stdout; skip.
      }
    }
  });

  const request = (method: string, params?: Record<string, unknown>) =>
    new Promise<unknown>((resolve, reject) => {
      if (closed) {
        reject(new Error("MCP session closed"));
        return;
      }
      const id = randomUUID();
      pending.set(id, { resolve, reject });
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        ...(params ? { params } : {}),
      });
      try {
        child.stdin.write(`${payload}\n`);
      } catch (err) {
        pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(
            new Error(
              `MCP ${method} timeout after ${timeoutMs}ms${
                stderrTail ? ` · stderr: ${stderrTail.slice(0, 300)}` : ""
              }`,
            ),
          );
        }
      }, timeoutMs);
    });

  try {
    await request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "hfq-code", version: "0.1.0" },
    });
    // Best-effort notification; ignore failures.
    try {
      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        })}\n`,
      );
    } catch {
      /* ignore */
    }

    const listed = (await request("tools/list", {})) as {
      tools?: Array<{
        name?: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }>;
    };
    const tools: McpRemoteTool[] = (listed?.tools ?? [])
      .filter((t) => t?.name)
      .map((t) => ({
        name: String(t.name),
        description: t.description,
        inputSchema: t.inputSchema,
      }));

    const callTool = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await request("tools/call", {
        name,
        arguments: args,
      });
      return result;
    };

    return {
      tools,
      callTool,
      close,
    };
  } catch (err) {
    close();
    throw err;
  }
}
