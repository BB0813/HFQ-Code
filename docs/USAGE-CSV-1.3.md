# Usage CSV export (Track E stretch)

Status: **shipped (backend + desktop UI)** · 2026-07-15

## IPC

| Channel | Preload | Result |
|---------|---------|--------|
| `usage:summary` | `hfq.usageSummary()` | existing aggregate (unchanged) |
| `usage:export` | `hfq.usageExport()` | `{ dir, files }` |

Export directory:

```text
%APPDATA%/HFQ-Code/exports/usage-<ISO-stamp>/
  usage-sessions.csv
  usage-daily.csv
  usage-summary.json
```

Pricing uses prefs `usageInputPerMillion` / `usageOutputPerMillion` when set (same as summary).

## CSV columns

**usage-sessions.csv:**  
`sessionId,title,model,workspacePath,day,inputTokens,outputTokens,totalTokens,estimatedCostUsd,updatedAt`

**usage-daily.csv:**  
`day,sessions,inputTokens,outputTokens,totalTokens,estimatedCostUsd`

Fields with commas/quotes are RFC-style escaped.

## Core API

```ts
usageSessionsToCsv(summary)
usageDailyToCsv(summary)
exportUsageCsvBundle(summary, outDir) → { dir, files }
```

`packages/agent-core/src/usage.ts`

## Frontend

Usage page (`pageUsage` / `bindUsageHandlers` in `apps/desktop/renderer/app.js`):

- `#usageExportBtn` → `window.hfq.usageExport()` → `{ dir, files }`
- Status line shows export path; then `window.hfq.openPath({ path: res.dir })` (same pattern as diagnostics)
- `#usageRefreshBtn` still calls `usageSummary()`
