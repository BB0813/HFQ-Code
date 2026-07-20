# HFQ Code — Development roadmap (post-1.0.5)

Status: **active plan**  
Baseline: product **1.1.8** (`v1.1.8`) · 2026-07-20  
Last updated: 2026-07-21 · **1.1.8 shipped** · **Next: 1.1.9 polish → 1.2 big UI** — [prompts/1.1.9-polish-handoff.md](./prompts/1.1.9-polish-handoff.md) · [prompts/1.2-ui-plan.md](./prompts/1.2-ui-plan.md)

## Positioning (frozen)

- Windows-first **desktop coding agent** — not an IM gateway  
- Update channel: **manual by default**; **L1+L2** in 1.1.7; **L3 opt-in silent NSIS** in 1.1.8 (never default-on) — [UPDATE-L1-L3.md](./UPDATE-L1-L3.md)  
- Workspace path-escape rejection; secrets never committed  
- Large changes still check [DECISIONS.md](./DECISIONS.md) + [ARCHITECTURE.md](./ARCHITECTURE.md)

## Where we are

| Area | State after 1.1.0 |
|------|-------------------|
| Agent loop + tools + worker | Shipped · **1.1.0** session rebind + identity pin |
| Providers CRUD / empty list / models:list | **Shipped** (1.1.0) · fail-closed empty providers |
| Access modes / permission modal | Shipped (1.0.2+) · **1.0.9** timeout + crash unlock |
| Chat composer polish | Shipped (1.0.3 · **1.0.8** upward menus + model-only label) |
| `/goal` long-run + Tasks + Chat banner | Shipped (1.0.4–1.0.6) |
| Update check multi-source fallback | **Shipped** (1.0.5–1.0.7): mirrors → ungh → direct |
| Skills store (preview / conflict / tags / **remote zip**) | **Shipped** (1.0.6 + **1.0.9**) |
| True interactive Terminal (PTY) | **Backend + scrollback reattach (1.1.9)** · FE must call `ptyGetScrollback` on remount |
| Changes / Git workspace IPC | **B2-0 shipped** · stage/commit UI present; **B2-1/B2-2** keyboard + ask-agent → frontend |
| Sub-agent observability | **B3-0 shipped** · Tasks panel present; parent stack / tree polish → frontend |
| DPAPI credentials | **D1 shipped** (Windows envelope; Settings shows encoding) — [DPAPI-1.2.md](./DPAPI-1.2.md) |
| Code signing (Authenticode) | **Shipped** — HFQ-ClodBreeze self-signed + trust pack + CI secrets — [PACKAGING.md](./PACKAGING.md) |
| In-app update download (D3) | **Shipped** · **1.1.1 backend:** install auto-download + disk recover + CN errors — [UPDATE-D3.md](./UPDATE-D3.md) |
| Diagnostics redaction (export) | **D4 shipped** (v2 bundle; credentials never exported) |
| Usage CSV export | **Shipped** (`usage:export` + CSV bundle + Usage page export button) — [USAGE-CSV-1.3.md](./USAGE-CSV-1.3.md) |
| Thinking / reasoning stream | **Backend shipped** · ThinkingBlock UI present — polish optional |
| React shell (Q6) | **Shipped** (1.0.10+) — pages under `apps/desktop/renderer` |

### Next train (post-1.1.8) — product order **locked 2026-07-21**

```text
1.1.9  coding-loop polish (Terminal / Changes / Tasks)   ← current
  │
  ▼
1.2    big UI overhaul (+ F2 remainder as slices)       ← after 1.1.9 ships
```

