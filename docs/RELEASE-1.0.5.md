# HFQ Code 1.0.5 — Release notes

Patch over **1.0.4**: update-check fallback, `/goal` budget hints, Skills store scaffold, UI redesign roadmap.

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.5-x64.exe` | NSIS installer |
| `HFQ Code-1.0.5-portable.exe` | Portable |
| `SHA256SUMS.txt` | SHA-256 checksums (verify before install) |

Published via GitHub Release:  
https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.5

### Verify checksums (Windows PowerShell)

```powershell
Get-FileHash ".\HFQ Code-1.0.5-x64.exe" -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

## Changes

1. **Update check** — ghproxy failure auto-retries direct GitHub once; status shows fallback
2. **`/goal`** — clear system message when round budget is exhausted; task detail keeps caps
3. **Skills store (beta)** — 已安装 / 商店 tabs; curated + optional remote catalog; install from local folder
4. **UI redesign TODO** — [docs/UI-REDESIGN.md](./UI-REDESIGN.md) (R0 inventory shipped)

## Upgrade

Install NSIS over 1.0.x or replace portable. User data under `%APPDATA%/HFQ-Code` is preserved.

## Verify

- [ ] Settings shows **1.0.5**
- [ ] 检查更新: force check works; if ghproxy flaky, may show 回退直连
- [ ] Skills → 技能商店 shows catalog cards; 从文件夹安装 copies SKILL.md pack
- [ ] `/goal …` still elevates turn; Stop cancels goal task on Tasks page
- [ ] SHA256 matches `SHA256SUMS.txt`
