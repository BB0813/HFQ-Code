# HFQ Code 1.0.8 — Release notes

Patch over **1.0.7**: model/provider visibility + composer menus open upward.

## Changes

1. **Topbar provider badge** — always shows `提供方名 · 模型`; click opens Models page  
2. **Composer model control** — label is model id only (not full channel name)  
3. **Dropdowns open upward** — access mode + model menus use `bottom: 100%` so they sit above the composer  
4. Session meta: provider chip before model chip  

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.8-x64.exe` | NSIS installer |
| `HFQ Code-1.0.8-portable.exe` | Portable |
| `SHA256SUMS.txt` | SHA-256 checksums |

https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.8

### Verify checksums (Windows PowerShell)

```powershell
Get-FileHash ".\HFQ Code-1.0.8-x64.exe" -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

## Upgrade

Install NSIS over 1.0.x or replace portable. `%APPDATA%/HFQ-Code` preserved.

## Verify

- [ ] Settings / about shows **1.0.8**
- [ ] Topbar shows provider · model; click → 模型页
- [ ] Composer: `模型 <id>` only; menu opens **up**
- [ ] Access mode menu also opens up
- [ ] SHA256 matches `SHA256SUMS.txt`
