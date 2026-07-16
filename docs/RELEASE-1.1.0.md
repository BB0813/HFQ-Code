# HFQ Code 1.1.0

Minor release over **1.0.10**: provider channel lifecycle (delete mock / empty list), remote model list, session model rebind + identity pin, third-party baseURL fixes.

## Highlights

### Providers / Models
- **Delete any channel** including `mock` and the last channel → `providers: []` is valid
- **No load/save re-inject** of mock/anthropic; only first-run seeds `defaultAppConfig()`
- **Fail-closed** when empty: session create / setActive / resolveActive throw or soft-fail; never silent mock fallback
- **`models:list`** IPC (`listProviderModels`): OpenAI-compatible `GET {base}/models` with soft fallback to config; Anthropic `source: unsupported`
- Upsert requires ≥1 model; `baseURL` required for openai_compatible / anthropic
- Credentials overwrite on save drops deleted provider keys
- OpenAI-compatible baseURL normalize (e.g. OpenCode `/zen` → `/zen/v1`) + humanized HTTP errors

### Session model binding
- `session:open` rebinds live/resume session to global active provider/model by default
- `session:send` best-effort re-pin before each turn
- `setProviderModel` hot-swap + durable `session.meta`
- Per-request **identity pin**: redacts stale “我是 grok-…” history for the API call only; pins current model at message end (UI transcript unchanged)
- Create always writes `session.meta.model` without locking auto-title

### Docs
- `docs/DECISIONS.md` Q7 · `docs/FRONTEND-IPC.md` Models section

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.0-x64.exe`) + portable (`HFQ Code-1.1.0-portable.exe`) + `SHA256SUMS.txt`.

See [PACKAGING.md](./PACKAGING.md) and README SmartScreen notes.

## Update check (test path)

1. Keep a **1.0.10** install running
2. Publish this tag as GitHub **latest** release with the NSIS/portable assets
3. Settings → 检查更新 (or startup check) should report **1.1.0**
4. Download → install/open → StatusBar / Settings shows **1.1.0**

## Verify

- [ ] `pnpm release:check` green
- [ ] Signed `HFQ Code.exe` when secrets / local `HFQ_SIGN_ROOT` present
- [ ] No `*.pfx` / password files in package tree
- [ ] Settings / status bar version **1.1.0**
- [ ] Delete last provider → empty list; create session fails with clear error
- [ ] `listProviderModels` soft-falls back on remote failure
- [ ] Switch global model, send in old session → new reply uses new model id (history bubbles may still show old self-claim)
- [ ] Update check from 1.0.10 finds 1.1.0

## Out of scope (1.1.0)

- Renderer-only Models empty-state polish may ship with frontend agent follow-up
- Commercial OV/EV signing / SmartScreen reputation
