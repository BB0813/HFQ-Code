# HFQ Code 1.0.0 — Release notes

**Date:** 2026-07-15  
**Channel:** manual (no auto-updater)

## Artifacts (this machine)

Built with `pnpm pack:win` into `apps/desktop/release/`:

| File | Kind | ~Size |
|------|------|-------|
| `HFQ Code-1.0.0-x64.exe` | NSIS installer | ~83 MB |
| `HFQ Code-1.0.0-portable.exe` | Portable | ~83 MB |
| `win-unpacked/` | Unpacked app (debug / pack:verify) | — |

Unsigned (no code-signing cert). SmartScreen may warn; choose “More info → Run anyway” for internal use.

## Quality gates (pre-pack)

| Gate | Result |
|------|--------|
| `pnpm release:check` | build + **91** tests + `SMOKE_PASS` + **EVAL 10/10** |
| `SKIP_PACK=1 pnpm pack:verify` | `PACK_VERIFY_PASS` (exe, skills, worker entry, version) |

## What’s in 1.0.0

- Full coding-agent desktop (Session / Changes / Terminal / Tasks / Skills / MCP / Models / Permissions / Memory / Import / Usage / Settings)
- Secrets: `credentials.json` (M3.1)
- Session **worker** child process (M3.3) + in-process fallback
- Security harden (M3.0)
- Packaging scripts: `release:check`, `pack:verify`, `pack:win`

Deferred: interactive PTY, electron-updater, DPAPI, OAuth MCP, IM gateway.

## Install / update

1. **NSIS:** run `HFQ Code-1.0.0-x64.exe`, install over previous version if any.  
2. **Portable:** run `HFQ Code-1.0.0-portable.exe` (or extract/replace folder).  
3. Data remains under `%APPDATA%/HFQ-Code` (`config.json`, `credentials.json`, sessions).

## Smoke checklist (operator)

- [ ] Launch app; Settings shows version **1.0.0**
- [ ] Open a workspace folder
- [ ] New session → send “list” / “read README” (mock or real model)
- [ ] Optional: write a small file and confirm **Changes**
- [ ] Settings → 导出诊断包
- [ ] Quit cleanly; reopen resumes data dir

## GitHub

- Repo: https://github.com/BB0813/HFQ-Code  
- Tag: `v1.0.0` (push triggers **Release** workflow → NSIS + portable on the GitHub Release page)

```bash
git tag -a v1.0.0 -m "HFQ Code 1.0.0"
git push origin v1.0.0
```

Local artifacts under `apps/desktop/release/` remain useful for offline smoke; CI uploads the same class of binaries.
## Rebuild

```bash
pnpm release:check
pnpm pack:win
```

See [PACKAGING.md](./PACKAGING.md) · [CHANGELOG.md](../CHANGELOG.md) · [PHASE3-STATUS.md](./PHASE3-STATUS.md).
