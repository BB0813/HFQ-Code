# Frontend IPC contract (backend ready)

**Audience:** UI / renderer agent  
**Date:** 2026-07-15  
**Source of truth:** `apps/desktop/electron/preload.cjs` → `window.hfq`

All mutating git/shell/PTY APIs require a bound workspace unless noted. Path tools reject workspace escape.

---

## Quick map by page

| Page | Primary APIs |
|------|----------------|
| **Chat** | `onSessionEvent` · `message.delta` / `message.completed` · **`thinking.delta` / `thinking.completed`** (CoT) · permission / tool events · **`pickWorkspaceFiles`** (composer 引用) |
| **Files** | **`listWorkspaceDir`** · `readWorkspaceText` · `writeWorkspaceText` · `openInEditor` / `openWorkspaceFile` · `revealInFolder` |
| **Terminal** | `ptyCreate` · `ptyWrite` · `ptyResize` · `ptyKill` · `ptyList` · `ptyShells` · `onPtyData` · `onPtyExit` · prefs `terminalShell` |
| **Changes** | Session `state.changes` + `revertChange` / **`writeChangeContent`（人工编辑）** · **repo:** `gitStatus` · `gitDiff` · `gitShow` · `gitStage` · `gitUnstage` · `gitCommit` · `gitLog` |
| **Models** | `getConfig` · `setActiveModel` · `testModel` · **`listProviderModels`** · **`upsertProvider`** · **`removeProvider`** |
| **Tasks** | Snapshot tasks · `listChildSessions` · `listSpawnAttempts` · `spawnSubagent` · event `subagent.updated` |
| **Usage** | `usageSummary` · `usageExport` · `revealInFolder` on export dir |
| **Settings** | `getAppPaths` (`credentialsEncoding`) · `setPrefs` · `exportDiagnostics` |

---

## Terminal (PTY)

```js
// Optional: list shells + current pref
const { shells, preferred } = await hfq.ptyShells();
// shells: [{ kind, file, available, label }, ...]
// preferred: "" | "powershell" | "pwsh" | "cmd"

// Persist default shell (Settings)
await hfq.setPrefs({ terminalShell: "pwsh" }); // or "" for auto

// Create (shell omitted → prefs.terminalShell → auto)
const info = await hfq.ptyCreate({
  cols: 120,
  rows: 30,
  cwd: null,           // workspace root default; relative path ok
  shell: null,         // override one-shot
  label: sessionId,    // optional UI tag
  workspacePath: null, // default active workspace
});
// → { id, pid, cwd, shell, backend: "node-pty"|"spawn-pipe", cols, rows, label, createdAt }

const offData = hfq.onPtyData(({ id, data }) => { /* xterm.write(data) */ });
const offExit = hfq.onPtyExit(({ id, exitCode, signal }) => { /* status bar */ });

await hfq.ptyWrite({ id: info.id, data: "dir\r" });
await hfq.ptyResize({ id: info.id, cols: 140, rows: 40 });
await hfq.ptyList(); // all live sessions
await hfq.ptyKill({ id: info.id });
offData(); offExit();
```

**Notes**

- Workspace switch / app quit → all PTYs killed by main.
- Backend may be `spawn-pipe` if native `node-pty` missing (limited interactivity).
- One-shot agent shell remains `hfq.runShell` (unchanged).

Detail: [PTY-1.1.md](./PTY-1.1.md)

---

## Changes / Git

```js
const st = await hfq.gitStatus({ includeLog: true, maxEntries: 200 });
// isRepo, branch, dirty, entries[{ xy, path, origPath? }], head, recent?, …

const diff = await hfq.gitDiff({ path: "src/a.ts", staged: false });
const show = await hfq.gitShow({ object: "HEAD", path: "src/a.ts" });

await hfq.gitStage({ paths: ["src/a.ts"] });
await hfq.gitUnstage({ paths: ["src/a.ts"] });
await hfq.gitCommit({ message: "fix: …", paths: [] }); // empty paths = commit staged

const log = await hfq.gitLog({ max: 30 });
// entries: [{ sha, shortSha, subject, author, relativeDate, isoDate }]
```

Agent file list still comes from session events (`diff.updated` / snapshot `changes`) + `revertChange` / `writeChangeContent`.

Detail: [CHANGES-GIT-1.1.md](./CHANGES-GIT-1.1.md)

