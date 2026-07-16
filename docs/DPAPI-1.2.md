# D1 — Windows DPAPI for `credentials.json`

Status: **shipped (backend)** · 2026-07-15  
Scope: at-rest encryption of provider API keys + MCP auth headers on Windows.

## Format

On Windows (default), disk file is a **version 2 envelope**:

```json
{
  "version": 2,
  "encoding": "dpapi-current-user",
  "ciphertext": "<base64 ProtectedData>"
}
```

Plaintext payload (inside ciphertext) remains credentials **v1**:

```json
{
  "version": 1,
  "providerApiKeys": { "providerId": "…" },
  "mcpHeaders": { "mcpId": { "Authorization": "…" } }
}
```

## Behavior

| Host | Behavior |
|------|----------|
| Windows | Load: decrypt envelope or accept legacy plaintext. Save: re-encrypt with DPAPI CurrentUser. |
| non-Windows | Always plaintext JSON (same as 1.0). |
| `HFQ_CREDENTIALS_PLAIN=1` | Force plaintext load/save (CI / debugging). |

**Soft migrate:** existing plaintext `credentials.json` still loads; next `saveAppConfig` / secret write rewrites as envelope. No user action required.

## Implementation

| Piece | Path |
|-------|------|
| DPAPI helpers | `packages/config/src/dpapi.ts` — PowerShell `ProtectedData` (no native addon) |
| Load / save | `packages/config/src/credentials.ts` |
| Store migration | `packages/config/src/store.ts` (unchanged call sites) |
| UI path info | `app:paths` → `credentialsEncoding`, `credentialsDpapi` |

Scope is **CurrentUser** only (not LocalMachine), so credentials do not transfer across Windows user accounts.

## Disable / test

```bash
# Force plaintext (tests default this via env in unit suites where needed)
set HFQ_CREDENTIALS_PLAIN=1
```

Unit tests cover plaintext path always; DPAPI round-trip runs only on `win32` when plain env is unset.

## Frontend contract (Settings / About)

`hfq.getAppPaths()` (or existing `app:paths`) may include:

```ts
{
  credentialsPath: string;
  credentialsEncoding: "missing" | "plaintext" | "dpapi-current-user" | "unknown";
  credentialsDpapi: boolean; // shouldUseDpapi()
}
```

Settings path grid (`pages/settings-ui.js`) shows:

| Row | Source |
|-----|--------|
| 密钥文件 | `credentialsPath` + open |
| 密钥编码 | mapped label from `credentialsEncoding` |
| DPAPI 写入 | yes/no from `credentialsDpapi` |

No new IPC required for encrypt/decrypt — it is transparent on config save/load.

## Out of scope

- Code signing (D2) — shipped (HFQ-ClodBreeze) — [PACKAGING.md](./PACKAGING.md)
- In-app update download (D3) — shipped — [UPDATE-D3.md](./UPDATE-D3.md)
- macOS Keychain / Linux secret service (future)
- Encrypting `config.json` itself (non-secret prefs stay plain)

## Residual risk

DPAPI protects against casual disk scrapers and other local users; it does **not** protect against malware running as the same Windows user. Diagnostics export still never includes the credentials body ([DIAGNOSTICS-1.2.md](./DIAGNOSTICS-1.2.md)).
