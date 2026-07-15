# Phase-3 delivery status

Last updated: 2026-07-15 · Product **1.0.0**

| ID | Theme | Status | Evidence |
|----|-------|--------|----------|
| M3.0 | Audit harden | Done | [AUDIT.md](./AUDIT.md); dangerous shell re-ask; openPath; SSRF; env strip; plan spawn block |
| M3.1 | Secrets split | Done | `packages/config` → `credentials.json`; migrate on load; Settings path row |
| M3.2 | Git + PTY | Partial | `git_commit`/`git_show` Done; **real PTY deferred** (one-shot shell for 1.0) |
| M3.3 | Session worker | Done | `packages/agent-core/src/worker/*`; Electron child process; crash → `session.failed`; local fallback |
| M3.4 | Packaging / 1.0 | Done | Version **1.0.0**; manual update freeze; `release:check` + `pack:win` → NSIS/portable; [PACKAGING.md](./PACKAGING.md) · [RELEASE-1.0.0.md](./RELEASE-1.0.0.md) |

### 1.0 exit notes

- Auto-updater **not** shipped — documented manual NSIS/portable channel
- True interactive PTY **not** shipped — Terminal one-shot remains
- DPAPI for credentials **optional later**
- **Ship artifacts (2026-07-15):** `apps/desktop/release/HFQ Code-1.0.0-x64.exe` · `HFQ Code-1.0.0-portable.exe` (unsigned)

### Post-1.0 backlog (optional)

1. electron-updater + code signing  
2. node-pty / ConPTY  
3. DPAPI credentials  
4. Split `app.js` / React UI — tracked in [UI-REDESIGN.md](./UI-REDESIGN.md)  
5. ClawHub store depth (remote packages) — scaffold in **1.0.5**  
6. Update-check resilience — **Done in 1.0.5** (ghproxy → direct fallback)

### Shipped after 1.0.0 (patch train)

| Version | Notes |
|---------|--------|
| 1.0.1–1.0.3 | Identity, access modes, chat UI polish |
| 1.0.4 | `/goal` + ghproxy default update checks |
| 1.0.5 | Update fallback · goal budget hint · Skills store scaffold · UI redesign TODO |

Plan: [PHASE3.md](./PHASE3.md) · **Forward plan:** [ROADMAP.md](./ROADMAP.md) · UI: [UI-REDESIGN.md](./UI-REDESIGN.md)