---

## Tasks / sub-agents

```js
const children = await hfq.listChildSessions({ sessionId });
// SessionInfo always has model + providerId ("" if unknown);
// may also include parentSessionId, subagentProfile, subagentDepth, goal
// Cold start: merges live parent→children map + disk sessions (filter parentSessionId)

const attempts = await hfq.listSpawnAttempts({ sessionId });
// failed spawns without childSessionId included
// Cold start: loads %data%/sessions/<parentId>.spawn-attempts.json (cap 50)

await hfq.spawnSubagent({ sessionId, goal: "…", profile: "explore" });
// { ok, childSessionId, summary, error?, errorCode? }

hfq.onSessionEvent((ev) => {
  if (ev.type === "subagent.updated") {
    // status: started | completed | failed
    // errorCode: depth | goal_required | create_failed | run_failed
  }
});
```

| API | Cold-start behavior (1.1.1) |
|-----|------------------------------|
| `listChildSessions` | Memory map + scan session JSONL by `parentSessionId` (dedupe; prefer live fields) |
| `listSpawnAttempts` | Memory first; else `%data%/sessions/<parentId>.spawn-attempts.json` (incl. depth/goal failures) |
| `open` child | Restores parent/goal/profile/depth from meta and re-links children map |
| `delete(sessionId)` | Removes JSONL + `<id>.spawn-attempts.json`; clears memory maps. **Does not** cascade-delete child transcripts (orphans keep `parentSessionId`) |
| `abort(sessionId)` | Stops that session + live children; **only** denies permission waiters for that tree (other sessions' modals stay) |

Detail: [SUBAGENT-OBS-1.1.md](./SUBAGENT-OBS-1.1.md)

---

## Chat — thinking / reasoning stream

```js
hfq.onSessionEvent((ev) => {
  if (ev.type === "thinking.delta") {
    // Live CoT chunk; same messageId as the assistant reply of this model round
    // { sessionId, messageId, text, at }
  }
  if (ev.type === "thinking.completed") {
    // Full reasoning for the round (also in snapshot.messages as role: "thinking")
  }
  if (ev.type === "message.delta" || ev.type === "message.completed") {
    // Existing assistant body path
  }
});
// Resume: snapshot.messages may include { role: "thinking", text, messageId, thinking: true }
// Collapse by default; never send role "thinking" back to the model.
```

Detail: [THINKING-STREAM.md](./THINKING-STREAM.md)

---

## Usage

```js
const summary = await hfq.usageSummary();
const { dir, files } = await hfq.usageExport();
// dir under %APPDATA%/HFQ-Code/exports/usage-<stamp>/
// files: usage-sessions.csv, usage-daily.csv, usage-summary.json
await hfq.revealInFolder({ path: dir });
```

Detail: [USAGE-CSV-1.3.md](./USAGE-CSV-1.3.md)

---

## Paths / credentials / diagnostics

```js
const paths = await hfq.getAppPaths();
// credentialsPath, credentialsEncoding: missing|plaintext|dpapi-current-user|unknown
// credentialsDpapi: boolean

await hfq.exportDiagnostics(); // redacted; never credentials body
await hfq.revealInFolder({ path: paths.credentialsPath }); // Explorer select
await hfq.openPath({ path: paths.configPath }); // open file
```

DPAPI is transparent on config save/load (Windows). Detail: [DPAPI-1.2.md](./DPAPI-1.2.md) · [DIAGNOSTICS-1.2.md](./DIAGNOSTICS-1.2.md)

---

## Prefs whitelist (`setPrefs`)

`theme` · `proxyUrl` · `memoryEnabled` · `planModeDefault` · `permissionMode` ·  
`checkUpdatesOnStartup` · `updateSource` · `updateProxyBase` ·  
**`updatePolicy`** (`{ autoCheck?, autoDownload?, checkIntervalHours?, silentInstall?, silentInstallAcceptedAt? }`) ·  
`compactMaxChars` · `usageInputPerMillion` · `usageOutputPerMillion` ·  
**`terminalShell`** (`""` | `powershell` | `pwsh` | `cmd`) ·  
**`activeCodingProfileId`** · **`codingProfiles`** · **`modelRoles`** · **`skillMatch`**

### F1 prefs / session snapshot (Track F1)

| Surface | Shape |
|---------|--------|
| `prefs.codingProfiles[]` | `{ id, name, description?, icon?, systemAddon?, skillIds?, permissionMode?, providerId?, model?, builtIn?, enabled? }` |
| `prefs.activeCodingProfileId` | `string` (`""` = none). **New sessions** pick up active profile; not a hot-swap for a running turn. |
| `prefs.modelRoles` | `{ title?: { providerId?, model? } \| null, compression?: { providerId?, model? } \| null }` — empty = follow chat model; **compression drives LLM compact** when set (fail → heuristic) |
| `prefs.skillMatch` | `{ enabled?: boolean, maxBodies?: number, maxBodyChars?: number }` defaults `{ true, 2, 6000 }` |
| `prefs.compactMaxChars` | number 8000–200000 (default 48000); injected on create/open |
| `snapshot.tasks` / `task.updated` | `UiTask`: `taskId, title, status, detail?, kind?, objective?, progress?, budget?, parentTaskId?, blockedReason?, acceptance?, at` |
| `/goal …` | Emits `kind:"goal"` + objective/progress/budget; **sidecar** `%data%/sessions/<id>.goals.json` for cold open; delete unlinks it |
| `read_document` | Agent tool (not IPC): workspace path → text/docx/pdf extract; path escape rejected |

```js
// task.updated (goal driver)
// { type:"task.updated", sessionId, taskId, title:"goal: …", status, kind:"goal",
//   objective, progress, budget:{ maxRounds, maxToolCalls }, blockedReason?, at }

// setPrefs F1 / 1.1.6
await hfq.setPrefs({
  activeCodingProfileId: "debug",
  skillMatch: { enabled: true },
  compactMaxChars: 48000,
  modelRoles: {
    title: { model: "cheap-title-model" },
    compression: { model: "cheap-summary-model" }, // empty = heuristic only
  },
});
// LLM compact observability: system message / message.completed text includes
// "[context compacted · llm]" when compression model summarized older turns.
```

---

## Shell helpers

| API | Purpose |
|-----|---------|
| `runShell` | One-shot command (Terminal page legacy / agent-like) |
| `openPath` | Open file/folder under data dirs / workspace |
| `openExternal` | https only |
| **`revealInFolder`** | `shell.showItemInFolder` — workspace or app data only |

---

## Backend complete vs frontend-owned

| Done in main/packages | Frontend owns |
|----------------------|---------------|
| PTY host + IPC + shell list + pref | xterm.js, fit, multi-tab chrome |
| git status/diff/show/stage/unstage/commit/**log** | stage panel, commit form, keyboard review |
| subagent meta + events + attempts | Tasks tree polish, parent stack |
| usage CSV export + reveal | Usage page button + open folder |
| DPAPI credentials | Settings badge for encoding (optional) |
| **thinking.delta / thinking.completed** (provider CoT) | collapsible 思考过程 panel keyed by `messageId` |

**D2 code signing:** **shipped** (self-signed **HFQ-ClodBreeze** via electron-builder hooks + trust pack) — [PACKAGING.md](./PACKAGING.md). SmartScreen may still warn.  
**D3 in-app download:** shipped — `downloadUpdate` / `installUpdate` / `onUpdateDownload` — [UPDATE-D3.md](./UPDATE-D3.md).

---

## Updates (D3 + 1.1.7 L1/L2 + 1.1.8 L3)

```js
// prefs.updatePolicy (setPrefs whitelist)
await hfq.setPrefs({
  updatePolicy: {
    autoCheck: true,          // default true · aligns with checkUpdatesOnStartup
    autoDownload: false,      // default false · L1 background download when true
    checkIntervalHours: 24,   // clamp 1..168
    silentInstall: false,     // default false · L3 opt-in (FE must secondary-confirm)
    // silentInstallAcceptedAt stamped by main when enabling if missing
  },
});
// Portable runtime: setPrefs silentInstall:true → rejected

const r = await hfq.checkForUpdates({ force: true });
// r.recommendedAsset, r.assets, r.updateAvailable
// When updatePolicy.autoDownload && updateAvailable → main starts download (no install)

const st = await hfq.getUpdateDownloadStatus();
// st.status: idle | downloading | ready | failed | cancelled | up_to_date
//   (raw downloader "completed" is mapped to "ready"; st.downloadStatus keeps raw)
// st.currentVersion, st.availableVersion?, st.filePath?, st.percent?, st.error?
// st.autoDownloadEnabled?, st.autoCheckEnabled?, st.silentInstallEnabled?
// st.silentInstallAvailable?, st.portableRuntime?, st.pendingInstall?, st.lastPendingInstallBoot?

const off = hfq.onUpdateDownload((st) => { /* progress; completed → UI shows ready */ });
// also: onUpdateReady / onUpdateInstalled / onUpdateInstallPending / onUpdateInstallScheduled
await hfq.downloadUpdate({}); // or { url, fileName }

