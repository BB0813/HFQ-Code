# HFQ Code — Full code audit

**Date:** 2026-07-14  
**Baseline:** `1.0.0-rc.1` (Phase-2 RC)  
**Scope:** monorepo packages + Electron desktop (`apps/desktop`)  
**Method:** static review of security-sensitive paths, architecture vs `ARCHITECTURE.md`, policy/tools/session surface, IPC, config/secrets, tech debt

---

## 1. Inventory (source, excl. dist/node_modules)

| Area | Approx. LOC | Notes |
|------|-------------|--------|
| `packages/*` | ~7.5k TS | agent-core, tools, mcp, memory, policy, providers, config, … |
| `apps/desktop/electron` | ~1.0k CJS | main + preload |
| `apps/desktop/renderer` | ~5.0k JS/CSS | single `app.js` SPA |
| **Total key sources** | **~14k** | Phase-1+2 product surface |

Packages: `agent-core`, `config`, `mcp`, `memory`, `policy`, `providers`, `session-api`, `shared`, `skills`, `tools`, `transcript`.

---

## 2. Security findings

### Critical / High

| ID | Finding | Status | Fix / residual |
|----|---------|--------|----------------|
| **S-01** | **Dangerous shell bypass via session allow.** `resolvePermission` returned `"allow"` when `sessionAllows` contained `shell` *before* `isDangerousShell` ran. A prior “本会话允许” for a safe command permanently auto-allowed `rm -rf`, pipe-to-shell, etc. | **Fixed (P3)** | Dangerous shell always forces `ask`, regardless of session/rule allow. Tests added. |
| **S-02** | **MCP HTTP headers leaked in UI config view.** `publicConfigView` masked `providers[].apiKey` only; `mcpServers[].headers.authorization` was returned full to renderer / diagnostics input path. | **Fixed (P3)** | Mask Authorization / api-key / token / secret / cookie header values in `publicConfigView`. |
| **S-03** | **`shell:openPath` accepted arbitrary absolute paths.** Renderer could open any OS path via IPC (not limited to workspace/data dirs). | **Fixed (P3)** | Restrict to `%APPDATA%/HFQ-Code/**`, `~/.agents/**`, and active workspace. |

### Medium

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| **S-04** | **SSRF / cloud metadata via `network_fetch`.** Only scheme + URL credentials blocked; `http://169.254.169.254/` and `metadata.google.internal` allowed (still behind user ask). | **Mitigated (P3)** | Block link-local `169.254/16` and known metadata hostnames. Residual: private RFC1918 still allowed by design for local dev servers (policy ask). |
| **S-05** | **Shell inherits full parent env.** Child `cmd`/`bash` received `process.env`, so provider keys in the Electron process env could leak into tool subprocesses. | **Mitigated (P3)** | Strip `*API*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`, etc. from child env for shell/git. |
| **S-06** | **Plan mode did not block `spawn_subagent`.** Sub-agent could still mutate (edit/shell profiles) while parent was in plan mode. | **Fixed (P3)** | Treat `spawn_subagent` as mutating under plan mode. |
| **S-07** | **API keys lived in `config.json`.** | **Mitigated (M3.1 + D1)** | Secrets in `credentials.json`; Windows DPAPI CurrentUser envelope by default ([DPAPI-1.2.md](./DPAPI-1.2.md)). Residual: same-user malware; non-Windows still plaintext. |
| **S-08** | **MCP stdio spawns user-configured command.** Full power of local process; intentional but high risk if malicious MCP entry imported. | Open | Import wizard + UI should keep “enabled=false” default; document risk. |

### Low / informational

