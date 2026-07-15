# Changelog

## 1.0.9 — 2026-07-15

### Skills · remote packages
- Catalog `packageUrl` → **https** zip/tar.gz download to temp (size limit · timeout)
- Safe extract: reject absolute paths / `..` escapes; find nested `SKILL.md` (depth ≤ 3)
- Optional `packageSha256` / `sha256` — fail closed on mismatch
- UI: **远程安装** button, progress/status, overwrite confirm; packages are data + SKILL.md only (no script execution)
- IPC: `skills:installFromPackage`

### Permission modal polish
- 10-minute **auto-deny** timeout while modal is open
- Session label + queue length in modal; clear queue + unlock composer on session fail/abort/worker crash
- `git_commit` permission summary highlights **message:** for confirm-mode review

### Docs
- README: unsigned Windows / SmartScreen install notes + free alternatives

---

## 1.0.8 — 2026-07-15

### Chat model / provider UI
- **顶栏**固定显示当前提供方 · 模型（点击进入模型页）
- 作曲栏模型按钮 **只显示模型名**（如 `grok-4.5`），完整渠道名不写在按钮上
- **访问模式 / 模型二级菜单向上弹出**，避免盖住输入区
- Chat 会话信息区提供方 chip 排在模型前

---

## 1.0.7 — 2026-07-15

### Update check multi-source fallback
- Detect when a mirror returns **HTML** (not JSON) and surface a clear Chinese error instead of raw `Unexpected token '<'`
- On ghproxy failure, try **extra mirrors** (`gh-proxy.com`, `ghfast.top`, …) then **ungh.cc**, then **direct** GitHub API
- Normalize ungh latest-release JSON (tag / assets / markdown notes)
- Settings copy: explain automatic fallback; suggest alternate ghproxy base when `ghproxy.com` is dead

### Note
- Users on **1.0.4** still lack auto-fallback — install **1.0.7** (or at least 1.0.5+) for resilient checks; or temporarily set 更新源 to **直连** / 改基址

---

## 1.0.6 — 2026-07-15

### Skills store depth
- **SKILL.md 预览抽屉**：已安装技能、商店卡片、任选文件夹均可预览（路径限制在技能根目录内）
- **安装冲突**：同名已存在时确认是否覆盖；覆盖时复用 `sourceDir`，不再二次选文件夹
- **标签 chips**：商店按 tag 筛选（git / test / docs / planned 等）
- Install result codes：`already_exists` | `invalid` | `io` | `cancelled`；IPC `skills:preview`

### Goal UX
- Chat 顶部 **/goal 横幅**（进行中任务 + 任务页 / 停止）
- `task.updated` 时局部刷新横幅，避免整页重绘

### UI R1 起步
- 抽出 `apps/desktop/renderer/skills-ui.js`（`HFQSkillsUI` 纯函数：tags / filter / activeGoal）

### Update diagnostics
- Settings 更新状态行附加截断后的 `apiUrl`，便于排查 ghproxy / 直连

---

## 1.0.5 — 2026-07-15

### Update check resilience
- When default **ghproxy** check fails, automatically retry **direct** GitHub once
- Status line shows 已从 ghproxy 回退直连 when fallback succeeds
- Both paths failing returns combined Chinese error detail

### `/goal` polish
- Exhausted round budget emits a clear system hint (continue with `/goal` or smaller steps)
- Goal task detail records elevated round/tool caps on completion

### Skills · ClawHub store scaffold
- Skills page tabs: **已安装** / **技能商店 (beta)**
- Offline curated catalog + optional remote `skills/catalog.json`
- **从文件夹安装** copies a `SKILL.md` tree into the user skills dir (safe name + path checks)
- IPC: `skills:catalog`, `skills:installFromDir`; `shell:openExternal` for https homepages

### Docs / roadmap
- [docs/UI-REDESIGN.md](./docs/UI-REDESIGN.md) — page redesign TODO (R0–R5)
- COMPAT / PRODUCT: store is scaffold, not full ClawHub marketplace

---

## 1.0.4 — 2026-07-14

### `/goal` long-running tasks
- Real slash handling in agent-core (not just a composer text prefix)
- `/goal <目标>` elevates **this turn** to 32 rounds / +400 tool calls
- Emits `task.updated` goal rows (in_progress → completed/failed/cancelled) for the Tasks page
- Bare `/goal` returns a usage hint without starting a failed turn
- `/compact [note]` expands into an explicit compression request for the model
- Composer palette inserts `/goal ` / `/compact ` so the slash is sent to the runtime

