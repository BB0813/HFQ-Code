# HFQ Code 1.1.7

Update ladder **L1+L2** over **1.1.6**: optional background auto-download after update check, ready-state UI, and one-click **confirmed** install (still NSIS wizard via `shell.openPath`). Full **L3** silent install is **not** in this release — see **1.1.8**.

Canonical: [UPDATE-L1-L3.md](./UPDATE-L1-L3.md) · [DECISIONS.md](./DECISIONS.md) Q9 · [prompts/1.1.7-handoff.md](./prompts/1.1.7-handoff.md).

## Why 1.1.7

**1.1.6** kept D3 as check → manual download → confirm → open installer. Users who want less friction still should not get silent replacement without a later opt-in. **1.1.7** ships the guided middle steps: download in the background when allowed, surface **ready**, install with an explicit click + confirm. `silentInstall` is stored for **1.1.8** only.

## Highlights

### L1 — Background auto-download

- `prefs.updatePolicy.autoDownload` (default **false**): when a check finds a newer version, download the installer under `%APPDATA%\HFQ-Code\updates\` without installing
- `autoCheck` + `checkIntervalHours` (1–168, default 24) coordinate startup / interval checks
- HTTPS host allowlist and updates sandbox unchanged

### L2 — Ready UI + one-click install

- Download status: `idle` / `checking` / `downloading` / **`ready`** / `failed` / `up_to_date` (plus existing fields)
- Settings shows **新版本已就绪** and primary **安装更新**
- Install path remains: confirm dialog → `shell.openPath` (NSIS wizard); `quitSuggested` retained
- **Not** silent / unattended upgrade

### L3 placeholder only

- `silentInstall` / `silentInstallAcceptedAt` may be persisted
- Settings switch is disabled / labeled as **1.1.8 预置**
- This build **never** auto-installs because of `silentInstall`

### Safety

- Self-signed **HFQ-ClodBreeze** / SmartScreen notes still apply
- No secrets in package tree; path allowlist for downloads unchanged

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.7-x64.exe`) + portable + `SHA256SUMS.txt`.

Prefer **1.1.7** over 1.1.6 for guided auto-download + ready install. Prefer **1.1.6** only if you need a freeze without update-policy prefs.

## Update check (test path)

1. Keep a **1.1.6** (or older) install
2. Publish this tag as GitHub **latest**
3. Settings → 检查更新 should report **1.1.7**
4. After upgrading to 1.1.7: enable **有更新时后台自动下载**, save; on a later newer release, expect download → ready → 安装更新 (confirm + wizard)

## Verify

- [ ] `pnpm release:check` green
- [ ] Signed when secrets / `HFQ_SIGN_ROOT` present
- [ ] No `*.pfx` / password files in package tree
- [ ] StatusBar / Settings version **1.1.7**
- [ ] Settings switches persist across restart
- [ ] `autoDownload` off ≈ 1.1.6 manual download path
- [ ] `autoDownload` on + newer version → progress → ready (no auto install)
- [ ] 安装更新 still confirms + opens `.exe`
- [ ] Disabled silent-install control does **not** trigger install
- [ ] 1.1.6 install sees **1.1.7** via update check after this is latest

## Out of scope (1.1.7)

- **Full L3**: pending-install marker, quit then NSIS `/S`, no-wizard silent upgrade → **1.1.8**
- electron-updater migration
- Memory FTS / Goal OS / Layout redesign
- Claiming “automatic silent install” in product copy
