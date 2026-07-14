# Product Decisions (Frozen)

Last updated: 2026-07-14

## Positioning

Windows-first **desktop coding agent** (WorkBuddy / ZCode class), not an IM personal assistant gateway.

- Primary job: plan → edit → run → review code in a local workspace
- Shell: full GUI with complete product pages
- References: OpenClaw (skills/protocol), Hermes (memory/growth) — capability sources, not UI clones

## Q1 — Runtime language

**Choice: C (recommended path)**

| Layer | Stack |
|-------|--------|
| Desktop shell | Electron + TypeScript |
| Agent runtime (MVP) | TypeScript, in-process / local session process |
| Future brain | Optional Python sidecar behind a stable interface |

Rationale: GUI and coding tools ship faster in TS; heavy memory/indexing can split out later without rewriting the shell.

## Q2 — Compatibility pack

**Choice: X (recommended default pack)**

| Dimension | Level | Notes |
|-----------|-------|--------|
| Skills | S1 + light S2 | Read AgentSkills `SKILL.md`; parse `metadata.openclaw.requires` / `os` gates; no full ClawHub install UI in MVP |
| Workspace rules | AGENTS.md R/W | Also read-import `CLAUDE.md`, `.cursorrules` |
| Config dirs | C0 + C1 | Own `%APPDATA%/HFQ-Code/`; one-shot import wizard later |
| Protocols | MCP + Session API + multi-provider | P0 |
| Transcript | Own JSONL | Crash recovery / replay |
| Product shape | Coding desktop | No IM gateway in v1 |

## Q3 — GUI Phase-1 scope

Ship these surfaces first:

1. Session + Diff + Terminal  
2. Skills  
3. MCP  
4. Tasks  
5. ~~Memory~~ → Phase 2  
6. Multi-model Providers  
7. Permissions / Audit  

Phase-1 page set: **Home, Chat/Session, Changes/Diff, Terminal, Tasks, Skills, MCP, Models, Permissions/Audit, Settings**.

## Q4 — Naming

See [NAMING.md](./NAMING.md). **Recommended product name: HFQ Code.**
