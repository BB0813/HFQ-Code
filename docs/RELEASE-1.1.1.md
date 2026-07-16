# HFQ Code 1.1.1

Patch release over **1.1.0**: D3 install auto-download, session `providerId` identity fields, Tasks cold-start persistence for children + spawn attempts.

## Highlights

### Updates (D3)
- **`update:install`** auto-downloads recommended installer when no local file (`autoDownload` defaults on)
- **`resolveInstallerPath`**: recover newest `updates/*.exe` from disk after restart
- Chinese error strings for concurrent download / missing installer

### Session identity
- `SessionInfo` / `session.meta` / list+open carry optional **`providerId`**
- `config:setActive` returns `sessionApplied: { id, model, providerId }`
- Empty providers: stable keywords `providers empty` / `no model provider`

### Sub-agent persistence (Tasks)
- **`listChildren` / `listChildSessions`**: cold-start rebuild from disk JSONL via `parentSessionId`
- **`listSpawnAttempts`**: durable `%data%/sessions/<parentId>.spawn-attempts.json` (cap 50; depth/goal failures kept)
- `open` restores parent/goal/profile/depth and re-links children map

### Docs / tests
- FRONTEND-IPC Tasks cold-start table · SUBAGENT-OBS persistence · session cold-start tests

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.1-x64.exe`) + portable (`HFQ Code-1.1.1-portable.exe`) + `SHA256SUMS.txt`.

See [PACKAGING.md](./PACKAGING.md) and README SmartScreen notes.

## Update check (test path)

1. Keep a **1.1.0** (or **1.0.10**) install running
2. Publish this tag as GitHub **latest** release with the NSIS/portable assets
3. Settings → 检查更新 should report **1.1.1**
4. **Install** without prior download should auto-download then open installer (1.1.1+)
5. StatusBar / Settings shows **1.1.1**

## Verify

- [ ] `pnpm release:check` green
- [ ] Signed `HFQ Code.exe` when secrets / local `HFQ_SIGN_ROOT` present
- [ ] No `*.pfx` / password files in package tree
- [ ] Settings / status bar version **1.1.1**
- [ ] Cold restart: Tasks still lists child sessions for parent
- [ ] Depth-fail spawn still visible via `listSpawnAttempts` after restart
- [ ] Install update without separate download succeeds (auto-download)
- [ ] `sessionApplied.providerId` present on setActive when live session exists

## Out of scope (1.1.1)

- Renderer-only polish (Settings update UX, B2/B3 UI) may ship via frontend agent; APIs already stable
- Commercial OV/EV signing / SmartScreen reputation
