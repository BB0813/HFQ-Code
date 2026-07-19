# 发版任务 · HFQ Code **1.1.7**（Update L1+L2）

> **用法**：把本文件**原样整份**发给 **发版 Agent**。  
> **你是发版 Agent**，不是前后端实现 Agent：整理工作区 → 抬版本 → 门禁 → 打包 → 文档 → tag → GitHub Release。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面**编程智能体**（Electron + TypeScript）— **不是** IM 网关。  
> 基线：**1.1.6 已 ship**（tag `v1.1.6` · commit `7db6d0f` 一带）。  
> 源真相：本文件 · 实现契约 [`1.1.7-handoff.md`](./1.1.7-handoff.md) · 阶梯总册 [`docs/UPDATE-L1-L3.md`](../UPDATE-L1-L3.md) · DECISIONS **Q9**。  
> **必须发 `1.1.7` / tag `v1.1.7`，禁止复用/覆盖 `v1.1.6`。**  
> **本版只 ship L1+L2；完整 L3 留给 1.1.8**（见 `1.1.8-l3-handoff.md`）— Release 正文勿宣称静默自动安装已完成。

---

## 0. 一句话任务

把工作区里已实现的 **1.1.7 更新阶梯 L1+L2**（`updatePolicy` · 后台自动下载 · 就绪态 UI · 一键确认安装 · silentInstall 仅占位）提交、抬版本、`release:check` 绿、打 Windows 包、写 Release 说明、打 tag 并发布 GitHub Release。

---

## 1. 发什么（范围 In）

### 1.1 功能（相对 1.1.6）

| ID | 能力 |
|----|------|
| L1 | `prefs.updatePolicy.autoDownload`：检查到新版本后**后台下载**到 `%APPDATA%/HFQ-Code/updates/`（不自动装） |
| L1 | `autoCheck` + `checkIntervalHours`（1–168，默认 24）与启动/周期检查协调 |
| L2 | Settings 状态条：idle / checking / downloading / **ready** / failed / up_to_date；就绪后主按钮 **安装更新** |
| L2 | `installUpdate` 仍 **确认框 + `shell.openPath`**（向导路径）；`quitSuggested` 保留 |
| 状态 | `getUpdateDownloadStatus` 扩展：`status`（含 ready）、`availableVersion`、`currentVersion`、`autoDownloadEnabled` 等 |
| 占位 | `silentInstall` / `silentInstallAcceptedAt` **可持久化**；UI 开关禁用「1.1.8 预置」；**禁止**因本字段自动装 |
| 文档 | `UPDATE-L1-L3.md` · DECISIONS Q9 · FRONTEND-IPC updatePolicy · prompts 1.1.7/1.1.8 |

### 1.2 明确 Out（不要塞进 1.1.7）

- **完整 L3**：pending-install、quit 后 NSIS `/S`、无向导静默升级（→ **1.1.8**）  
- electron-updater 迁移  
- Memory FTS / Goal OS / Layout 改版  
- **不要**再开功能开发；缺口只修**发版阻断**（编译/测试/打包红）  
- **不要**把 `silentInstall` 写成「已自动安装」

### 1.3 工作区现状（发版前必读）

`main` 对齐 **1.1.6**（`v1.1.6`）；**未提交** 1.1.7 改动。发版 Agent 负责：

1. `git status` / `git diff --stat` 扫一遍  
2. **排除**密钥、本机凭证、`*.pfx`、`node_modules`、本地 `%APPDATA%` 配置副本  
3. 应纳入的典型路径（以 status 为准，**勿漏 untracked**）：  
   - `packages/config/src/schema.ts` · `store.ts` · `store.test.ts`  
   - `apps/desktop/electron/main.cjs`（`maybeAutoDownloadUpdate`、status 扩展、setPrefs updatePolicy）  
   - `apps/desktop/renderer/src/pages/SettingsPage.tsx`（更新卡片）  
   - `docs/UPDATE-L1-L3.md`（**untracked**）  
   - `docs/prompts/1.1.7-handoff.md` · `1.1.8-l3-handoff.md` · `release-1.1.7.md` · `README.md`  
   - `docs/DECISIONS.md` · `docs/ROADMAP.md` · `docs/FRONTEND-IPC.md`  
