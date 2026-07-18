# HFQ Code 1.1.5

Track F1 over **1.1.4**: Coding Profiles, Chat mermaid rendering, skill progressive match, goal driver fields, memory links, bundled diagram skill.

Canonical reference: [docs/ADOPT-KIVIO-ATHENA.md](./ADOPT-KIVIO-ATHENA.md) · [DECISIONS.md](./DECISIONS.md) Q8.

## Why 1.1.5

**1.1.5** is the F1 patch train adopting select Kivio Desktop + AthenaOS capability patterns: coding role presets, rich chat code rendering, on-demand skill body injection, structured goal tracking, and memory linking — all additive and backward compatible.

## Highlights

### Coding Profiles

- Config schema + 6 built-in profiles seeded on first config load: **Refactor** / **Debug** / **Review** / **Docs** / **Frontend** / **Research**
- Each profile carries `systemAddon` (appended to system prompt), `skillIds` (soft preference), optional `permissionMode` / `providerId` / `model`
- Settings UI: chip selector, profile description, skillMatch on/off
- **New sessions** created from profile get system addon + preferred skill matching + optional access mode

### Chat mermaid

- Agent messages now render through **MarkdownMessage** component using mermaid.js (`securityLevel: "strict"`)
- Fenced ```` ```mermaid ```` blocks render as diagrams; invalid syntax falls back to plain code block
- Streaming text also passes through MarkdownMessage
- Agent system prompt nudged to prefer mermaid for architecture / flow / state diagrams

### Skill progressive match

- `matchSkills()`: ranks skills by user text tokens + profile `skillIds` preference; returns top-K with score + reasons
- `formatMatchedSkillBodies()`: injects full skill bodies under the index into system prompt
- Per-turn: system prompt rebuilt when user text changes (maximum 2 bodies, 6 000 chars each)

### Goal driver fields

- `task.updated` extends `UiTask` with `kind` / `objective` / `progress` / `budget` / `blockedReason` / `acceptance`
- Chat goal banner shows active goal with progress % + blocked indicator
- Tasks panel: dedicated goal section with progress bar, objective detail, budget chips

### Memory links

- `MemoryDoc` / `MemoryHit` carry optional `links[]` (max 32 per note)
- `createFileMemory` stores and replays links; MemoryPage displays tags + links chips

### Bundled skills

- `skills/bundled/diagram/SKILL.md`: mermaid-first architecture diagram skill

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.5-x64.exe`) + portable + `SHA256SUMS.txt`.

Prefer **1.1.5** over 1.1.4 for coding profiles, mermaid rendering, and structured goals.

## Update check (test path)

1. Keep a **1.1.4** (or older) install running
2. Publish this tag as GitHub **latest** with NSIS/portable assets
3. Settings → 检查更新 should report **1.1.5**
4. StatusBar / Settings shows **1.1.5**

## Verify

- [ ] `pnpm release:check` green
- [ ] Signed `HFQ Code.exe` when secrets / local `HFQ_SIGN_ROOT` present
- [ ] No `*.pfx` / password files in package tree
- [ ] Settings / status bar version **1.1.5**
- [ ] Settings: Coding Profiles chips selectable; skillMatch toggle works
- [ ] New session with profile "Debug" → agent prompt includes profile addon
- [ ] Chat: agent mermaid fence renders as diagram; invalid syntax falls back to code block
- [ ] `/goal 修复登录超时` → Tasks shows goal row with progress bar
- [ ] Memory: notes with links display 🔗 chips in MemoryPage
- [ ] Lazy-loaded pages work (F1 added no new static imports)
- [ ] Session switch does not show stale tasks from previous session

## Out of scope (1.1.5)

- Track F2 (Goal tree sidecar · Memory FTS5 · pdf/docx skills · optional panel prefs)
- Commercial OV/EV signing / SmartScreen reputation
- PTY reattach / Terminal interactive polish
