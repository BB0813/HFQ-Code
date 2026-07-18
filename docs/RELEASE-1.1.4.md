# HFQ Code 1.1.4

Patch over **1.1.3**: abort permission isolation, live list access-mode enrichment, permission queue, Chat/route/CSS polish. Also ships delete-sidecar cleanup and rename identity preservation.

## Why 1.1.4

**1.1.4** focuses on permission-system robustness (abort isolation, multi-session FIFO queue, `full_access` guard) plus a batch of UI/UX improvements that landed on the renderer after the 1.1.3 tag. The backend session manager now returns `permissionMode`/`planMode` directly on list calls, eliminating an extra IPC round-trip on session select.

## Highlights

### Backend

- **Abort isolation**: `pending` permission waiters are tagged with `sessionId`; `abort` only denies the requesting session tree (no longer steals another session's modal)
- **Live list enriched**: `list` / `listAll` / `get` / `create` / `setProviderModel` attach `permissionMode` + `planMode` for in-memory sessions; cold disk rows intentionally omit these (UI falls back to `getPermissionMode`)
- **Delete cleans up**: `SessionManager.delete` removes `<id>.spawn-attempts.json` sidecar + clears children/attempts/provider memory maps
- **Rename identity**: offline rename writes `model`/`providerId` into meta events so list/open keep the keys

### Desktop UI

- **Permission queue**: `pendingPermissions[]` replaces single `permission` slot — FIFO, multi-session, requestId matching. Dialog shows queue count + "other session" badge
- **`full_access` guard**: requires `window.confirm` before switching
- **selectSession** prefers list-enriched `permissionMode` over `getPermissionMode` IPC
- **Chat MessageBlock**: memoized per-message card with copy button; sticky-content scroll with "↓ 跳到底部"
- **Lazy routes**: secondary pages via `React.lazy` + `Suspense`
- **Permission dropdown**: native `<select>` → `DropdownMenu` with summary text
- **Command palette**: group headers; **ErrorBoundary**: icon + labelled title; **StatusBar**: git polling pauses on `visibilitychange`
- **CSS tokens**: migrate hardcoded colors to `--panel`, `--statusbar`, `--dialog-surface` etc.

### Docs

- FRONTEND-IPC: abort isolation semantics, list live mode enrichment

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.4-x64.exe`) + portable + `SHA256SUMS.txt`.

Prefer **1.1.4** over 1.1.3 for correct abort isolation and richer permission modal.

## Update check (test path)

1. Keep a **1.1.3** (or older) install running
2. Publish this tag as GitHub **latest** with NSIS/portable assets
3. Settings → 检查更新 should report **1.1.4**
4. Install path (auto-download when no local file) still works as in 1.1.1+
5. StatusBar / Settings shows **1.1.4**

## Verify

- [ ] `pnpm release:check` green
- [ ] Signed `HFQ Code.exe` when secrets / local `HFQ_SIGN_ROOT` present
- [ ] No `*.pfx` / password files in package tree
- [ ] Settings / status bar version **1.1.4**
- [ ] Abort only denies the aborted session's permission waiter (not another session's)
- [ ] Permission dialog shows queue count when 2+ requests pending
- [ ] `listSessions` live rows include `permissionMode`; cold disk rows omit it
- [ ] Chat messages have copy button; scroll-down shows "↓ 跳到底部"
- [ ] Switching to full_access triggers confirm dialog
- [ ] Git status pauses when window is hidden
- [ ] Lazy-loaded pages (Files, Changes, etc.) load on first visit

## Out of scope (1.1.4)

- Commercial OV/EV signing / SmartScreen reputation
- PTY reattach / Terminal interactive polish
- New major UI trains (Layout redesign, Track E)
