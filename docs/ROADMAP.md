# HFQ Code — Development roadmap (post-1.0.5)

Status: **active plan**  
Baseline: product **1.1.4** (`v1.1.4`) · 2026-07-19  
Last updated: 2026-07-19 · **1.1.4** abort isolation + permission queue + live list access modes + Chat polish + CSS tokens

## Positioning (frozen)

- Windows-first **desktop coding agent** — not an IM gateway  
- Manual update channel by default (check → download; no silent auto-install unless later decision + code signing)  
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
| True interactive Terminal (PTY) | **Backend shipped** · React xterm UI present; reattach polish → frontend |
| Changes / Git workspace IPC | **B2-0 shipped** · stage/commit UI present; **B2-1/B2-2** keyboard + ask-agent → frontend |
| Sub-agent observability | **B3-0 shipped** · Tasks panel present; parent stack / tree polish → frontend |
| DPAPI credentials | **D1 shipped** (Windows envelope; Settings shows encoding) — [DPAPI-1.2.md](./DPAPI-1.2.md) |
| Code signing (Authenticode) | **Shipped** — HFQ-ClodBreeze self-signed + trust pack + CI secrets — [PACKAGING.md](./PACKAGING.md) |
| In-app update download (D3) | **Shipped** · **1.1.1 backend:** install auto-download + disk recover + CN errors — [UPDATE-D3.md](./UPDATE-D3.md) |
| Diagnostics redaction (export) | **D4 shipped** (v2 bundle; credentials never exported) |
| Usage CSV export | **Shipped** (`usage:export` + CSV bundle + Usage page export button) — [USAGE-CSV-1.3.md](./USAGE-CSV-1.3.md) |
| Thinking / reasoning stream | **Backend shipped** · ThinkingBlock UI present — polish optional |
| React shell (Q6) | **Shipped** (1.0.10+) — pages under `apps/desktop/renderer` |

### Next train (post-1.1.4)

| Owner | Work | Notes |
|-------|------|--------|
| **Product** | **Track F — Adopt Kivio/Athena patterns** | Canonical: [ADOPT-KIVIO-ATHENA.md](./ADOPT-KIVIO-ATHENA.md) · DECISIONS Q8 |
| **F1** | Chat mermaid · Coding Profiles · model roles · skill progressive match · goal fields · memory links · bundled `diagram` | 1.1.x patch train |
| **F2** | Goal tree sidecar · Memory FTS · pdf/docx skills · optional panel prefs | 1.2+ |
| **Product** | **1.1.4** abort isolation + permission queue + live list access modes + Chat/route/CSS polish | **Shipped** (`v1.1.4`) |
| **Product** | **1.1.3** session identity + spawn cold-start + README zh | **Shipped** (`v1.1.3`) |
| **Product** | **1.1.2** full installer = 1.1.1 backend + Settings/Tasks/Changes/Models UI | **Shipped** (`v1.1.2`) |
| **Backend** | **1.1.1** D3 · `providerId` · Tasks cold-start | In 1.1.1/1.1.2 tree |
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
| B1-2 | Session-linked PTY + reattach / stop | killAll on workspace switch / quit; reattach UI later |
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
| F2-* | Goal tree sidecar · FTS · doc skills · panel prefs | after F1 |

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
| **P0** | **1.1 PTY** (design spike → implement) | Largest coding-agent gap vs peers |
| **P1** | 1.1 Changes/Git depth + Tasks observability | Coding loop + observability |
| **P2** | Optional UI polish (virtual list, focus docs) | Non-blocking |
| **P2** | 1.2 signing/DPAPI | Distribution trust |
| **P3** | Embeddings / sidecar (not React rewrite) | Only after P0–P1 |

---

## Explicit non-goals (near term)

- Full ClawHub publish marketplace  
- Silent auto-update without signing decision  
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

## Next concrete sprint (after 1.0.9 · UI-first)

1. **R1 extracts (highest priority)**  
   - `settings` page + update panel helpers  
   - `nav` / shell chrome  
   - `skills` page body (beyond pure `HFQSkillsUI`)  
   - `chat` shell: composer + message list host (behavior-preserving)  
2. **R2** Chat UX on the new modules (virtual list spike, tool cards)  
3. **1.1** PTY design spike (docs + isolated spike OK in parallel with R1)  
4. Keep `pnpm release:check` green on main  

Default next ship target: **UI architecture slice (1.0.10 or 1.1.0-ui)** then **1.1 PTY**, unless product reorders again.