// L2 — openPath wizard (default)
await hfq.installUpdate({});              // confirm dialog; { autoDownload:false } requires prior download
await hfq.installUpdate({ mode: "ui", confirm: false });

// L3 — silent NSIS: requires silentInstall prefs; writes pending-install.json → /S → app.quit()
await hfq.installUpdate({ mode: "silent", reason: "install-and-restart" });
// or: await hfq.installUpdateSilent({})
// → { ok, mode:"silent", scheduled:true, quit:true, version, filePath, command, args:["/S"] }
// Portable / silentInstall=false / non-NSIS → throws (L2 still works)

await hfq.getPendingInstall();            // { pending, boot, portableRuntime }
await hfq.clearPendingInstall();
await hfq.cancelUpdateDownload();
await hfq.clearUpdateDownloads();         // keeps pending-install.json
off();
```

## Suggested UI wiring order

1. Terminal: xterm + `ptyCreate` / data / resize / kill; shell picker via `ptyShells` + `setPrefs`  
2. Changes: `gitStatus` strip + stage/commit panel + `gitLog` strip  
3. Tasks: listen `subagent.updated` + `listSpawnAttempts` failure chips  
4. Chat: `thinking.delta` / `thinking.completed` collapsed CoT (pair with `messageId`)  
5. Usage: export button → `usageExport` → `revealInFolder`  
6. Settings: show `credentialsEncoding` next to credentials path

---

## Models (providers · 2026-07-16)

```js
// Workbench list = config.providers[i].models (persisted).
// Optional remote refresh (OpenAI-compatible GET {base}/models):
const listed = await hfq.listProviderModels({ providerId: "opencode" });
// → {
//   ok: boolean,
//   providerId: string,
//   source: "remote" | "config" | "mock" | "unsupported",
//   models: string[],
//   error?: string,
//   warning?: string,
//   rawCount?: number,
// }
// Soft-fail: prefer checking ok / source; remote failure falls back to config.models when non-empty.

