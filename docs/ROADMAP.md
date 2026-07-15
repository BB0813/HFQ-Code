# HFQ Code — Development roadmap (post-1.0.5)

Status: **active plan**  
Baseline: product **1.0.5** (`v1.0.5`) · 2026-07-15  
Last updated: 2026-07-15

## Positioning (frozen)

- Windows-first **desktop coding agent** — not an IM gateway  
- Manual update channel by default (check → download; no silent auto-install unless later decision + code signing)  
- Workspace path-escape rejection; secrets never committed  
- Large changes still check [DECISIONS.md](./DECISIONS.md) + [ARCHITECTURE.md](./ARCHITECTURE.md)

## Where we are

| Area | State after 1.0.5 |
|------|-------------------|
| Agent loop + tools + worker | Shipped |
| Access modes / permission modal | Shipped (1.0.2+) |
| Chat composer polish | Shipped (1.0.3) |
| `/goal` long-run + Tasks | Shipped (1.0.4–1.0.5) |
| Update check via ghproxy + direct fallback | Shipped (1.0.4–1.0.5) |
| Skills store scaffold (curated + local install) | **Scaffold only** (1.0.5) |
| True interactive Terminal (PTY) | **Not shipped** (one-shot shell) |
| DPAPI credentials / code signing / electron-updater | **Not shipped** |
| Renderer split / full UI redesign | **R0 docs only** — [UI-REDESIGN.md](./UI-REDESIGN.md) |

---

## Guiding themes (next 2–3 months)

1. **Coding depth** — Terminal, Git, Diff, sub-agent observability  
2. **Skills marketplace (gradual)** — from local install → safe remote packages  
3. **UI redesign (incremental)** — split `app.js`, then Chat / Skills / Home  
4. **Hardening & distribution** — credentials, signing, optional updater  

Do **not** expand into multi-tenant cloud agent or IM gateway.

---

## Track A — Patch train (1.0.6 → 1.0.x)

Small, shippable patches. Keep `pnpm release:check` green; tag `v*` + Actions + SHA256.

### A1 · **1.0.6** — Store depth + goal UX (next recommended)

**Goal:** make Skills store usable day-to-day; tighten long-run feedback.

| ID | Work | Files / area | Done when |
|----|------|--------------|-----------|
| A1-1 | SKILL.md **preview drawer** in store (read local installed / selected path) | `renderer/app.js`, `skills:*` IPC | User can preview body before install |
| A1-2 | Install **conflict UI** (exists → overwrite confirm / rename) | `installSkillFromDir`, Skills UI | No silent fail on duplicate |
| A1-3 | Catalog filter chips (tags: git / test / docs / planned) | Skills store | Chips filter cards |
| A1-4 | Goal **banner** in Chat while `taskId` in_progress (budget + 停止) | Chat + `task.updated` | Visible without hunting system messages |
| A1-5 | Update check: show `apiUrl` in diagnostics / Settings faint line | Settings | Easier support |
| A1-6 | Eval/smoke note for catalog parse + install (unit already in catalog.test) | tests | No regression on install |

**Out of scope for 1.0.6:** remote zip download, PTY, React rewrite.

### A2 · **1.0.7** — ClawHub remote packages (safe path)

| ID | Work | Notes |
|----|------|--------|
| A2-1 | Catalog item `packageUrl` → download **zip/tarball** to temp | https only; size limit; timeout |
| A2-2 | Extract under user skills with same safe-name rules as local install | Reject path escape / absolute paths in zip |
| A2-3 | Optional SHA256 in `catalog.json` | Fail closed if mismatch |
| A2-4 | UI: install progress + error surface | No auto-run of scripts from package |
| A2-5 | Security review note in [COMPAT.md](./COMPAT.md) | Document threat model |

**Policy:** packages are **data + SKILL.md instructions**, not arbitrary installer executables. No brew/node install specs UI yet.

### A3 · **1.0.8** — Permissions / worker edge polish

| ID | Work |
|----|------|
| A3-1 | Permission modal multi-request queue hardening (timeouts, session label) |
| A3-2 | Worker crash → clear modal + composer unlock (audit remaining paths) |
| A3-3 | `git_commit` message preview in UI before tool allow (when confirm mode) |

---

## Track B — **1.1** Coding depth

### B1 · Interactive Terminal (PTY)

| ID | Work | Notes |
|----|------|--------|
| B1-1 | Integrate `node-pty` / ConPTY on Windows | Replace pure one-shot for interactive sessions |
| B1-2 | Session-linked PTY + reattach / stop | Align with permission for dangerous commands |
| B1-3 | Keep one-shot `shell` tool for agent; PTY is human Terminal page | Don’t merge blindly |