### Update check via ghproxy (default)
- Default `prefs.updateSource = ghproxy` so Releases API goes through  
  `https://ghproxy.com/https://api.github.com/repos/BB0813/HFQ-Code/releases/latest`
- Avoids direct `api.github.com` timeouts on restricted networks
- Settings: switch **ghproxy / 直连**, custom proxy base, save without full prefs form
- Asset list can offer mirrored download links when ghproxy is active
- `update:openRelease` allows known ghproxy hosts + user-configured mirror host

---

## 1.0.3 — 2026-07-14

Chat UI polish toward ZCode / Codex Desktop composer patterns.

### Chat toolbar
- Session meta no longer crams title + provider + model into one overflowing pill
- Card layout: status chip · short session id · truncated title · model/provider chips · compact token usage

### Composer
- Removed dense quick-action chip row (列出/读取/…)
- Bottom controls: **访问模式** dropdown · **模型** selector · **/ 命令** toggle
- Slash / skill palette: type `/` or `$`, ↑↓ select, Tab/Enter insert, Esc close
- Skills load into palette when opening Chat

### Notes
- Model switch from composer updates global active model (new session picks it up, same as Models page)
- Empty-state demo chips kept for first-run guidance only

---

## 1.0.2 — 2026-07-14

Access modes (Claude/ZCode-style) + permission modal reliability + Windows app icon stamp.

### Brand / packaging
- **Fix**: Windows 安装包 / 快捷方式 / 任务栏图标未换成 HFQ logo  
  根因：`win.signAndEditExecutable: false` 会跳过 electron-builder 的 exe 资源写入，主程序仍是 Electron 默认图标
- `afterPack` 钩子 `scripts/stamp-win-icon.mjs` 用 `resedit` 把 `build/icon.ico` 写入 `HFQ Code.exe`
- `pnpm icons:gen` 从 `brand/hfq-code-logo.png` 重新生成 ico/png/sidebar logo
- `pack:verify` 断言安装树内含 `build/icon.*` 与 `logo-256.png`

### 检查更新（手动下载通道）
- 设置页 **检查更新**：查询 `BB0813/HFQ-Code` GitHub Releases latest
- 启动后静默检查（可关）；有新版本时状态栏提示
- **不**内置静默下载/安装（仍符合 1.0 手动更新策略）；「打开发布页」仅打开浏览器
- 6 小时节流；`prefs.checkUpdatesOnStartup` / `lastUpdateCheckAt`

### Access modes
- Four modes: **变更前确认** · **自动编辑** · **计划模式** · **完全访问**
- Global default in Settings (`prefs.permissionMode`); Chat toolbar can switch per session
- **自动编辑**: auto-allow `write_file` / `apply_patch`; still ask shell / network / mcp
- **完全访问**: true YOLO — auto-allow all tools including dangerous shell (UI warns on select)
- Soft-migrate legacy `planModeDefault=true` → `permissionMode: plan`
- Worker + in-process backends expose `setPermissionMode` / `getPermissionMode`

### Permission modal fix
- Hide modal **only after** successful `resolvePermission` (no orphaned waiter / stuck busy)
- Queue concurrent permission requests; match by `requestId`
- Clear queue on session fail / abort / surface reset
- Retry-friendly: failed resolve keeps modal open with error status

### Notes
- Default for existing users remains **变更前确认**
- Session “设为默认” writes current mode into prefs

---

## 1.0.1 — 2026-07-15

Patch release: product logo + agent identity accuracy + test/eval data isolation.

### Brand
- Official **HFQ Code** app icon (`apps/desktop/build/icon.ico` / `icon.png`)
- Sidebar brand mark uses the logo asset; window + installer icons wired
- Source mark kept under `brand/hfq-code-logo.png`

### Agent identity (model honesty)
- System prompt now injects the **active model id + provider id**
- Model is instructed not to invent GPT/Claude brands when asked who it is
- Unit coverage in `packages/agent-core/src/context.test.ts`

### Data hygiene
- `HFQ_DATA_DIR` overrides product data root (`%APPDATA%/HFQ-Code`)
- `pnpm eval` / `pnpm test` / `pnpm smoke` write sessions under temp data dirs only
- Memory tool path respects `HFQ_DATA_DIR`
- Optional cleanup: `node scripts/purge-temp-sessions.mjs` removes leftover temp/eval transcripts