| Owner | Work | Notes |
|-------|------|--------|
| **Product** | **1.1.9 · Coding-loop polish** | B1-2 PTY reattach · B2 commit/keyboard/ask-agent 收口 · B3 tree/parent/spawn 收口 · 小 UX 毛刺 | **Active** — BE: `ptyGetScrollback` done · FE: [prompts/1.1.9-fe-implementation.md](./prompts/1.1.9-fe-implementation.md) · **no layout redesign** |
| **Product** | **1.2 · Big UI + F2 remainder** | U0 design gate → design system/shell/Chat · then Memory FTS / Goal OS light / panel prefs | **Planned** — [prompts/1.2-ui-plan.md](./prompts/1.2-ui-plan.md) · **blocked on 1.1.9 ship + U0** |
| **Product** | **1.1.8 · Update L3** | opt-in silent NSIS `/S` + pending marker + relaunch | **Shipped** (`v1.1.8`) — [RELEASE-1.1.8.md](./RELEASE-1.1.8.md) |
| **Product** | **1.1.7 · Update L1+L2** | `updatePolicy` · background auto-download · ready UI · one-click confirm install | **Shipped** (`v1.1.7`) — [RELEASE-1.1.7.md](./RELEASE-1.1.7.md) |
| **Product** | **1.1.6 full train** | compression LLM compact · goal sidecar · `read_document` · compactMaxChars · UI polish | **Shipped** (`v1.1.6`) — [RELEASE-1.1.6.md](./RELEASE-1.1.6.md) |
| **Product** | **Track F — Adopt Kivio/Athena patterns** | Canonical: [ADOPT-KIVIO-ATHENA.md](./ADOPT-KIVIO-ATHENA.md) · DECISIONS Q8 |
| **F1** | Chat mermaid · Coding Profiles · model roles · skill progressive match · goal fields · memory links · bundled `diagram` | **Shipped in 1.1.5** |
| **F2** | Goal tree sidecar · Memory FTS · pdf/docx skills · panel prefs | **partial shipped in 1.1.6** (sidecar + read_document); Memory FTS / Goal OS / panel prefs → **1.2** |
| **Product** | **1.1.5–1.1.4** | F1 · abort isolation · identity | **Shipped** |
| Later | Track E (embeddings, Python sidecar, MCP OAuth, cost charts) | Not Phase-1 |

---

## Guiding themes (next 2–3 months)

1. **UI / UX architecture** — **R0–R5 landed** (modules, chat UX, store, home/tasks/changes, islands); next product train is 1.1 PTY  
2. **Coding depth** — Terminal (PTY), Git, Diff, sub-agent observability (can share a release train with UI slices)  
3. **Skills marketplace** — local + remote packages shipped (1.0.9); store visual polish **R3 done**  
4. **Hardening & distribution** — credentials, signing, optional updater  

Do **not** expand into multi-tenant cloud agent or IM gateway.

### Layout redesign gate (human pick)

Static mocks for review: **[LAYOUT-PROPOSALS.md](./LAYOUT-PROPOSALS.md)** · `docs/design-proposals/`.  
**Do not** big-bang production UI until A/B/C (or hybrid) is chosen. Framework (React/Preact) is **conditional on pick** (A/B lean yes, C optional).

### 1.1 PTY spike

See **[PTY-1.1.md](./PTY-1.1.md)**. Terminal page HTML extracted to `pages/terminal-page.js` (one-shot shell unchanged).


**Priority note (2026-07-15):** Product chose to **pull UI/UX architecture migration earlier**. R1 is no longer “background chore while 1.1 starts”; it is a **blocking enabler** for safe Chat/Terminal/Tasks UI work.

---

## Track A — Patch train (1.0.6 → 1.0.x)

Small, shippable patches. Keep `pnpm release:check` green; tag `v*` + Actions + SHA256.

### A1 · **1.0.6** — Store depth + goal UX ✅ shipped

**Goal:** make Skills store usable day-to-day; tighten long-run feedback.

| ID | Work | Files / area | Done when |
|----|------|--------------|-----------|
| A1-1 | SKILL.md **preview drawer** | `skills:preview`, drawer UI | ✅ |
| A1-2 | Install **conflict UI** (overwrite confirm + `sourceDir` retry) | catalog + Skills UI | ✅ |
| A1-3 | Catalog filter chips | `HFQSkillsUI` + store | ✅ |
| A1-4 | Goal **banner** in Chat | Chat + `task.updated` | ✅ |
| A1-5 | Update check `apiUrl` faint line | Settings | ✅ |
| A1-6 | catalog install/preview unit tests | `catalog.test.ts` | ✅ |

