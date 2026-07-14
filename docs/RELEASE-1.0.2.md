# HFQ Code 1.0.2 — Release notes

Patch over **1.0.1**: access modes, permission modal reliability, Windows app icon stamp, in-app update check.

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.2-x64.exe` | NSIS installer |
| `HFQ Code-1.0.2-portable.exe` | Portable |
| `SHA256SUMS.txt` | SHA-256 checksums (verify before install) |

Published via GitHub Release:  
https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.2

### Verify checksums (Windows PowerShell)

```powershell
Get-FileHash ".\HFQ Code-1.0.2-x64.exe" -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

Or Git Bash:

```bash
sha256sum -c SHA256SUMS.txt
```

## Changes

1. **Access modes** — 变更前确认 / 自动编辑 / 计划模式 / 完全访问（全局默认 + 会话切换；完全访问含危险 Shell YOLO 警告）
2. **Permission modal** — 队列 + resolve 成功后再关闭，避免授权卡死
3. **App icon stamp** — `afterPack` 把 HFQ `icon.ico` 写入 `HFQ Code.exe`（任务栏/快捷方式）
4. **Check for updates** — 设置页查询 GitHub Releases；启动可选静默检查；仅打开下载页，不自动安装

## Upgrade

Install NSIS over 1.0.x or replace portable. User data under `%APPDATA%/HFQ-Code` is preserved.

## Verify

- [ ] Settings shows **1.0.2**
- [ ] Taskbar / shortcut icon is HFQ monogram
- [ ] Chat toolbar access mode menu works
- [ ] Settings → 检查更新 returns GitHub latest (or “已是最新”)
- [ ] SHA256 of downloaded exe matches `SHA256SUMS.txt`
