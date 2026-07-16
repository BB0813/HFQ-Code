# Product Decisions (Frozen)

Last updated: 2026-07-15

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

## Forward plan

Post-1.0.5 execution plan: **[ROADMAP.md](./ROADMAP.md)** · 中文总览 **[项目规划书.md](./项目规划书.md)**.

**2026-07-15 product note:** UI/UX **architecture migration is pulled forward** (R1 module split of renderer before large 1.1 page work). See Track C in ROADMAP and [UI-REDESIGN.md](./UI-REDESIGN.md).

## UI layout (2026-07-15) — **frozen: Layout A**

Selected: **A · Cursor Agent 中枢** — activity bar + session sidebar + center chat + right drawer (changes / terminal / tasks). See [LAYOUT-PROPOSALS.md](./LAYOUT-PROPOSALS.md).

**1.1 PTY:** backend ready ([PTY-1.1.md](./PTY-1.1.md)); Terminal UI lives in right drawer tab (Layout A).

## Q5 — UI component system (**superseded by Q6 / R9**)

~~R8 Choice: Shoelace 2.20.1 (Web Components), no React.~~ **Overturned 2026-07-15.**

Legacy vanilla + Shoelace tree archived at `apps/desktop/renderer-legacy/` (not packed).

## Q6 — React + shadcn shell (R9 · 2026-07-15)

**Choice: Electron renderer = React 19 + Vite 6 + Tailwind 3 + shadcn/ui (Radix), Layout A**

| Constraint | Decision |
|------------|----------|
| Framework | **Direct replace** vanilla SPA — no long-lived dual shell |
| Build | `apps/desktop/renderer` Vite app → `renderer/dist`; `base: './'` for `file://` |
| Load | `main.cjs` → `renderer/dist/index.html`; dev optional `ELECTRON_RENDERER_URL` |
| UI kit | shadcn/ui (zinc dark, IDE density) + lucide-react; **no** production Shoelace |
| State | zustand + `window.hfq` typed facade (`src/lib/hfq.ts`) |
| Router | `react-router-dom` **hash** mode (file:// safe) |
| Terminal | `@xterm/xterm` + fit addon ↔ `pty*` IPC |
| Unchanged | electron IPC semantics, agent-core, path sandbox, permission resolve |

Rationale: R8 Shoelace/vanilla polish could not reach Cursor/Claude-Desktop density; user ordered full shadcn refactor + wire ready backend APIs in one train.

## Q7 — Provider channels: delete mock / empty list / model list (2026-07-16)

**Frozen product rules (backend):**

| Rule | Decision |
|------|----------|
| Delete mock | **Allowed.** `id: mock` is a normal channel, not a reserved seed after first run. |
| Delete last channel | **Allowed.** Persist `providers: []`, `activeProviderId: ""`, `activeModel: ""`. |
| Load-time injection | **Forbidden.** Do **not** re-inject mock / anthropic on load or save. Only first-run missing `config.json` seeds `defaultAppConfig()` (includes mock). |
| Empty providers use | **Fail-closed.** `session:create` / send paths via `resolveActiveProvider`, `config:setActive`, `models:test`, `models:list` must not invent a silent mock. Prefer explicit errors or soft `{ ok: false }`. |
| Empty error keywords | Stable substrings **`no model provider`** and **`providers empty`** (case-insensitive) for frontend humanize. |
| Workbench models source | Config `providers[].models` is the persisted workbench list. |
| Remote enumeration | New IPC **`models:list`** → `listProviderModels`: OpenAI-compatible `GET {base}/models` with soft fallback to config; anthropic `source: "unsupported"` + config models. |
| Upsert validation | ≥1 model; `defaultModel` ∈ models (or coerced to models[0]); `baseURL` required for `openai_compatible` / `anthropic`. |
| Credentials on delete | `saveAppConfig` overwrites credentials from current providers only → deleted provider keys are dropped. |
| Session identity fields | `SessionInfo` / `session.meta` / list+open carry **`model`** + **`providerId`**; sub-agents also `parentSessionId` / `goal` / `subagentProfile` / `subagentDepth`. |
| setActive hot-swap | `config:setActive` returns `sessionApplied?: { id, model, providerId } \| null` and `sessionApplyError?`. |

Frontend Models / Tasks already consume this contract; do not rename preload APIs.

