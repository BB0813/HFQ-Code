# HFQ Code 1.0.6 — Release notes

Patch over **1.0.5**: Skills store preview/conflict/tags, Chat goal banner, R1 `skills-ui.js` extract.

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.6-x64.exe` | NSIS installer |
| `HFQ Code-1.0.6-portable.exe` | Portable |
| `SHA256SUMS.txt` | SHA-256 checksums (verify before install) |

Published via GitHub Release:  
https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.6

### Verify checksums (Windows PowerShell)

```powershell
Get-FileHash ".\HFQ Code-1.0.6-x64.exe" -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

## Changes

1. **Skills preview drawer** — read `SKILL.md` under allowed skill roots; pick folder or by name
2. **Install conflict** — `already_exists` → confirm overwrite; retry with same `sourceDir`
3. **Tag chips** — filter catalog cards by tag
4. **Goal banner** — in-progress `/goal` strip in Chat with 任务页 / 停止
5. **R1 extract** — `skills-ui.js` pure helpers (`HFQSkillsUI`)
6. **Update status** — truncated `apiUrl` on Settings check line

## Out of scope (still later)

- Remote zip package install (1.0.7)
- Full renderer module split / React (UI redesign R1+)
- PTY terminal, DPAPI, code signing

## Upgrade

Install NSIS over 1.0.x or replace portable. User data under `%APPDATA%/HFQ-Code` is preserved.

## Verify

- [ ] Settings shows **1.0.6**
- [ ] Skills → 商店：标签 chips 过滤；预览已安装 / 选文件夹
- [ ] 从文件夹安装重复技能 → 询问覆盖且成功
- [ ] `/goal …` 运行中 Chat 顶栏横幅；停止结束任务
- [ ] 检查更新状态含 API 路径片段
- [ ] SHA256 matches `SHA256SUMS.txt`
