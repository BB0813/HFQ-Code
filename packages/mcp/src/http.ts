/**
 * Minimal HTTP MCP client (JSON-RPC over POST).
 * Supports plain JSON responses and simple SSE `data:` frames.
 * Not a full Streamable-HTTP / OAuth implementation — enough for Beta remote MCP.
 */

import { randomUUID } from "node:crypto";
import type { McpRemoteTool } from "./stdio.js";

export interface HttpMcpSession {
  tools: McpRemoteTool[];
  callTool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  close(): void;
}

function extractJsonObjects(text: string): unknown[] {
  const out: unknown[] = [];
  const trimmed = text.trim();
  if (!trimmed) return out;
  // SSE: lines of `data: {...}`
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split(/\r?\n/)) {
      const m = line.match(/^\s*data:\s*(.+)\s*$/);
      if (!m?.[1] || m[1] === "[DONE]") continue;
      try {
        out.push(JSON.parse(m[1]));
      } catch {
        /* skip */
      }
    }
    if (out.length) return out;
  }
  // NDJSON
  if (trimmed.includes("\n") && !trimmed.startsWith("{")) {
    for (const line of trimmed.split(/\r?\n/)) {
      const l = line.trim();
      if (!l) continue;
      try {
        out.push(JSON.parse(l));
      } catch {
        /* skip */
      }
    }
    if (out.length) return out;
  }
  try {
    out.push(JSON.parse(trimmed));
  } catch {
    /* ignore */
  }
  return out;
}

function pickResult(payloads: unknown[], id: string): unknown {
  for (const p of payloads) {
    if (!p || typeof p !== "object") continue;
    const rec = p as Record<string, unknown>;
    if (rec.id !== undefined && String(rec.id) !== id) continue;
    if (rec.error) {
      const e = rec.error as { message?: string; code?: number };
      throw new Error(e.message || `JSON-RPC error ${e.code ?? ""}`);
    }
    if ("result" in rec) return rec.result;
  }
  // Some gateways omit id echo — take first result-bearing object.
  for (const p of payloads) {
    if (!p || typeof p !== "object") continue;
    const rec = p as Record<string, unknown>;
    if (rec.error) {
      const e = rec.error as { message?: string; code?: number };
      throw new Error(e.message || `JSON-RPC error ${e.code ?? ""}`);
    }
    if ("result" in rec) return rec.result;
  }
  throw new Error("HTTP MCP response missing result");
}

export async function connectHttpMcp(opts: {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}): Promise<HttpMcpSession> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  let closed = false;
  let sessionId: string | undefined;

  const baseHeaders: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(opts.headers ?? {}),
  };

  const request = async (method: string, params?: Record<string, unknown>) => {
    if (closed) throw new Error("MCP session closed");
    const id = randomUUID();
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { ...baseHeaders };
      if (sessionId) headers["mcp-session-id"] = sessionId;

      const res = await fetch(opts.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      const sid = res.headers.get("mcp-session-id") || res.headers.get("Mcp-Session-Id");
      if (sid) sessionId = sid;

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP MCP ${method} failed: ${res.status} ${text.slice(0, 300)}`);
      }
      const payloads = extractJsonObjects(text);
      if (!payloads.length) {
        throw new Error(`HTTP MCP ${method}: empty/unparsed response`);
      }
      return pickResult(payloads, id);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`HTTP MCP ${method} timeout after ${timeoutMs}ms`);
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  };

  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "hfq-code", version: "0.2.0-beta" },
  });

  // Best-effort initialized notification (some servers ignore).
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 5_000));
    const headers: Record<string, string> = { ...baseHeaders };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    await fetch(opts.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      signal: controller.signal,
    }).catch(() => undefined);
    clearTimeout(timer);
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

  return {
    tools,
    callTool: async (name, args = {}) =>
      request("tools/call", {
        name,
        arguments: args,
      }),
    close: () => {
      closed = true;
    },
  };
}