**Out of scope (carry to later):** remote zip, PTY, React rewrite.

### A2 · **1.0.7** — Update multi-source fallback ✅ shipped

| ID | Work | Done |
|----|------|------|
| A2-u1 | Detect HTML/non-JSON mirror responses | ✅ |
| A2-u2 | Chain extra ghproxy-style bases + **ungh.cc** + direct | ✅ |
| A2-u3 | Normalize ungh assets / release notes | ✅ |

**Note:** original A2 remote zip deferred (hotfix priority for dead ghproxy.com → 1.0.7).

### A3 · **1.0.8** — Composer model UI polish ✅ shipped

| ID | Work | Done |
|----|------|------|
| A3-ui1 | Topbar provider · model badge | ✅ |
| A3-ui2 | Model button shows model id only | ✅ |
| A3-ui3 | Access/model menus open **upward** | ✅ |

**Note:** remote zip + permission polish deferred to **1.0.9**.

### A4 · **1.0.9** — ClawHub remote packages (safe path) + permission polish ✅ shipped

| ID | Work | Done |
|----|------|------|
| A4-z1 | Catalog item `packageUrl` → download **zip/tarball** to temp | ✅ |
| A4-z2 | Extract under user skills with same safe-name rules as local install | ✅ |
| A4-z3 | Optional SHA256 in `catalog.json` | ✅ |
| A4-z4 | UI: install progress + error surface | ✅ |
| A4-p1 | Permission modal multi-request queue hardening | ✅ |
| A4-p2 | Worker crash → clear modal + composer unlock | ✅ |
| A4-p3 | `git_commit` message preview in UI before tool allow (when confirm mode) | ✅ |

**Policy:** packages are **data + SKILL.md instructions**, not arbitrary installer executables.

---

## Track B — **1.1** Coding depth

### B1 · Interactive Terminal (PTY)

| ID | Work | Notes |
|----|------|--------|
| B1-1 | Integrate `node-pty` / ConPTY on Windows | ✅ T1 backend (`@hfq/pty` + IPC); xterm UI → frontend |
| B1-2 | Session-linked PTY + reattach / stop | killAll on switch/quit; **1.1.9 BE** ring + `pty:getScrollback`; FE remount wire-up |
| B1-3 | Keep one-shot `shell` tool for agent; PTY is human Terminal page | ✅ Don’t merge blindly |
| B1-shell | `pty:shells` + prefs `terminalShell` | ✅ default shell for create |
| B1-pack | pack-verify `@hfq/pty` + optional node-pty | ✅ asserts + WARN fallback |

### B2 · Changes + Git UX

| ID | Work |
|----|------|
| B2-0 | Workspace git IPC (`git:status|diff|show|stage|unstage|commit|log`) + `packages/tools` git-ops | ✅ backend; UI contract in [CHANGES-GIT-1.1.md](./CHANGES-GIT-1.1.md) · [FRONTEND-IPC.md](./FRONTEND-IPC.md) |
| B2-1 | Multi-file review layout polish (keyboard next/prev file) | **frontend** (backend ready) |
| B2-2 | From diff → “ask agent to fix” prefilled composer | **frontend** (no new IPC; composer draft local) |
| B2-3 | Commit flow: stage summary + message draft | **frontend** on B2-0 |

### B3 · Sub-agents observability

| ID | Work | Notes |
|----|------|--------|
| B3-0 | Backend: `SessionInfo` parent/profile/goal · `subagent.updated` · `listSpawnAttempts` · spawn `errorCode` | ✅ see [SUBAGENT-OBS-1.1.md](./SUBAGENT-OBS-1.1.md) |
| B3-1 | Tasks tree: parent goal → tool tasks → child sessions | **frontend** on B3-0 |
| B3-2 | Open child transcript without losing parent context | **frontend** (local parent stack) |
| B3-3 | Failed spawn reasons in UI | **frontend**: `subagent.updated` / `listSpawnAttempts` |

