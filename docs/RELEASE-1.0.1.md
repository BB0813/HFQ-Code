# HFQ Code 1.0.1 — Release notes

Patch over **1.0.0**: official logo + model-identity fix + eval/test isolation.

## Artifacts

| File | Kind |
|------|------|
| `HFQ Code-1.0.1-x64.exe` | NSIS installer |
| `HFQ Code-1.0.1-portable.exe` | Portable |

Published via GitHub Actions on tag `v1.0.1`:  
https://github.com/BB0813/HFQ-Code/releases/tag/v1.0.1

## Changes

1. **Brand** — HFQ monogram app icon on window, shortcuts, installer; sidebar logo asset.
2. **Model honesty** — system prompt includes configured model id (e.g. `grok-4.5`); no invented GPT-5.x identity.
3. **Data hygiene** — `HFQ_DATA_DIR` for tests/eval/smoke so temp sessions no longer pollute `%APPDATA%/HFQ-Code`.
4. **Cleanup helper** — `node scripts/purge-temp-sessions.mjs` for leftover eval/test transcripts.

## Upgrade

Install NSIS over 1.0.0 or replace portable. User data under `%APPDATA%/HFQ-Code` is preserved.

If the UI still shows a temp workspace (`...\Temp\hfq-eval-*`), open a real project folder or run the purge script once.

## Verify

- [ ] Settings / about shows **1.0.1**
- [ ] Taskbar / window icon is the HFQ logo
- [ ] New chat with real model answers the configured model id (not GPT-5.2)
- [ ] `pnpm eval` does not create sessions under `%APPDATA%/HFQ-Code/sessions` for temp workspaces
