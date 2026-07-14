# HFQ Code — Beta scope

Last updated: 2026-07-14

## Goal

Ship a **usable Windows desktop coding agent Beta**: open a workspace, run multi-turn sessions with real tools, review diffs, govern permissions, and recover after restart — without IM gateway or Phase-2 polish.

## Beta deliverables (checklist)

| Area | Status |
|------|--------|
| Electron shell + Chinese UI pages | Done |
| Session create / resume / stop / delete / rename / auto-title | Done |
| Streaming chat + cumulative token usage | Done |
| Tools: read/list/grep/write/patch/shell/network/git_status | Done |
| Tools: memory_search / memory_save (local notes) | Done |
| Context compaction for long histories | Done |
| Permissions matrix + session allows + audit filter/export | Done |
| Changes file + hunk accept/reject | Done |
| Terminal re-run · Tasks retry | Done |
| Skills load (workspace / user / bundled) | Done |
| MCP stdio live tools/list + tools/call | Done |
| MCP HTTP live tools/list + tools/call (JSON-RPC POST) | Done |
| MCP registry persisted in config.json | Done |
| Models: mock / OpenAI-compatible / Anthropic | Done |
| Settings: data dirs, session manage, theme/proxy/prefs | Done |
| Crash-safe JSONL transcripts | Done |
| Workspace path escape rejection | Done |
| Headless smoke + vitest suite | Done |

## Explicitly not Beta (Phase-2+)

- Vector / embedding memory brain, sub-agents panel
- Full import wizard (OpenClaw / Claude / Cursor bulk migrate)
- OAuth / Streamable-HTTP MCP advanced transports
- Packaged electron-builder installer & auto-updater
- Cost dashboard / eval lab

## Verify

```bash
pnpm install
pnpm -r run build
pnpm test
pnpm smoke
pnpm dev:desktop
```

## Data layout

```
%APPDATA%/HFQ-Code/
  config.json          # providers, mcpServers, prefs
  sessions/*.jsonl
  skills/
  memory/notes.json
  logs/
```
