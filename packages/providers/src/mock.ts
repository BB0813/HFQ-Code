import { randomUUID } from "node:crypto";
import type { ChatRequest, ChatResult, ModelProvider, ToolCall } from "./types.js";

function lastUserText(req: ChatRequest): string {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  return lastUser?.content ?? "";
}

function hasToolResult(req: ChatRequest, name: string): boolean {
  return req.messages.some((m) => m.role === "tool" && m.name === name);
}

function toolCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: randomUUID(), name, arguments: args };
}

/**
 * Offline provider for UI/dev without API keys.
 * Understands simple demo intents so the full tool/permission path can be exercised.
 */
export function createMockProvider(): ModelProvider {
  return {
    id: "mock",
    async chat(req: ChatRequest): Promise<ChatResult> {
      const text = lastUserText(req).trim();
      const lower = text.toLowerCase();
      const available = new Set((req.tools ?? []).map((t) => t.name));

      // After a tool result (mid-turn), summarize — not when the latest turn is a new user message.
      const lastMsg = req.messages[req.messages.length - 1];
      if (lastMsg?.role === "tool") {
        const body = lastMsg.content ?? "";
        return {
          message: `[mock] Tool finished.\n\n\`\`\`json\n${body.slice(0, 2500)}\n\`\`\`\n\nConnect a real model in Models for full coding agent behavior.`,
          toolCalls: [],
          usage: { inputTokens: 0, outputTokens: 32 },
        };
      }

      // Demo intents → tool calls
      if (available.has("list_dir") && /\b(list|ls|dir|目录|列出)\b/i.test(text) && !hasToolResult(req, "list_dir")) {
        const pathMatch = text.match(/(?:path|目录)\s*[:=]?\s*(\S+)/i);
        return {
          message: "Listing workspace directory…",
          toolCalls: [toolCall("list_dir", { path: pathMatch?.[1] ?? "." })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (available.has("read_file") && /\b(read|cat|打开|读取)\b/i.test(text) && !hasToolResult(req, "read_file")) {
        const pathMatch =
          text.match(/(?:read|cat|读取|打开)\s+[`"]?([^\s`"]+)[`"]?/i) ??
          text.match(/(?:path|文件)\s*[:=]?\s*(\S+)/i);
        const filePath = pathMatch?.[1] ?? "README.md";
        return {
          message: `Reading \`${filePath}\`…`,
          toolCalls: [toolCall("read_file", { path: filePath })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (
        available.has("write_file") &&
        /\b(write|create|写|创建)\b/i.test(text) &&
        !hasToolResult(req, "write_file")
      ) {
        const pathMatch = text.match(/(?:to|path|文件)\s*[:=]?\s*([^\s]+)/i);
        const filePath = pathMatch?.[1] ?? "hfq-demo.txt";
        return {
          message: `Writing \`${filePath}\` (will request permission)…`,
          toolCalls: [
            toolCall("write_file", {
              path: filePath,
              content: `# HFQ Code demo\n\nCreated by mock provider at ${new Date().toISOString()}\n\nPrompt:\n${text}\n`,
            }),
          ],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (available.has("shell") && /\b(shell|run|exec|命令|执行)\b/i.test(text) && !hasToolResult(req, "shell")) {
        const cmdMatch = text.match(/(?:shell|run|exec|命令|执行)\s*[:=]?\s*(.+)$/i);
        const command =
          cmdMatch?.[1]?.trim() ||
          (process.platform === "win32" ? "cd && dir" : "pwd && ls");
        return {
          message: "Running shell command (permission required)…",
          toolCalls: [toolCall("shell", { command })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (
        available.has("apply_patch") &&
        /\b(apply_patch|patch|补丁)\b/i.test(text) &&
        !hasToolResult(req, "apply_patch")
      ) {
        const patch = [
          "*** Begin Patch",
          "*** Add File: hfq-patch-demo.txt",
          "+# HFQ patch demo",
          `+Created by mock apply_patch at ${new Date().toISOString()}`,
          "*** End Patch",
        ].join("\n");
        return {
          message: "Applying demo patch (will request permission)…",
          toolCalls: [toolCall("apply_patch", { patch })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (
        available.has("network_fetch") &&
        /\b(fetch|http|curl|请求|下载)\b/i.test(text) &&
        !hasToolResult(req, "network_fetch")
      ) {
        const urlMatch = text.match(/https?:\/\/\S+/i);
        const url = urlMatch?.[0] ?? "https://example.com";
        return {
          message: `Fetching \`${url}\` (will request permission)…`,
          toolCalls: [toolCall("network_fetch", { url, method: "GET" })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (
        available.has("grep") &&
        /\b(grep|search|find|搜索|查找)\b/i.test(text) &&
        !hasToolResult(req, "grep")
      ) {
        const patMatch =
          text.match(/(?:grep|search|搜索|查找)\s+[`"]?([^`"\n]+)[`"]?/i) ??
          text.match(/(?:pattern|关键词)\s*[:=]?\s*(\S+)/i);
        const pattern = (patMatch?.[1] || "HFQ").trim();
        return {
          message: `Searching for \`${pattern}\`…`,
          toolCalls: [toolCall("grep", { pattern, path: "." })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (
        available.has("git_status") &&
        /\b(git\s*status|git_status|分支|仓库状态|version control)\b/i.test(text) &&
        !hasToolResult(req, "git_status")
      ) {
        return {
          message: "Checking git status…",
          toolCalls: [toolCall("git_status", { includeLog: true })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (
        available.has("memory_save") &&
        /\b(remember|memory_save|记住|记下|保存记忆)\b/i.test(text) &&
        !hasToolResult(req, "memory_save")
      ) {
        const note =
          text.replace(/\b(remember|memory_save|记住|记下|保存记忆)\b/i, "").trim() || text;
        return {
          message: "Saving a memory note…",
          toolCalls: [toolCall("memory_save", { text: note.slice(0, 2000), source: "user" })],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      if (
        available.has("memory_search") &&
        /\b(memory_search|recall|回忆|记忆搜索)\b/i.test(text) &&
        !hasToolResult(req, "memory_search")
      ) {
        const qMatch =
          text.match(/(?:memory_search|recall|回忆|记忆搜索)\s+(.+)$/i) ??
          text.match(/(?:query|关于)\s*[:=]?\s*(.+)$/i);
        return {
          message: "Searching local memory…",
          toolCalls: [
            toolCall("memory_search", {
              query: (qMatch?.[1] || text).trim().slice(0, 200),
            }),
          ],
          usage: { inputTokens: 0, outputTokens: 16 },
        };
      }

      // Live MCP tools injected as mcp__server__tool — demo intent for offline tests.
      if (/\b(mcp|mcp_echo)\b/i.test(text)) {
        const mcpTool =
          [...available].find((n) => n.startsWith("mcp__") && n.includes("echo")) ??
          [...available].find((n) => n.startsWith("mcp__"));
        if (mcpTool && !hasToolResult(req, mcpTool)) {
          const textMatch = text.match(/(?:text|echo)\s*[:=]?\s*(.+)$/i);
          return {
            message: `Calling MCP tool \`${mcpTool}\`…`,
            toolCalls: [
              toolCall(mcpTool, {
                text: (textMatch?.[1] || "hello-mcp").trim(),
              }),
            ],
            usage: { inputTokens: 0, outputTokens: 16 },
          };
        }
      }

      if (/\b(help|帮助|怎么用)\b/i.test(lower) || text.length < 2) {
        return {
          message: [
            "[mock] HFQ Code session is live (offline mock model).",
            "",
            "Try:",
            "- `list` — list workspace root",
            "- `read README.md` — read a file",
            "- `grep HFQ` / `搜索 HFQ` — search workspace",
            "- `git status` / `仓库状态` — read-only git_status",
            "- `记住 prefer tabs` / `memory_search tabs` — local memory",
            "- `write demo to hfq-demo.txt` — write file (asks permission)",
            "- `patch` / `补丁` — apply_patch demo (asks permission)",
            "- `fetch https://example.com` — network_fetch (asks permission)",
            "- `shell echo hello` — run shell (asks permission)",
            "- `mcp_echo hello` — call injected mcp__* tool if connected",
            "",
            "Switch to a real provider in Models when ready.",
          ].join("\n"),
          toolCalls: [],
          usage: { inputTokens: 0, outputTokens: 48 },
        };
      }

      const reply = [
        `[mock] Got your message (${req.messages.length} turns in context):`,
        "",
        text.slice(0, 800),
        "",
        "Tip: say `list`, `read README.md`, `grep …`, `git status`, `write …`, or `shell …` to exercise tools.",
      ].join("\n");
      if (req.onDelta) {
        // Simulate streaming for UI path.
        const mid = Math.max(1, Math.floor(reply.length / 2));
        await req.onDelta(reply.slice(0, mid));
        await req.onDelta(reply.slice(mid));
      }
      return {
        message: reply,
        toolCalls: [],
        usage: { inputTokens: 0, outputTokens: 40 },
      };
    },
  };
}