**1.1 exit:** developer can interactively run commands, review multi-file diffs, and follow sub-agent trees without guessing.

---

## Track C — UI / UX architecture (elevated · start now)

Canonical checklist: [UI-REDESIGN.md](./UI-REDESIGN.md).  
**Elevated (2026-07-15):** architecture migration is **front-loaded**, not deferred behind full 1.1 feature work.

| Milestone | When | Focus | Status |
|-----------|------|--------|--------|
| **R1** Shell split | **Structure done · polish optional** | Extract `nav`, `pages/*`, `chat/*`, shared layout; **no behavior change** | ✅ modules on main (`shared-ui`, `nav-ui`, `settings-ui`, `skills-page`, `chat-shell`; handlers remain in `app.js`) |
| **R2** Chat redesign | On chat-shell module | Windowed log + tool cards + sticky composer | ✅ core landed (full virtual list optional) |
| **R3** Store visual polish | skills-page + CSS | Category rails, density, empty states | ✅ |
| **R4** Home / Tasks / Changes | home/tasks/changes page modules | Resume dashboard, tasks tree, multi-file review layout | ✅ |
| **R5** Progressive islands | `islands/bootstrap.js` | Vanilla islands; **no React rewrite** | ✅ decision + bootstrap |

### R1 exit criteria (must hit before large Chat/Terminal UI features)

**Status (2026-07-15):** Structure exit criteria **met** (nav / settings / skills / chat shell / shared layout; `pnpm release:check` green). Remaining: optional handler extracts + focus docs.

1. `app.js` is an orchestrator only (wire IPC + state), not a 5k-line page dump  
2. At least: **nav**, **skills**, **settings**, **chat shell** (composer + messages host) live as separate modules  
3. Shared primitives: panel head, empty state, seg-tabs, status line helpers  
4. `pnpm release:check` green; no IPC contract change  

**Rule:** every R-slice keeps IPC stable and passes `pnpm release:check`. Prefer extract-module PRs over big-bang redesign.

---

## Track D — **1.2** Security & distribution

| ID | Work | Dependency |
|----|------|------------|
| D1 | DPAPI (or OS keychain) for `credentials.json` | ✅ Windows DPAPI CurrentUser + soft migrate — [DPAPI-1.2.md](./DPAPI-1.2.md) |
| D2 | Authenticode code signing | ✅ self-signed **HFQ-ClodBreeze** + trust pack + CI secrets — [PACKAGING.md](./PACKAGING.md) |
| D3 | In-app update download + open installer | ✅ not silent · **1.1.1** install auto-download if missing file — [UPDATE-D3.md](./UPDATE-D3.md) |
| D4 | Diagnostics redaction pass | ✅ hardened export + patterns — [DIAGNOSTICS-1.2.md](./DIAGNOSTICS-1.2.md) |

Release channel: GitHub Releases + multi-source check + optional in-app download. Installers are self-signed; SmartScreen may still warn until reputation builds.

---

## Track F — Adopt Kivio + Athena (coding patterns)

Canonical: **[ADOPT-KIVIO-ATHENA.md](./ADOPT-KIVIO-ATHENA.md)**.

| ID | Work | Notes |
|----|------|--------|
| F1-0 | Decision + roadmap hooks | ✅ docs |
| F1-1 | Chat GFM + mermaid + fenced code | renderer `MarkdownMessage` |
| F1-2 | Coding Profiles schema + Settings + session systemAddon | `prefs.codingProfiles` |
| F1-3 | Model roles title / compression | `prefs.modelRoles` (fallback active) |
| F1-4 | Skill progressive match + body inject | `@hfq/skills` matcher + loop |
| F1-5 | Goal driver fields on `task.updated` | shared + history + loop |
| F1-6 | Memory `links` + prompt surface | `@hfq/memory` + tools |
| F1-7 | Bundled `diagram` skill | `skills/bundled/diagram` |
| F2-1 | Goal tree sidecar (`*.goals.json`) | **1.1.6** |
| F2-2 | compression model drives compact | **1.1.6** |
| F2-3 | `read_document` + document-read skill | **1.1.6** |
| F2-4 | Memory inverted-index / optional FTS | **1.1.6 optional** · full FTS 1.2 |
| F2-5 | Dockable panel prefs · advanced compact UI | 1.2+ |