### B2 · Changes + Git UX

| ID | Work |
|----|------|
| B2-1 | Multi-file review layout polish (keyboard next/prev file) |
| B2-2 | From diff → “ask agent to fix” prefilled composer |
| B2-3 | Commit flow: stage summary + message draft |

### B3 · Sub-agents observability

| ID | Work |
|----|------|
| B3-1 | Tasks tree: parent goal → tool tasks → child sessions |
| B3-2 | Open child transcript without losing parent context |
| B3-3 | Failed spawn reasons in UI |

**1.1 exit:** developer can interactively run commands, review multi-file diffs, and follow sub-agent trees without guessing.

---

## Track C — UI redesign (parallel, non-blocking)

Canonical checklist: [UI-REDESIGN.md](./UI-REDESIGN.md).

| Milestone | Align with | Focus |
|-----------|------------|--------|
| **R1** Shell split | During 1.0.6–1.0.7 | Extract `pages/skills.js`, `pages/settings.js`, shared `seg-tabs` without behavior change |
| **R2** Chat redesign | After R1 or with 1.1 | Virtualized messages, tool cards, goal banner (A1-4 can land early as thin UI) |
| **R3** Store visual system | With A2 remote packages | Category rails, detail drawer (overlaps A1-1) |
| **R4** Home / Tasks / Changes | 1.1 | Resume dashboard + trees |
| **R5** React/islands | Only if R1 insufficient | Optional |

**Rule:** every R-slice must keep IPC stable and pass `pnpm release:check`. Prefer extract-module PRs over big-bang redesign.

---

## Track D — **1.2** Security & distribution

| ID | Work | Dependency |
|----|------|------------|
| D1 | DPAPI (or OS keychain) for `credentials.json` | Windows-first design |
| D2 | Authenticode code signing | Cert purchase / org decision |
| D3 | Optional electron-updater | **Requires D2** + product decision |
| D4 | Diagnostics redaction pass | Audit export |

Until D2, keep manual NSIS/portable + in-app check (ghproxy).

---

## Track E — Stretch (1.3+)

- Memory embeddings / hybrid retrieval  
- Python sidecar behind stable IPC (DECISIONS Q1)  
- Advanced MCP (OAuth, streamable HTTP)  
- Usage CSV export / cost by model-day  
- ClawHub **publish** from HFQ (out of scope until install path is solid)

---

## Suggested sequencing

```text
1.0.5 (done)
   │
   ├─► 1.0.6  store preview/conflict + goal banner + R1 extract skills/settings
   │
   ├─► 1.0.7  remote package install (safe zip) + R3 partial
   │
   ├─► 1.0.8  permission/worker polish
   │
   ├─► 1.1    PTY Terminal + Changes/Git + Tasks tree + R2/R4 UI
   │
   └─► 1.2    DPAPI + signing (+ optional updater)
```

Parallelism allowed: **R1 module split** can start immediately alongside 1.0.6 features if PRs stay small.

---

## Priority stack (if capacity is limited)

| Priority | Item | Why |
|----------|------|-----|
| **P0** | 1.0.6 A1-1…A1-4 | Unblocks store + goal daily use |
| **P0** | R1 extract Skills/Settings modules | Enables all later UI work |
| **P1** | 1.0.7 remote packages | Real “ClawHub slowly” |
| **P1** | 1.1 PTY | Largest coding-agent gap vs peers |
| **P2** | 1.0.8 permission polish | Reliability |
| **P2** | 1.2 signing/DPAPI | Distribution trust |
| **P3** | R5 React / embeddings / sidecar | Only after P0–P1 |

---

## Explicit non-goals (near term)

- Full ClawHub publish marketplace  
- Silent auto-update without signing decision  
- IM / multi-account social agent  
- Replacing TypeScript agent core with Python wholesale  

---

## Engineering cadence

1. Feature branch or main small commits matching surrounding style  
2. `pnpm release:check` before tag  
3. Version bump root + `apps/desktop`  
4. `CHANGELOG` + `docs/RELEASE-x.y.z.md` + PACKAGING version strings  
5. `git tag -a vX.Y.Z` → push → Actions pack + SHA256SUMS  
6. Update this roadmap “Where we are” table after each ship  

---

## Next concrete sprint (1.0.6 proposal)

1. Preview drawer for skill body (installed + catalog planned packs from bundled text if any)  
2. Overwrite confirm on install  
3. Chat goal in-progress banner wired to Tasks  
4. Extract `apps/desktop/renderer/pages/skills.js` (or equivalent) — first R1 slice  
5. Ship 1.0.6 with SHA256  

When starting implementation, open with **1.0.6 P0 items** unless product priority changes.