---

## 1.0.0 — 2026-07-15

First stable desktop release. Builds on `1.0.0-rc.1` Phase-3 slices.

### Phase-3 M3.4 — Packaging / ship
- Product version **1.0.0** (`apps/desktop` + root)
- **Manual update channel frozen** (no electron-updater in 1.0)
- `pnpm release:check` · `pnpm pack:verify` (unpacked tree smoke)
- electron-builder: `asar: false` (pnpm monorepo + spawnable session worker entry)
- Worker under Electron uses `ELECTRON_RUN_AS_NODE` (no system Node required)
- `electronDist` local cache + `win.signAndEditExecutable: false` (avoids winCodeSign symlink privilege issues)
- Settings “诊断与发版” steps updated for 1.0

### Included from RC
- M3.0 security harden · M3.1 `credentials.json` · M3.3 session worker
- Full Phase-2 coding agent surface (Memory 2.0, Import, Sub-agents, Usage, Eval, git tools)

### Explicitly deferred
- Interactive PTY · auto-updater · DPAPI credentials · OAuth MCP · IM gateway

---

## 1.0.0-rc.1 — 2026-07-14

Phase-2 complete (1.0 RC candidate) + Phase-3 **M3.0 harden** + **M3.1 credentials** + **M3.3 session worker**.

### Phase-3 M3.3 — Session worker
- Agent loop runs in a **child Node process** (`packages/agent-core/src/worker/`)
- NDJSON request/response + event notifications over stdio
- Electron main prefers worker; falls back to in-process `SessionManager` if spawn fails
- Worker crash → `session.failed` in UI; reopen/create session to recover
- Vitest coverage for ping, tools, permissions, restart

### Phase-3 M3.1 — Secrets
- Provider API keys and sensitive MCP headers stored in `%APPDATA%/HFQ-Code/credentials.json`
- `config.json` no longer persists `apiKey` / Authorization headers
- Soft-migrate on load from legacy inline secrets
- Settings shows credentials path

### Memory 2.0
- User + project scoped notes under `%APPDATA%/HFQ-Code/memory/`
- BM25-ish retrieval, pin, legacy `notes.json` migration
- Desktop **记忆** page: list / search / CRUD

### Usage & cost
- Aggregate `usage.updated` from session JSONL
- Desktop **用量** page; optional $/1M pricing in Settings

### Import wizard
- Scan OpenClaw / AgentSkills / Cursor rules + workspace rules
- Preview + copy into HFQ skills / AGENTS drafts
- Desktop **导入** page

### Sub-agents & plan mode
- `spawn_subagent` tool + SessionManager spawn (explore/edit/shell)
- Plan mode denies write/patch/shell/memory_save/**spawn_subagent**
- Chat toolbar: plan toggle + explore spawn

### Runtime hardening
- Transcript secret redaction
- Tool call budgets for sub-agents
- Abort cascades to child sessions
- Diagnostics export (redacted config + session index)
- **Audit M3.0:** dangerous shell always re-asks (even session allow); broader danger patterns
- **Audit M3.0:** mask MCP Authorization headers in public config view
- **Audit M3.0:** `openPath` limited to HFQ data / workspace / `.agents`
- **Audit M3.0:** block cloud metadata hosts for `network_fetch`; strip secret-like env from shell/git children
- **Audit M3.0:** safer `escapeHtml` for attributes

### MCP / tools
- HTTP MCP headers (Authorization)
- MCP ping health check
- `git_diff` / `git_show` read-only tools
- `git_commit` (high risk, ask; stage paths + commit message; no amend/force)

### Coding UX (P2-I close-out)
- Changes: path filter + open in VS Code/Cursor
- Settings: in-app `AGENTS.md` editor
- Terminal: one-shot workspace shell run (non-PTY) + re-run into agent
- Tasks: sub-agent child session list

### Packaging
- `electron-builder` NSIS + portable targets (`pnpm --filter @hfq/desktop pack:win`)
- Single-instance lock

### Eval
- `pnpm eval` headless regression suite (E01–E10)

### Docs
- [docs/AUDIT.md](./docs/AUDIT.md) full code audit
- [docs/PHASE3.md](./docs/PHASE3.md) post-RC plan

## 0.2.0-beta — 2026-07-14

Phase-1 Beta: full page set, agent loop, MCP stdio+HTTP, compaction, file memory, prefs.
