# HFQ Code — Development roadmap (post-1.0.5)

Status: **active plan**  
Baseline: product **1.0.9** (`v1.0.9`) · 2026-07-15  
Last updated: 2026-07-15

## Positioning (frozen)

- Windows-first **desktop coding agent** — not an IM gateway  
- Manual update channel by default (check → download; no silent auto-install unless later decision + code signing)  
- Workspace path-escape rejection; secrets never committed  
- Large changes still check [DECISIONS.md](./DECISIONS.md) + [ARCHITECTURE.md](./ARCHITECTURE.md)

## Where we are

| Area | State after 1.0.9 |
|------|-------------------|
| Agent loop + tools + worker | Shipped |
| Access modes / permission modal | Shipped (1.0.2+) · **1.0.9** timeout + crash unlock |
| Chat composer polish | Shipped (1.0.3 · **1.0.8** upward menus + model-only label) |
| `/goal` long-run + Tasks + Chat banner | Shipped (1.0.4–1.0.6) |
| Update check multi-source fallback | **Shipped** (1.0.5–1.0.7): mirrors → ungh → direct |
| Skills store (preview / conflict / tags / **remote zip**) | **Shipped** (1.0.6 + **1.0.9**) |
| True interactive Terminal (PTY) | **Not shipped** (one-shot shell) |
| DPAPI credentials / code signing / electron-updater | **Not shipped** |
| Renderer split / full UI redesign | **R1 started** (`skills-ui.js`) — [UI-REDESIGN.md](./UI-REDESIGN.md) |

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
| **P0** | 1.0.7 remote packages (A2) | Real “ClawHub slowly” |
| **P0** | R1 continue (nav/settings modules) | Enables later UI work |
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

## Next concrete sprint (after 1.0.9)

1. Continue R1: more renderer extracts beyond `skills-ui.js`  
2. **1.1** node-pty / ConPTY design spike when ready  
3. Changes / Git UX polish (Track B2) when capacity allows  
4. Keep `pnpm release:check` green on main  

Default next ship target: **1.1** (PTY spike) unless product priority changes.