## Track E — Stretch (1.3+)

- Memory embeddings / hybrid retrieval  
- Python sidecar behind a stable IPC (DECISIONS Q1)  
- Advanced MCP (OAuth, streamable HTTP)  
- Usage CSV export / cost by model-day — **CSV export + desktop Usage UI shipped** ([USAGE-CSV-1.3.md](./USAGE-CSV-1.3.md)); cost-by-model UI later  
- ClawHub **publish** from HFQ (out of scope until install path is solid)  
- Anthropic **extended thinking budget** request flag (parse path already accepts `thinking` blocks)  
- Cost-by-model-day charts (data already in usage JSONL / CSV)

---

## Suggested sequencing

```text
1.0.5–1.0.10 (done)  patch + React shell + D1–D4 + PTY/git/subagent backends
   │
1.1.0 (done)         providers lifecycle + models:list + session model rebind
   │
1.1.1 (done)         D3 install auto-download · providerId · Tasks cold-start (backend tag)
   │
1.1.2 (done)         Full ship: 1.1.1 backend + Settings/Tasks/Changes/Models UI
   │
   └─► later   Track E stretch (embeddings / Python sidecar / MCP OAuth / cost charts)
```

**Owner split:** backend owns IPC/packages; frontend owns React pages under `apps/desktop/renderer`. Cross-team handoff via [FRONTEND-IPC.md](./FRONTEND-IPC.md) + explicit Prompts.

---

## Priority stack (if capacity is limited)

| Priority | Item | Why |
|----------|------|-----|
| **P0** | **1.1.9 coding-loop polish** | Close Terminal/Changes/Tasks gaps before any shell redesign |
| **P1** | **1.2 U0 design gate → big UI** | User-facing workbench upgrade (post-1.1.9) |
| **P1** | **1.2 F2 remainder** (Memory FTS · Goal light · panel prefs) | Product depth; slice with or after UI |
| **P2** | Residual virtual list / focus docs | Non-blocking |
| **P3** | Track E embeddings / sidecar / MCP OAuth | Only after 1.2 main train |

---

## Explicit non-goals (near term)

- Full ClawHub publish marketplace  
- **Default-on** silent auto-update (L3 is **opt-in only**, deadline 1.1.8 — not “never”)  
- electron-updater rewrite unless L3 blocked on real NSIS  
- IM / multi-account social agent  
- Replacing TypeScript agent core with Python wholesale  
- Big-bang React rewrite of the whole renderer before R1–R2  

---

## Engineering cadence

1. Feature branch or main small commits matching surrounding style  
2. `pnpm release:check` before tag  
3. Version bump root + `apps/desktop`  
4. `CHANGELOG` + `docs/RELEASE-x.y.z.md` + PACKAGING version strings  
5. `git tag -a vX.Y.Z` → push → Actions pack + SHA256SUMS  
6. Update this roadmap “Where we are” table after each ship  

---

## Next concrete sprint (2026-07-21)

1. **1.1.9** — execute [prompts/1.1.9-polish-handoff.md](./prompts/1.1.9-polish-handoff.md) (FE-first; additive IPC only if PTY needs it)  
2. **release 1.1.9** — `release:check` + pack + tag (prompt when implementation green)  
3. **1.2 U0** — design gate per [prompts/1.2-ui-plan.md](./prompts/1.2-ui-plan.md) (mock + layout skin vs hybrid)  
4. **1.2 implement slices** — UI first; F2 FTS/Goal/panel prefs as agreed slices  

Default next ship target: **`v1.1.9` polish**, then **1.2 big UI** (not F2-only, not update-train).