4. 若出现与 1.1.7 **无关**的半截 diff：单独说明，**不要** silently 塞进 release；阻断则停并报告  

统筹侧：config 测试 + desktop typecheck 曾绿；**仍必须**跑全量 `pnpm release:check`，不以「看过 diff」跳过。

---

## 2. 版本与文件

### 2.1 必须抬到 `1.1.7`

| 文件 | 动作 |
|------|------|
| 根 `package.json` | `"version": "1.1.7"` |
| `apps/desktop/package.json` | `"version": "1.1.7"`（`app.getVersion` / 更新检查依赖） |
| 文档/UI **写死**的产品版本串 | 按需改为 `1.1.7`（StatusBar 一般读 package，勿硬编码错版） |

**不要**批量改 `packages/*` 的 `0.1.0` workspace 包版本（与历史 1.1.x 一致）。

### 2.2 必须新建 / 更新的文档

| 文件 | 动作 |
|------|------|
| **`docs/RELEASE-1.1.7.md`** | **新建**（对齐 `RELEASE-1.1.6.md`：Why / Highlights / Install / Verify / Out of scope） |
| `docs/ROADMAP.md` | baseline → **1.1.7 shipped**；Next 强调 **1.1.8 L3 最迟**；1.1.7 行标 done |
| `docs/UPDATE-L1-L3.md` | 可标注 L1+L2 shipped / 1.1.7；L3 仍 pending |
| `docs/prompts/README.md` | 本 release 完成后标 done；1.1.7-handoff → done；1.1.8-l3 仍 scheduled |
| `docs/FRONTEND-IPC.md` | 已有 updatePolicy 则核对，不无故改契约 |

无根级 `CHANGELOG.md`：用户可见说明以 **`docs/RELEASE-1.1.7.md`** 为准。

### 2.3 `RELEASE-1.1.7.md` 建议 Highlights（可润色，事实勿编）

1. **后台自动下载（L1）**：Settings 开启「有更新时后台自动下载」后，检查到新版本即预下载安装包，不打断会话  
2. **就绪一键安装（L2）**：状态「新版本已就绪」+ **安装更新**；仍确认后打开 NSIS 向导（非静默）  
3. **更新策略 prefs**：`updatePolicy.autoCheck` / `autoDownload` / `checkIntervalHours`  
4. **L3 预置**：自动安装开关灰显，将在 **1.1.8** 生效；本版绝不静默装  
5. 安全边界不变：HTTPS allowlist · `updates/` 沙箱 · 自签 HFQ-ClodBreeze / SmartScreen 说明  

**Out of scope 写清**：静默/半静默 NSIS 升级（L3）、electron-updater、Memory FTS。

**Verify 建议勾选：**

- [ ] Settings 开关保存后重启仍在  
- [ ] autoDownload off ≈ 1.1.6 手动路径  
- [ ] autoDownload on + 有新版本 → 下载进度 → ready（可用降版本装测或等下一 tag；至少代码路径不崩）  
- [ ] 安装仍弹确认 + 打开 `.exe`  
- [ ] StatusBar / Settings 版本 **1.1.7**  
- [ ] `pnpm release:check` 绿  

---

## 3. Git 提交策略

推荐 **1～2 个 commit**（风格对齐历史）：

**方案 A（推荐）**

1. `feat(1.1.7): update L1+L2 auto-download, ready UI, updatePolicy`  
   — 功能 + 测试 + 阶梯文档 + prompts  
2. `release: HFQ Code 1.1.7 update L1+L2 guided auto-download`  
   — version bump + `RELEASE-1.1.7.md` + ROADMAP baseline  

**方案 B**

- 单 commit：`release: HFQ Code 1.1.7 update L1+L2 auto-download + ready install`  
  （功能与发版材料一起；信息写全）

约束：

