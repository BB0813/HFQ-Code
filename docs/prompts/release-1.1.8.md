# 发版任务 · HFQ Code **1.1.8**（Update L3 静默升级）

> **用法**：把本文件**原样整份**发给 **发版 Agent**。  
> **你是发版 Agent**，不是前后端实现 Agent、不是测试 Agent：整理工作区 → 抬版本 → 门禁 → **真包路径 A** → 文档 → tag → GitHub Release。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面**编程智能体**（Electron + TypeScript）— **不是** IM 网关。  
> 基线：**1.1.7 已 ship**（tag `v1.1.7` · `df6f0b3` 一带）。  
> 源真相：本文件 · 实现 [`1.1.8-l3-handoff.md`](./1.1.8-l3-handoff.md) · 阶梯 [`docs/UPDATE-L1-L3.md`](../UPDATE-L1-L3.md) §6.3 · 测试 gate [`test-1.1.8-l3-gate.md`](./test-1.1.8-l3-gate.md) · 测试简报 [`test-1.1.8-l3-report-brief.md`](./test-1.1.8-l3-report-brief.md) · DECISIONS **Q9**。  
> **必须发 `1.1.8` / tag `v1.1.8`，禁止复用/覆盖 `v1.1.7`。**  
> **测试结论（当前）：CONDITIONAL GO** — 自动化绿、逻辑负例过；**L3-07 真包路径 A 未过**。  
> **硬规则：在路径 A 未 PASS 前，禁止 `git tag v1.1.8` 与 GitHub Release。** 允许先 commit + 抬版本 + `pack:win` 产出 NSIS 以供路径 A。

---

## 0. 一句话任务

把工作区 **1.1.8 L3**（opt-in 静默 NSIS `/S` + pending-install + 安装并重启 + 相关文档/单测；含启动超时 failsafe 修补若在 tree 内）提交、抬版本、`release:check` 绿、打 **NSIS** 包、**完成旧→新真包静默升级验收**、写 Release、打 tag 并发布。

---

## 1. 发什么（范围 In）

### 1.1 功能（相对 1.1.7）

| ID | 能力 |
|----|------|
| L3 | `prefs.updatePolicy.silentInstall` **opt-in**（默认 **false**）+ 首次开启 **二次确认** + `silentInstallAcceptedAt` |
| L3 | ready + silent 开 → CTA **「安装并重启」** → `installUpdate({ mode:"silent" })` / `installUpdateSilent` |
| L3 | `pending-install.json` + detached installer **`/S`** + `app.quit()`；启动读 marker 成功清 / 失败保留 |
| L3 | Portable runtime/asset **拒绝** silent；失败可 **L2** `mode:"ui"` / openPath 回退 |
| L3 | 安装路径沙箱：仅 `userData/updates` 下已下载 `.exe`；allowlist 下载链不放宽 |
| 共享 | `packages/shared` `update-silent` + 单测；`apps/desktop/electron/update-silent.cjs` |
| 文档 | FRONTEND-IPC · PACKAGING · UPDATE-D3 · UPDATE-L1-L3 · prompts |
| 附带 | 若工作区含 bootstrap failsafe 修补（`App.tsx` / `app-store`：超时窗口与错误清除）— **一并 ship**，Release 可简记「启动超时误报」 |

### 1.2 明确 Out

- electron-updater 迁移  
- OV/EV 购买 / 消灭 SmartScreen  
- delta 包  
- Memory FTS / Goal OS / Layout 大改  
- **不要**再开功能开发；缺口只修**发版阻断**（编译/测试/打包/路径 A 红）  
- **不要**把 silent 写成「默认自动安装」或「无 UAC」

### 1.3 工作区现状（发版前必读）

`main` 对齐 **1.1.7**（`v1.1.7`）；**未提交** 1.1.8 改动。发版 Agent：

