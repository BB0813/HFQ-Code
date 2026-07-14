# HFQ Code 1.0.3 — Release notes

Patch over **1.0.2**: Chat session meta + composer UI aligned closer to ZCode / Codex Desktop.

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.3-x64.exe` | NSIS installer |
| `HFQ Code-1.0.3-portable.exe` | Portable |
| `SHA256SUMS.txt` | SHA-256 checksums (verify before install) |

Published via GitHub Release:  
https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.3

### Verify checksums (Windows PowerShell)

```powershell
Get-FileHash ".\HFQ Code-1.0.3-x64.exe" -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

Or Git Bash:

```bash
sha256sum -c SHA256SUMS.txt
```

## Changes

1. **Session meta card** — status / id / title / model-provider separated; no more title overflow in one pill
2. **Composer controls** — access mode + model dropdowns + `/ 命令` (replaces stacked chips)
3. **Slash / skill palette** — `/` and `$` filter, keyboard navigation, insert into input

## Upgrade

Install NSIS over 1.0.x or replace portable. User data under `%APPDATA%/HFQ-Code` is preserved.

## Verify

- [ ] Settings shows **1.0.3**
- [ ] Chat toolbar meta card truncates long titles cleanly
- [ ] Composer shows 访问 / 模型 / 命令 controls (no dense chip stack)
- [ ] Typing `/` opens command palette; `$` lists skills when available
- [ ] SHA256 of downloaded exe matches `SHA256SUMS.txt`
