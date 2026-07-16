# HFQ Code — Architecture

## Goals

- Windows desktop coding agent with a complete GUI
- Reliable agent loop over a local workspace
- Pluggable models, skills, MCP, permissions
- Crash-safe sessions; clear audit trail

## Process model

```
┌──────────────────────────────────────────────┐
│  Electron Main                               │
│  window · IPC bridge · policy dialogs        │
│  config / credentials / MCP registry UI      │
│         │                                    │
│         ├── Renderer (React + Vite bundle)   │
│         │     dist/ · preload window.hfq     │
│         │                                    │
│         └── Session Worker (child Node)      │
│               SessionManager · agent loop    │
│               tools · transcript · providers │
│               (NDJSON RPC on stdio)          │
└──────────────────────────────────────────────┘
```

Phase-3 **M3.3**: desktop prefers `SessionWorkerHost` (child process). If spawn fails, falls back to in-process `SessionManager`. Worker crash emits `session.failed`; user reopens/creates a session.

## Monorepo layout

```
hfq-code/
  apps/
    desktop/                 # Electron main + preload + React renderer (Vite → dist)
  packages/
    shared/                  # types, events, zod schemas
    session-api/             # local RPC contract
    agent-core/              # agent loop, budgets, events
    tools/                   # fs, grep, apply_patch, shell, git
    skills/                  # SKILL.md loader + gates
    mcp/                     # MCP client host
    providers/               # OpenAI / Anthropic / compatible
    policy/                  # permissions + approval
    transcript/              # JSONL session store
    memory/                  # file-backed notes (Beta); vector brain later
  docs/
  skills/bundled/            # shipped skills
```

## Agent loop (coding-first)

```
assemble context:
  system + AGENTS.md + skill index + memory notes
  + transcript window (compacted if over budget) + tool schemas

while not done and under budget:
  optionally compactChatMessages()
  model → assistant message and/or tool calls
  for each tool call:
    policy.check → allow | ask | deny
    if ask: wait UI approval
    execute tool (workspace-scoped)
    append tool result (large results externalized to files)
  stream UI events (text, tool, todo, diff hints)
```

## Workspace binding

Each session is bound to one workspace root.

```
<workspace>/
  AGENTS.md                 # project rules (preferred)
  CLAUDE.md                 # imported if present (read-only)
  .cursorrules              # imported if present (read-only)
  .agents/skills/**/SKILL.md
  .hfq/                     # optional project-local state
```

Global:

```
%APPDATA%/HFQ-Code/
  config.json               # providers (no apiKey), recent workspaces, mcpServers (non-secret headers), prefs
  credentials.json          # providerApiKeys + MCP Authorization headers (M3.1)
  sessions/**/*.jsonl
  skills/                   # user-managed skills
  memory/                   # user + project scoped notes (Memory 2.0)
  logs/
```

## Event stream (UI contract)

Session emits typed events, for example:

- `session.started` / `session.completed` / `session.failed`
- `message.delta` / `message.completed`
- `tool.started` / `tool.completed` / `tool.failed`
- `permission.requested` / `permission.resolved`
- `diff.updated`
- `task.updated`
- `usage.updated`

## Security baseline

- Default: workspace write allowed; shell / network require approval
- Dangerous patterns scanned before shell execution
- No secrets in prompts or skill repos
- Transcript redaction hooks for API keys
- Renderer has no raw Node; tools only via daemon

## Extension points

| Extension | Mechanism |
|-----------|-----------|
| Skills | `SKILL.md` directories |
| MCP | stdio + HTTP (live tools/list + tools/call → agent `mcp__server__tool`) |
| Providers | adapter interface in `packages/providers` (mock, openai_compatible, anthropic) |
| Tools | register in tool hub with risk class |
| Memory | `@hfq/memory` file brain + `memory_search` / `memory_save` tools |

## Non-goals (v1)

- Multi-channel IM gateway
- Mobile companion nodes
- Full OpenClaw config parity
- Training / RL pipeline
