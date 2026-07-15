# HFQ Code 1.0.7 — Release notes

Patch over **1.0.6**: resilient update checks when public ghproxy returns HTML.

## Why

`https://ghproxy.com/` often responds with an HTML page instead of GitHub Releases JSON, which produced:

`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

Older builds (e.g. **1.0.4**) stop there. **1.0.7** chains fallbacks.

## Fallback order (default source = ghproxy)

1. User-configured ghproxy base (default `https://ghproxy.com/`)
2. Extra mirrors: `gh-proxy.com`, `ghfast.top`, `mirror.ghproxy.com`
3. **ungh.cc** release API (no `api.github.com`)
4. Direct `api.github.com`

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.7-x64.exe` | NSIS installer |
| `HFQ Code-1.0.7-portable.exe` | Portable |
| `SHA256SUMS.txt` | SHA-256 checksums |

https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.7

## Upgrade / workaround for old clients

- Prefer upgrade to **1.0.7**
- On 1.0.4: 设置 → 更新源改为 **直连 api.github.com**，或把 ghproxy 基址改为 `https://gh-proxy.com/` 后保存再检查
- Always can open release page manually: https://github.com/BB0813/HFQ-Code/releases

## Verify

- [ ] Settings shows **1.0.7**
- [ ] With default ghproxy, 检查新版本 succeeds via fallback if ghproxy.com is HTML
- [ ] Status may show 已自动回退 ungh / 直连
- [ ] SHA256 matches `SHA256SUMS.txt`
