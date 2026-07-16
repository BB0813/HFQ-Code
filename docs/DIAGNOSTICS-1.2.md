# 1.2 · Diagnostics redaction (D4)

Status: **D4 backend hardened**  
Date: 2026-07-15

## Policy

Diagnostics export (`hfq.exportDiagnostics` → `diagnostics:export`) must never ship:

- `credentials.json` body (API keys / MCP auth headers)
- Raw `apiKey` / token / password fields in config
- Secret-looking environment values

## Redaction (`packages/agent-core`)

| API | Role |
|-----|------|
| `redactSecrets(text)` | OpenAI/Anthropic keys, GitHub PATs, Slack, AWS AKIA, JWT, PEM, bearer, URL userinfo |
| `redactJsonValue(obj)` | Walk JSON; sensitive **key names** fully mask string leaves |
| `redactEnvSnapshot(env)` | Allowlist PATH/proxy/etc.; secret keys → `true` presence only |
| `buildDiagnosticsBundle` | Folder under `%APPDATA%/HFQ-Code/logs/diagnostics-*` |

### Bundle layout (v2)

| File | Content |
|------|---------|
| `meta.json` | platform, version, workspace, sessionBackend, credentials **presence only**, redaction version |
| `config.redacted.json` | public config after `redactJsonValue` |
| `credentials.OMITTED.txt` | explicit omission note |
| `env.redacted.json` | allowlisted env + secret key flags |
| `sessions-index.json` | session file sizes (no full transcripts) |
| `session-sample.redacted.json` | last ~80 events of newest session, redacted |
| `log-tail-*.log` | last 32k of app logs, `redactSecrets` |
| `README.txt` | human policy reminder |

## IPC

Unchanged: `diagnostics:export` returns `{ dir, files }`. Main passes `credentialsPath` for presence check only.

## Tests

- `packages/agent-core/src/redact.test.ts`
- `packages/agent-core/src/diagnostics.test.ts`

## Out of scope (still Track D)

- D1 DPAPI for credentials at rest — **shipped** ([DPAPI-1.2.md](./DPAPI-1.2.md))
- D2 code signing — **shipped** (HFQ-ClodBreeze) — [PACKAGING.md](./PACKAGING.md)
- D3 in-app update download — **shipped** ([UPDATE-D3.md](./UPDATE-D3.md))
