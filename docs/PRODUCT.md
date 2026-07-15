# HFQ Code — Product Map

## One-liner

**HFQ Code** is a Windows desktop coding agent: open a workspace, run agent sessions, review diffs, manage skills/MCP/models, with permissions and audit built in.

## Phase-1 pages

| Page | Primary jobs |
|------|----------------|
| **Home** | Recent workspaces, continue / rename / delete session, new task |
| **Chat / Session** | Streaming chat, tool trace, interrupt, rename, token usage totals |
| **Changes** | File diff list, accept/reject all or selected hunks, open file |
| **Terminal** | Session-linked terminal, re-run, approval for commands |
| **Tasks** | Multi-step task list, status, retry |
| **Skills** | Installed list + **商店** tab (ClawHub scaffold); local folder install; open folder |
| **MCP** | Server list (persisted in config.json), connect status, tool inventory; live **stdio + HTTP** tools inject as `mcp__*` |
| **Models** | Providers, API keys, default/fallback models |
| **Permissions** | Tool risk matrix; ask/allow/deny; session overrides |
| **Audit** | Timeline of tools + approvals; filter by category; copy/export JSONL; restore on session open |
| **Settings** | Data dirs, session delete, theme/proxy/memory prefs, runtime summary |

## Beta additions (beyond Phase-1 map)

- Local **memory** notes (`memory_search` / `memory_save`, `%APPDATA%/HFQ-Code/memory`)
- **Context compaction** for long multi-turn sessions
- **HTTP MCP** JSON-RPC client (tools/list + tools/call)

## Phase-2 pages (shipped in 1.0)

- **Memory** — user/project scope + retrieval UI (BM25; embedding optional later)
- **Import** — OpenClaw / Claude / Cursor rules wizard
- Sub-agents via Chat + Tasks (`spawn_subagent`, explore/edit/shell)
- **Usage** — token / cost dashboard
- Eval lab: `pnpm eval` (headless)

## 1.0.0 notes

- Secrets: `credentials.json` · Session **worker** process · Manual packaging channel  
- Evidence: [PHASE3-STATUS.md](./PHASE3-STATUS.md) · [PACKAGING.md](./PACKAGING.md) · [CHANGELOG.md](../CHANGELOG.md)

完整里程碑见 **[PHASE2.md](./PHASE2.md)** · **[PHASE2-STATUS.md](./PHASE2-STATUS.md)** · 审计 **[AUDIT.md](./AUDIT.md)** · Phase-3 **[PHASE3.md](./PHASE3.md)**。

## Core user loops

1. **Implement feature** — Chat → tools edit → Diff review → Terminal test  
2. **Fix bug** — paste error → agent investigates → patch → verify  
3. **Extend agent** — install skill / enable MCP → use in session  
4. **Govern** — tighten permissions → audit risky shell  

## Success metrics (engineering)

- Session crash recovery rate
- Time-to-first-successful-edit
- Permission false-block rate
- Skill load success rate
- Median tool-round latency