| ID | Finding | Notes |
|----|---------|--------|
| **S-09** | `escapeHtml` missed quotes before audit | Fixed: `&quot;` / `&#39;` for attribute safety. |
| **S-10** | `sandbox: false` on BrowserWindow | Common with preload bridges; `contextIsolation: true`, `nodeIntegration: false`. Prefer `sandbox: true` when preload is verified sandbox-safe. |
| **S-11** | Transcript redaction best-effort | Patterns cover common keys/Bearer; may miss custom formats. |
| **S-12** | Workspace path escape checks use `path.relative` | Covered by tests; Windows junctions/symlinks outside root are a residual OS concern. |
| **S-13** | No CSP meta on `index.html` | Local file renderer only; still good hygiene for Phase-3. |

### Security baseline (held)

- Workspace-scoped fs tools (`resolveWorkspacePath`)
- Shell/network default **ask**; MCP tools medium risk
- Renderer has no Node; tools via main IPC / agent-core
- Provider keys masked in public config view (now + MCP headers)
- Transcript/diagnostics redaction hooks present

---

## 3. Architecture vs docs

| Doc claim | Actual | Gap |
|-----------|--------|-----|
| Renderer **React** + Session Worker isolation | Vanilla `app.js`; **SessionWorkerHost** child process (M3.3) with in-process fallback | React still deferred; worker isolation landed |
| `credentials.json` | Implemented (M3.1); **D1 DPAPI shipped** on Windows | See S-07 residual |
| Daemon process | Child session worker (not full multi-daemon) | Crash of worker no longer takes Electron main |
| `session-api` package | Thin types only | Worker uses agent-core protocol; session-api still channel names |

Process model today:

```
Electron Main ── SessionWorkerHost (NDJSON) ── child Node: SessionManager / tools
       │
       └── Renderer (vanilla SPA, preload bridge)
```

---

## 4. Correctness & product risks

| Area | Assessment |
|------|------------|
| Agent loop | Solid: budgets, abort, plan mode, subagent depth ≤ 2, permission pipeline |
| Resume / JSONL | Works; session allows restored from `permission.resolved` |
| Memory 2.0 | Scoped BM25; no embeddings (documented non-goal) |
| Import wizard | Copy + manifest; conflict default skip |
| Usage | JSONL aggregation; pricing prefs optional |
| Packaging | electron-builder config present; **installer not necessarily built on every machine** |
| P2-I | `git_diff` only; no `git_commit`, no real PTY |

---

## 5. Tech debt (priority)

1. **Monolithic `app.js` / `main.cjs`** — hard to review; split by page / IPC domain  
2. ~~**No session worker process**~~ — **M3.3 done** (child Node; residual: memory caps)  
3. **Policy dangerous-shell list** is regex-based (expandable, not complete)  
4. **README still says Beta `0.2.0-beta`** in places while package is `1.0.0-rc.1`  
5. **ARCHITECTURE.md / PRODUCT.md** Phase-2 page list partially stale vs shipped UI  
6. **`session-api` unused** as runtime boundary  
7. **No auto-updater** despite packaging track  

---

## 6. Test / gate posture

Expected gates: `pnpm build` · `pnpm test` · `pnpm smoke` · `pnpm eval`.

Audit-driven tests added/extended:

- policy: session-allow does not skip dangerous shell; pipe-to-bash patterns  
- config: MCP header masking in public view  
- tools: metadata IP blocked for `network_fetch`

---

## 7. Verdict

| Dimension | Rating | Comment |
|-----------|--------|---------|
| Phase-2 feature completeness | **Strong (RC)** | See `PHASE2-STATUS.md` |
| Security for local desktop coding agent | **Acceptable after P3 fixes** | Residual: unencrypted config secrets, powerful shell/MCP by design |
| Architecture purity | **Fair** | Docs ahead of isolation/React |
| Maintainability | **Fair** | UI monolith is main drag |

**Ship posture:** Keep **1.0.0-rc.1** line; land audit fixes as **Phase-3 slice M3.0 (harden)**, then product depth (git/PTY/updater/worker).

Detailed next-phase plan: **[PHASE3.md](./PHASE3.md)**.
