# Phase-2 delivery status

Last updated: 2026-07-15 · Superseded by product **1.0.0** (see [PHASE3-STATUS.md](./PHASE3-STATUS.md))

| ID | Theme | Status | Evidence |
|----|-------|--------|----------|
| P2-A | Memory 2.0 | Done | `packages/memory` scoped brain; Memory page; tools scope |
| P2-B | Import wizard | Done | `import-wizard.ts` + Import page IPC |
| P2-C | Sub-agents | Done | `subagent.ts` + manager.spawn + Chat spawn + Tasks child tree |
| P2-D | Usage & cost | Done | `usage.ts` + Usage page + prefs pricing |
| P2-E | Eval lab | Done | `scripts/eval.mjs` · `pnpm eval` |
| P2-F | Packaging | Done | electron-builder + [PACKAGING.md](./PACKAGING.md); manual update notes in Settings |
| P2-G | Runtime harden | Done | redact, plan mode, budgets, diagnostics, single-instance, audit M3.0 |
| P2-H | MCP enhance | Done | headers, ping (OAuth / full streamable-HTTP still later) |
| P2-I | Coding deepen | Done | `git_diff` / `git_show` / `git_commit`; Changes filter + open-in-editor; AGENTS.md editor; Terminal one-shot run (non-PTY) |

### Explicit non-goals still out (not Phase-2 incomplete)

- IM gateway, dual-write OpenClaw, SaaS multi-tenant
- OAuth MCP, full Streamable-HTTP
- Vector embedding models (BM25 only)
- ~~Full session Worker process isolation~~ → **shipped in Phase-3 M3.3**
- Real interactive PTY (`node-pty`) — still deferred; Terminal one-shot `shell:run`
- Auto-updater — **1.0 manual channel** (see [PACKAGING.md](./PACKAGING.md))

---

## Post-RC

Full code audit + Phase-3 plan: **[AUDIT.md](./AUDIT.md)** · **[PHASE3.md](./PHASE3.md)** · **[PHASE3-STATUS.md](./PHASE3-STATUS.md)** · packaging **[PACKAGING.md](./PACKAGING.md)**