// Connectivity probe (soft):
const probe = await hfq.testModel({ providerId, model });
// → { ok, providerId, model, latencyMs, reply?, usage?, error? }
// Empty providers → { ok: false, error: "No model provider configured…" } (no mock fallback).

// Delete channel — mock and last channel allowed:
await hfq.removeProvider({ id: "mock" });
// → public config; may be providers: [], activeProviderId: "", activeModel: ""

// Create/send session with empty providers throws (stable keywords for humanize):
// "No model provider configured (providers empty). …"
// Soft paths (test/list) → { ok: false, error: "… providers empty …" }

// setActive hot-swap return (when a live session exists):
// {
//   ...publicConfig,
//   sessionApplied: { id, model, providerId } | null,
//   sessionApplyError?: string | null, // e.g. busy
// }

// listSessions / open / listChildren SessionInfo identity (UX1):
// model + providerId keys are ALWAYS present ("" if unknown / legacy transcript).
// Also when known: parentSessionId, goal, subagentProfile, subagentDepth
// Do not treat missing key as loading — key missing should not happen after 1.1.x.
//
// listSessions / listChildren / get / create — live access mode enrichment:
// Live in-memory rows include permissionMode + planMode (no N+1 getPermissionMode).
// Cold disk-only rows OMIT permissionMode/planMode (undefined) — fall back to
// getPermissionMode IPC or prefs.permissionMode; do not invent a default from list.
```

| Rule | Behavior |
|------|----------|
| `removeProvider` | Any id including `mock`; last channel → empty list |
| Load / save | No auto re-inject of mock/anthropic |
| `setActiveModel` | Rejects empty providers; unknown providerId throws; returns `sessionApplied.providerId` |
| Credentials | Deleted provider apiKey dropped on next `saveAppConfig` |
| Empty providers keywords | `no model provider` + `providers empty` in error strings |

---

## Field-shape traps (R9 audit 2026-07-15)

| API | Backend returns | UI must read |
|-----|-----------------|--------------|
| `importScan` | `{ candidates, roots }` | `candidates` (not `items`/`results`) |
| `importApply` | `{ copied, skipped, errors }` | send `items: [{ id, conflict? }]` + optional `candidates` |
| `listMcp` | `{ servers, tools }` server has `status` / `toolCount` | `status === "connected"` (no `connected` bool) |
| `testModel` | `{ ok, error?, latencyMs? }` **no throw** on soft fail | check `ok !== false` |
| `listProviderModels` | `{ ok, providerId, source, models, error?, warning? }` **no throw** on soft fail | use `models`; show `warning` when source is config after remote fail |
| `getSessionAllows` | `{ sessionId, sessionAllows: string[] }` | `sessionAllows` |
| `installSkillFromDir` | `{ ok: false, cancelled: true }` on dialog cancel | branch `cancelled` / `ok` |
| `listSkills` | **array** of skill records | `asList` ok |
| `skillsCatalog` | `{ items, source, … }` | `items` |
| `listMemory` / `searchMemory` | **array** of `{ id, text, … }` | array; body field is `text` |
| `usageSummary` | `{ sessions, daily, totals: { inputTokens, … } }` | nested `totals` |
| `session:send` | expects `text` | not `content` |
| `exportDiagnostics` | `{ dir, files }` | optional `revealInFolder({ path: dir })` |

### Wired this pass (2026-07-15 · layout + CoT + permission mode)

| Surface | API / events | UI |
|---------|--------------|----|
| Layout A widths | localStorage `hfq-ui-layout-v1` | drag handles sidebar / drawer (`PanelResizeHandle`) |
| Chat CoT | `thinking.delta` · `thinking.completed` | `streamingThinking` + collapsible `ThinkingBlock` |
| Permission mode | `setPermissionMode` · `getPermissionMode` · `setPlanMode` | AppHeader mode select |
| History thinking | openSession messages `role: thinking` | same `ThinkingBlock` |

### Wired this pass (2026-07-15 · leftover APIs)

| Surface | API | UI |
|---------|-----|----|
| Models | `upsertProvider` (+ `mergeProviderUpdate` 脱敏密钥) · **`removeProvider`** · **`listProviderModels`** | ModelsPage 添加/编辑/删除渠道（**mock 与最后一个渠道可删** → 空列表 fail-closed；删活跃渠道自动回落或清空 active） |
| Changes | `writeChangeContent` / `writeWorkspaceText` · `readWorkspaceText` | ChangesPanel 人工编辑 textarea + 保存 |
| Chat 引用 | `pickWorkspaceFiles` → `workspace:pickFiles` | 系统文件对话框（工作区相对路径）；手动路径回退 |
| MCP / Memory / Skills / Permissions / Tasks / Settings | 见上轮接线 | 各页 Dialog / 按钮 |

### Backend ready · residual optional

深层：MCP 连接状态细粒度 UI、技能包远程商店浏览、Usage 图表、权限矩阵可视化增强。

---

## Composer prefixes (`/` `$` · not `#` `&`)

| Prefix | UI (React Chat) | Backend |
|--------|-----------------|---------|
| **`/`** | Composer slash palette (legacy templates + `/goal` `/compact`) | `parseUserSlash` in agent-core: **only** `/goal` / `/compact` elevate/expand; other `/x` are plain prompts after insert |
| **`$`** | Skill palette from `listSkills` → insert `使用技能 {name}：` | Skills run via agent tools when model follows the prompt; no separate `$` IPC |
| **引用 / 附件** | Composer「引用」→ `pickWorkspaceFiles`（系统选择器）· 路径 chip 随消息发送 | `workspace:pickFiles` 沙箱相对路径 |
| **`&`** | **Not implemented** | No protocol |
| **Ctrl+K** | Global `CommandPalette` (nav / session / drawer) | Not slash runtime |

Source: `apps/desktop/renderer/src/features/chat/composer-commands.ts` · legacy parity `renderer-legacy/app.js` `SLASH_COMMANDS` + `skillPaletteItems`.  