1. `git status` / `git diff --stat` 全扫  
2. **排除**密钥、`.pfx`、本机凭证、`node_modules`、APPDATA 副本  
3. 应纳入的典型路径（以 status 为准，**勿漏 untracked**）：  
   - `packages/shared/src/update-silent.ts` · `update-silent.test.ts` · `index.ts`  
   - `packages/config/src/schema.ts` · `store.ts`（若有 silent 相关）  
   - `apps/desktop/electron/update-silent.cjs`（**untracked**）  
   - `apps/desktop/electron/main.cjs` · `preload.cjs`  
   - `apps/desktop/renderer/.../SettingsPage.tsx` · `App.tsx` · `app-store.ts`  
   - `docs/FRONTEND-IPC.md` · `PACKAGING.md` · `UPDATE-*.md` · `prompts/*`  
4. 与 1.1.8 **无关**的半截 diff：单独说明，**不要** silently 塞进 release  

测试侧：`release:check` 曾绿；**仍必须**自己再跑全量，不跳过。

---

## 2. 版本与文件

### 2.1 必须抬到 `1.1.8`

| 文件 | 动作 |
|------|------|
| 根 `package.json` | `"version": "1.1.8"` |
| `apps/desktop/package.json` | `"version": "1.1.8"`（`app.getVersion` / 更新检查） |
| 文档/UI 写死的产品版本串 | 按需改为 `1.1.8` |

**不要**批量改 `packages/*` 的 `0.1.0` workspace 包版本。

### 2.2 必须新建 / 更新的文档

| 文件 | 动作 |
|------|------|
| **`docs/RELEASE-1.1.8.md`** | **新建**（Why / Highlights / Install / **Verify 含路径 A** / Out of scope） |
| `docs/ROADMAP.md` | baseline → **1.1.8 shipped**；Next 写后续 train（勿再写「L3 最迟 1.1.8」为未完成） |
| `docs/UPDATE-L1-L3.md` | §6.3 真包冒烟与 FE 勾选在路径 A 后勾上；标 L3 shipped |
| `docs/prompts/README.md` | release / test / handoff 状态更新 |
| `docs/FRONTEND-IPC.md` | 核对 silent API，不无故改契约 |

无根级 `CHANGELOG.md`：用户可见说明以 **`docs/RELEASE-1.1.8.md`** 为准。

### 2.3 `RELEASE-1.1.8.md` 建议 Highlights（可润色，事实勿编）

1. **可选静默安装（L3）**：Settings「下载完成后自动安装更新」— **默认关**，首次开启需确认  
2. **安装并重启**：就绪后可退出应用并以 NSIS **`/S`** 安装已下载包（UAC 仍可能出现）  
3. **失败可回退**：仍可用「安装更新」打开向导（L2）  
4. **Portable**：不支持 L3 静默装，说明清晰  
5. 安全：HTTPS allowlist · 仅 `updates/` 内安装包 · 自签 / SmartScreen 说明不变  
6. （可选）启动超时误报修复  

**Out of scope**：默认静默、无 UAC、electron-updater、证书升级。

**Verify（发版自检 · 路径 A 必勾）：**

- [ ] `pnpm release:check` 绿  
- [ ] silent 默认关；未确认无法 silent install  
- [ ] **路径 A**：1.1.7（或更旧安装版）→ 1.1.8 NSIS 静默升级成功  
- [ ] 升级后版本 **1.1.8**；APPDATA 配置/会话仍在；pending 清除  
- [ ] silent 关时 L2 向导仍可用  
- [ ] Portable 拒 L3（若测得到）  

---

## 3. Git 提交策略

推荐 **1～2 个 commit**（对齐历史）：

**方案 A（推荐）**

1. `feat(1.1.8): update L3 silent NSIS install + pending marker + Settings opt-in`  
   — 功能 + 单测 + 阶梯/IPC 文档 + test prompts  
2. `release: HFQ Code 1.1.8 update L3 opt-in silent install`  
   — version bump + `RELEASE-1.1.8.md` + ROADMAP  

**方案 B**

- 单 commit：`release: HFQ Code 1.1.8 L3 silent install (opt-in /S + pending)`  

消息用英文或中英混排均可，与仓库近期风格一致即可。

