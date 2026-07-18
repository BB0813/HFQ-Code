# HFQ Code 1.1.3

Patch over **1.1.2**: session identity always present on list APIs, Tasks cold-start for `goal_required` spawn failures, desktop UI helpers, CI diagnostics isolation. Also ships bilingual README + version history.

## Highlights

### Session identity
- `listSessions` / list items **always** expose `model` and `providerId` (empty string when unbound; never omit keys for old transcripts)
- Desktop: `sessionModel` / `sessionProviderId` helpers in header, status bar, chat, sidebar, tasks, store

### Tasks / sub-agent cold-start
- Persist **`goal_required`** (and similar) failed spawn attempts so `listSpawnAttempts` survives app restart
- Prefer `attemptId`; clearer chip labels when goal is missing

### CI / tests
- Diagnostics tests isolate `HFQ_DATA_DIR` so parallel/CI runs do not clobber each other

### Docs
- [README.md](../README.md) · [README.zh-CN.md](../README.zh-CN.md) with cross-links and version history tables
- CHANGELOG 1.1.3

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.3-x64.exe`) + portable + `SHA256SUMS.txt`.

Prefer **1.1.3** over 1.1.2 for correct session identity in UI and durable Tasks spawn failures.

## Update check (test path)

1. Keep a **1.1.2** (or older) install running
2. Publish this tag as GitHub **latest** with NSIS/portable assets
3. Settings → 检查更新 should report **1.1.3**
4. Install path (auto-download when no local file) still works as in 1.1.1+
5. StatusBar / Settings shows **1.1.3**

## Verify

- [ ] `pnpm release:check` green
- [ ] Signed `HFQ Code.exe` when secrets / local `HFQ_SIGN_ROOT` present
- [ ] No `*.pfx` / password files in package tree
- [ ] Settings / status bar version **1.1.3**
- [ ] `listSessions` items always have `model` + `providerId` keys
- [ ] After restart: Tasks still shows failed spawn with `goal_required` (or missing goal label)
- [ ] Header / StatusBar / Chat model chips use session identity helpers
- [ ] README EN ↔ ZH links work; version history tables present

## Out of scope (1.1.3)

- Commercial OV/EV signing / SmartScreen reputation
- New major UI trains (PTY reattach polish, embeddings, etc.)