- 先看 diff，**不** `git add .` 盲加  
- **不** force-push `main`；**不**删除 `v1.1.6`  
- tag 信息含简短亮点（L1+L2，非 L3）  

---

## 4. 门禁（必须绿）

```bash
# 相关构建 / 类型
pnpm --filter @hfq/config build
pnpm --filter @hfq/desktop run typecheck

# 聚焦（不替代全量）
pnpm exec vitest run packages/config/src/store.test.ts

# 全量发版门禁
pnpm release:check
# = pnpm build && pnpm test && pnpm smoke && pnpm eval
```

失败：**如实停**；只做发版阻断级最小修复；不要假绿。

---

## 5. 打包与校验

```bash
pnpm pack:win
# 有签名 secrets / HFQ_SIGN_ROOT 则签；无则交付写明「未签名」
pnpm sha256:release
pnpm pack:verify   # 若适用
```

产物期望（名称以 electron-builder 为准）：

- NSIS：`HFQ Code-1.1.7-x64.exe`  
- portable（若启用）  
- `SHA256SUMS.txt`  

检查：

- [ ] About / StatusBar / Settings 版本 **1.1.7**  
- [ ] 无 `*.pfx` / 无真实 API key  
- [ ] 签名状态写入交付说明  

---

## 6. Tag 与 GitHub Release

```text
tag:    v1.1.7
target: 含 1.1.7 发版 commit 的 main
```

GitHub Release：

- **Title**：`HFQ Code 1.1.7`  
- **Body**：以 `docs/RELEASE-1.1.7.md` 为主  
- **Assets**：NSIS + portable（若有）+ `SHA256SUMS.txt`  
- **latest**：按惯例设为 latest（便于 1.1.6 用户检查更新 → 测 L1 下载）  

```bash
git push origin main
git push origin v1.1.7
```

无 push 权限：完成本地 tag + 包 + 说明，交付写「待用户 push」— **不要**假装已发布。

---

## 7. 发版后冒烟（写入交付）

1. 装 **1.1.6**（或本机旧版）→ 检查更新应见 **1.1.7**（latest 发布后）  
2. 装 **1.1.7** → Settings 开「后台自动下载」→ 保存  
3. （有更新时）后台下载 → 「已就绪」→ 安装更新 → 确认 → 安装向导  
4. 确认 **不会** 因 silent 开关自动装（开关应为禁用预置）  
5. 数据目录 `%APPDATA%/HFQ-Code` 升级后仍在  

---

## 8. 安全与产品硬约束

- 不提交密钥 / token / 用户本机 config  
- updates 沙箱 + host allowlist **不放宽**  
- **不**默认 silentInstall  
- 不改 Layout A；不引入 IM 网关  

---

## 9. 交付回复格式（发版 Agent → 用户）

1. **版本 / tag / commit hash**  
2. **纳入路径摘要**（config / main / Settings / docs）  
3. **`pnpm release:check` 结果**（失败贴关键）  
4. **打包产物 + SHA256 / SUMS 位置**  
5. **签名状态**  
6. **GitHub Release URL**（或待 push）  
7. **已知限制**（L3 未做；autoDownload 默认 false）  
8. **未做步骤**（若有）  

---

## 10. 建议执行顺序

1. `git status` + diff 审阅 · 排除脏文件  
2. 功能 commit（若尚未 commit）  
3. bump `1.1.7` · 写 `docs/RELEASE-1.1.7.md` · 更新 ROADMAP / prompts 索引  
4. `pnpm release:check`  
5. release commit（若与 2 分开）  
6. `pack:win` + `sha256:release`  
7. `git tag v1.1.7` · push · `gh release create`  
8. 按 §9 回复  

---

## 11. 非目标（再次强调）

- 完整 L3 静默升级（**1.1.8**）  
- 覆盖 `v1.1.6`  
- 把 UPDATE-L1-L3 未完成项标成 shipped  
- Memory / Goal OS / electron-updater  

---

**开始执行发版全流程。失败如实停并报告；门禁红不要标 shipped。**