**禁止**：force-push `main`；改写已发布 tag；把密钥提交进库。

---

## 4. 门禁命令（顺序）

```bash
# 4.1 依赖与构建
pnpm install
pnpm --filter @hfq/shared build
pnpm --filter @hfq/config build

# 4.2 聚焦
pnpm exec vitest run packages/shared/src/update-silent.test.ts packages/config/src/store.test.ts
pnpm --filter @hfq/desktop run typecheck

# 4.3 全量（必须）
pnpm release:check

# 4.4 抬版本后打包（NSIS 安装包，非仅 portable）
pnpm pack:win
# 确认 apps/desktop/release/ 下存在 HFQ Code-1.1.8-x64.exe（名称以实际为准）
```

红则停：修阻断或回报统筹，**不要**带红 tag。

---

## 5. 真包路径 A（tag 前硬门槛 · 不可跳过）

测试简报已钉死：**无路径 A → 无完整 GO → 无 tag。**

### 5.1 步骤

1. **旧宿主**：本机已装 **1.1.7** NSIS（或临时装 1.1.7 安装包）。记下 About/StatusBar 版本。  
2. **数据快照**（可选但推荐）：`%APPDATA%/HFQ-Code/config.json` 关键字段或 hash。  
3. **新包**：本轮 `pack:win` 产出的 **1.1.8** NSIS `.exe`。  
4. 在旧宿主 Settings：  
   - 打开「下载完成后自动安装更新」并 **二次确认**  
   - 将 1.1.8 包置于 `%APPDATA%/HFQ-Code/updates/` 且状态 **ready**（或走真实 check+download 若已发布；发版前常用手动放入 + 状态机）  
   - 点 **安装并重启**  
5. 观察：UAC 可允许 → **不应**出现完整 NSIS 向导页 → 应用退出 → 新版本启动。  
6. **断言**：  
   - 版本 **1.1.8**（或 ≥ 目标）  
   - APPDATA 仍在  
   - `pending-install.json` 成功路径下清除  
   - 日志/事件含 `/S` 或 scheduled 证据  

### 5.2 失败处理

- 路径 A **失败**：**禁止** tag / GitHub Release；记录日志，可修阻断后重试；L2 回退仍应可用。  
- 仅 Path B dry-run：**不算**完成 §5。  

### 5.3 证据写入

将路径 A 结果摘要写入：

- `docs/RELEASE-1.1.8.md` Verify（勾选 + 一两句结果）  
- `docs/UPDATE-L1-L3.md` §6.3 真包项勾选  
- 回复用户时附：升级前/后版本、是否无向导、APPDATA 是否保留  

---

## 6. Tag 与 GitHub Release

**仅当** §4 全绿 **且** §5 路径 A PASS：

```bash
git tag -a v1.1.8 -m "HFQ Code 1.1.8 — update L3 opt-in silent NSIS install"
git push origin main
git push origin v1.1.8
```

GitHub Release：

- 标题：`HFQ Code 1.1.8`  
- 正文：对齐 `docs/RELEASE-1.1.8.md`（可缩短）  
- 附件：NSIS `HFQ Code-1.1.8-*.exe`（及 portable 若有，**正文写明 Portable 无 L3**）  
- **勿**宣称「默认自动安装」或「完全无感无 UAC」  

---

## 7. 交付格式（回复用户）

1. 结论：是否已 tag `v1.1.8` / Release URL  
2. commits + version 文件  
3. `release:check` 结果  
4. **路径 A** 证据摘要（必填；未做则说明 **未发布 tag**）  
5. 产物路径 / Release 附件  
6. 残留风险（SmartScreen、UAC、未测项）  

---

## 8. 非目标 / 禁止

- 跳过路径 A 直接 tag  
- 把 CONDITIONAL GO 写成完整 GO 而不补测  
- 扩大 scope 到 Memory/Goal OS  
- 提交密钥或签名证书私钥  

---

**开始发版。顺序：整理 → 门禁 → 抬版本 → pack → 路径 A → 文档勾选 → tag。路径 A 不过则停在「已打包待验收」。**
