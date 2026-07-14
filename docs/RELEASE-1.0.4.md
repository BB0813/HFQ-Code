# HFQ Code 1.0.4 — Release notes

Patch over **1.0.3**: real `/goal` long-running turns + default update checks via ghproxy.

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.4-x64.exe` | NSIS installer |
| `HFQ Code-1.0.4-portable.exe` | Portable |
| `SHA256SUMS.txt` | SHA-256 checksums (verify before install) |

Published via GitHub Release:  
https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.4

### Verify checksums (Windows PowerShell)

```powershell
Get-FileHash ".\HFQ Code-1.0.4-x64.exe" -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

Or Git Bash:

```bash
sha256sum -c SHA256SUMS.txt
```

## Changes

1. **`/goal` long-running tasks** — agent-core slash runtime; this turn gets elevated budgets (32 rounds / +400 tool calls); Tasks page goal rows; bare `/goal` usage hint; `/compact` expands into an explicit compression request
2. **Update check via ghproxy (default)** — Releases API through `https://ghproxy.com/https://api.github.com/.../releases/latest` to avoid CN timeouts; Settings can switch to direct GitHub or custom mirror base; mirrored download buttons when available
3. Still **manual download only** — no electron-updater / silent install

## Upgrade

Install NSIS over 1.0.x or replace portable. User data under `%APPDATA%/HFQ-Code` is preserved. New prefs keys (`updateSource`, `updateProxyBase`) default on first load.

## Verify

- [ ] Settings shows **1.0.4**
- [ ] Composer palette inserts `/goal ` / `/compact `; sending `/goal 做某事` elevates the turn (status / Tasks)
- [ ] Settings → 检查更新 defaults to ghproxy; status line shows 经由 ghproxy
- [ ] Switch to 直连 and re-check works (may timeout on restricted networks)
- [ ] SHA256 of downloaded exe matches `SHA256SUMS.txt`
