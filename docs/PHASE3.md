# HFQ Code — Phase 3 plan

**Baseline:** Phase-2 RC `1.0.0-rc.1` → ship **1.0.0** · Audit: [AUDIT.md](./AUDIT.md)  
**Product:** Windows desktop **coding agent** (not IM gateway)  
**Last updated:** 2026-07-15

---

## 0. Why Phase-3

Phase-2 delivered Memory 2.0, Import, Sub-agents, Usage, Eval, packaging hooks, and runtime hardening sufficient for an RC. The full audit found:

1. **Security defects** that must ship before calling anything “1.0 final” (dangerous-shell session bypass, openPath, MCP header leak, metadata SSRF, plan-mode spawn, env stripping).
2. **Architecture debt** (main-process agent, vanilla mega-UI, no auto-update).
3. **Coding-agent depth**: Phase-2 closed `git_show` / `git_commit` + Terminal one-shot; real PTY / worker isolation remain Phase-3.

Phase-3 goal: **harden → deepen coding UX → stabilize process model → 1.0.0**.

---

## 1. Goals

| Pillar | Outcome |
|--------|---------|
| **Harden** | Close audit High/Medium; credentials hygiene; CSP/sandbox where cheap |
| **Code deeper** | Safer git write path, terminal/PTY, better diff/tasks |
| **Stabilize** | Optional session worker child process; crash isolation |
| **Ship 1.0** | Auto-update or documented manual update; CHANGELOG; installer verified |

Out of scope (unchanged): IM gateway, SaaS multi-tenant, vector embedding cloud, full OpenClaw dual-write, OAuth MCP (unless demanded).

---

## 2. Workstreams

### M3.0 — Security harden (immediate, this pass)

| ID | Item | Exit |
|----|------|------|
| P3-A1 | Dangerous shell always `ask` (even session allow) | unit test green |
| P3-A2 | Expand dangerous patterns (pipe-to-shell, encoded PS, diskpart, …) | unit test |
| P3-A3 | Mask MCP headers in `publicConfigView` | unit test |
| P3-A4 | Constrain `shell:openPath` to data/workspace roots | code + manual |
| P3-A5 | Block cloud-metadata hosts in `network_fetch` | unit test |
| P3-A6 | Sanitize child env for shell/git | code |
| P3-A7 | Plan mode blocks `spawn_subagent` | code |
| P3-A8 | `escapeHtml` attribute quotes | code |
| P3-A9 | Docs: AUDIT + PHASE3 + CHANGELOG note | docs |

### M3.1 — Secrets & config

| ID | Item | Status |
|----|------|--------|
| P3-B1 | `credentials.json` for apiKey + MCP Authorization headers | **Done** (`packages/config/src/credentials.ts`) |
| P3-B2 | Soft-migrate: load strips inline secrets → credentials.json | **Done** |
| P3-B3 | Diagnostics uses `publicConfigView` / redact (already) | **Done** |
| P3-B4 | OS DPAPI / keychain encryption of credentials file | Later (optional) |

### M3.2 — Coding deepen

| ID | Item |
|----|------|
| P3-C1 | ~~`git_commit`~~ **Done in Phase-2 close-out** — polish: commit message preview UI |
| P3-C2 | Real interactive PTY (node-pty / conpty); Phase-2 has one-shot `shell:run` only |
| P3-C3 | Richer Changes multi-file batch; open-in-editor Done |
| P3-C4 | ~~Tasks sub-agent tree~~ **Done in Phase-2 close-out** |

### M3.3 — Runtime isolation

| ID | Item | Status |
|----|------|--------|
| P3-D1 | Session worker as child process (NDJSON RPC over stdio); main only UI + policy dialogs | **Done** — `SessionWorkerHost` + `worker/entry.ts` |
| P3-D2 | Worker crash → session failed event, UI recoverable | **Done** — desktop broadcasts `session.failed`; reopen session |
| P3-D3 | Budget / memory limits per worker | Partial — inherits session maxRounds/maxToolCalls; OS memory caps later |

### M3.4 — Desktop 1.0

| ID | Item | Status |
|----|------|--------|
| P3-E1 | electron-updater or documented “download next NSIS” channel | **Done** — manual channel frozen (no auto-updater in 1.0) |
| P3-E2 | Verify pack on Windows; smoke install | **Done** — `pnpm pack:verify` + release:check; full NSIS install still operator-run |
| P3-E3 | CSP on renderer; re-evaluate `sandbox: true` | CSP **Done**; sandbox remains false with isolation |
| P3-E4 | Split `app.js` into modules | Deferred post-1.0 |
| P3-E5 | Align README / PRODUCT / ARCHITECTURE with 1.0 | **Done** |

### M3.5 — Optional later

- Vector/local embeddings for memory (was Phase-2 stretch)
- OAuth MCP / full Streamable-HTTP
- React UI rewrite only if modular vanilla hits a wall

---

## 3. Milestones

```text
M3.0  Audit harden          ──► patch on rc.1 or 1.0.0-rc.2
M3.1  Secrets split         ──► safer config
M3.2  Git + PTY             ──► daily coding feel
M3.3  Session worker        ──► isolation
M3.4  Packaging + 1.0.0     ──► stable tag
```

| Milestone | Exit criteria |
|-----------|----------------|
| **M3.0** | All P3-A* merged; `build` + `test` + `smoke` + `eval` green |
| **M3.1** | Keys not plain in public IPC; migration tested |
| **M3.2** | Commit flow behind ask; PTY open/re-run in Terminal page |
| **M3.3** | At least one session can run tools in a child process — **met** (`SessionWorkerHost` tests + desktop wiring) |
| **M3.4** | Version `1.0.0`; manual update freeze; `pack:verify` / `release:check`; docs frozen — **met** |---

## 4. Success metrics

- Zero known **High** security issues from AUDIT open list  
- Dangerous shell never silent-auto under session allow  
- Median time-to-first-edit still &lt; 5 min  
- Session recovery still ≥ 99% for JSONL  
- Installer builds on reference Windows machine  

---

## 5. Implementation note (this repo turn)

**M3.0 items P3-A1…A9 are implemented in-tree** alongside this document. Remaining milestones are planned, not all coded yet.
