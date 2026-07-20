# 发版任务 · HFQ Code **1.1.9**（编码闭环补丁 · PTY reattach + Changes/Tasks 收口）

> **用法**：把本文件**原样整份**发给 **发版 Agent**。  
> **你是发版 Agent**，不是前后端实现 Agent、不是测试 Agent：整理工作区 → 抬版本 → 门禁 → **Electron T1 手测** → 文档 → tag → GitHub Release。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面**编程智能体**（Electron + TypeScript）— **不是** IM 网关。  
> 基线：**1.1.8 已 ship**（tag `v1.1.8` · `488bdd1` 一带）。  
> 源真相：本文件 · 实现 [`1.1.9-polish-handoff.md`](./1.1.9-polish-handoff.md) · FE [`1.1.9-fe-implementation.md`](./1.1.9-fe-implementation.md) · 测试 gate [`test-1.1.9-polish-gate.md`](./test-1.1.9-polish-gate.md) · 测试简报 [`test-1.1.9-polish-report-brief.md`](./test-1.1.9-polish-report-brief.md) · [`docs/PTY-1.1.md`](../PTY-1.1.md) · FRONTEND-IPC PTY。  
> **必须发 `1.1.9` / tag `v1.1.9`，禁止复用/覆盖 `v1.1.8`。**  
> **测试结论（当前）：CONDITIONAL GO** — 自动化绿、BE reattach + FE 走读过；**Electron UI T1 未手测**。  
> **硬规则：在 Electron T1 未 PASS 前，禁止 `git tag v1.1.9` 与 GitHub Release。** 允许先 commit + 抬版本 + `pack:win`；tag 前必须完成 §5。

---

## 0. 一句话任务

把工作区 **1.1.9**（PTY scrollback reattach · Terminal FE 接线 · Changes 提交流/j/k/ask-agent 收口 · Tasks 存量闭环 · 文档）提交、抬版本、`release:check` 绿、**Electron 最短 T1 手测 PASS**、写 Release、打 tag 并发布。

---

## 1. 发什么（范围 In）

### 1.1 功能（相对 1.1.8）

| ID | 能力 |
|----|------|
| B1-2 | `@hfq/pty` 输出 ring + `getScrollback` · `PtySessionInfo.shellKind` / `alive` |
| B1-2 | IPC `pty:getScrollback` · preload `ptyGetScrollback` |
| B1-2 | Terminal：**切页/重连以 BE ring 回放** + FE cache + workspace 清列表；切路由 **不** kill PTY |
| B2 | Changes：空 message toast · staged 摘要 · commit disabled · j/k 不抢输入框 · ask agent **只预填不发送** |
| B3 | Tasks：goal 层级/孤儿顶层 · parentStack 返回父 · spawn `errorCode` 中文（多为本 train 存量确认） |
| 文档 | FRONTEND-IPC · PTY-1.1 · ROADMAP · prompts（1.1.9 / 1.2 plan / test） |

### 1.2 明确 Out

- **1.2 Layout / 主题 / 活动栏重构**  
- Memory FTS / Goal OS 产品化  
- 更新 L0–L3 行为变更、electron-updater  
- IM / Track E  
- **不要**再开功能开发；缺口只修**发版阻断**（编译/测试/打包/T1 红）  
- **不要**把本版写成「大改 UI」

### 1.3 工作区现状（发版前必读）

`main` 对齐 **1.1.8**（`v1.1.8`）；**未提交** 1.1.9 改动。发版 Agent：

1. `git status` / `git diff --stat` 全扫  
2. **排除**密钥、`.pfx`、本机凭证、`node_modules`、APPDATA 副本  
3. 应纳入的典型路径（以 status 为准，**勿漏 untracked**）：  
   - `packages/pty/src/host.ts` · `host.test.ts` · `index.ts`  
   - `apps/desktop/electron/main.cjs` · `preload.cjs`  
   - `apps/desktop/renderer/src/features/terminal/TerminalPanel.tsx`  
   - `apps/desktop/renderer/src/features/changes/ChangesPanel.tsx`  
   - `apps/desktop/renderer/src/lib/hfq.ts`  
   - `docs/FRONTEND-IPC.md` · `PTY-1.1.md` · `ROADMAP.md`  
   - `docs/prompts/1.1.9-*.md` · `test-1.1.9-*.md` · `1.2-ui-plan.md` · `README.md`  
4. 与 1.1.9 **无关**的半截 diff：单独说明，**不要** silently 塞进 release  

测试侧：`release:check` 曾绿（193 tests 一带）；**仍必须**自己再跑全量。

---

## 2. 版本与文件

### 2.1 必须抬到 `1.1.9`

| 文件 | 动作 |
|------|------|
| 根 `package.json` | `"version": "1.1.9"` |
| `apps/desktop/package.json` | `"version": "1.1.9"` |
| 文档/UI 写死的产品版本串 | 按需改为 `1.1.9` |

**不要**批量改 `packages/*` 的 `0.1.0` workspace 包版本。

### 2.2 必须新建 / 更新的文档

| 文件 | 动作 |
|------|------|
| **`docs/RELEASE-1.1.9.md`** | **新建**（Why / Highlights / Install / **Verify 含 Electron T1** / Out of scope） |
| `docs/ROADMAP.md` | baseline → **1.1.9 shipped**；Next → **1.2 U0 / big UI**（见 `1.2-ui-plan.md`） |
| `docs/PTY-1.1.md` / FRONTEND-IPC | 核对 reattach 已描述；不无故改契约 |
| `docs/prompts/README.md` | 本 release / test / handoff → done |
| `CHANGELOG.md`（若仓库已有） | 按历史风格加 1.1.9 条 |

无根级 CHANGELOG 时以 **`docs/RELEASE-1.1.9.md`** 为准。

### 2.3 `RELEASE-1.1.9.md` 建议 Highlights（可润色，事实勿编）

1. **终端重连**：离开 Terminal 再回来，PTY 进程保留并用 ring buffer 回放近期输出  
2. **多会话**：tab 标签可读（shellKind）；关闭清理；无会话中文空态  
3. **Changes**：提交前校验说明/暂存；j/k 审阅；「请 Agent 修改」只预填对话  
4. **Tasks**：子会话可返回父；spawn 失败原因更可读  
5. **非本版**：大改 Layout、Memory FTS、静默更新默认开  

**Verify（发版自检 · T1 必勾）：**

- [ ] `pnpm release:check` 绿  
- [ ] **Electron T1**：标记输出 → Chat → 回 Terminal → 仍可见  
- [ ] 切路由不误杀 PTY；显式关闭才 kill  
- [ ] Changes 空 message 不能 commit；ask agent 不自动发送  
- [ ] StatusBar / About 版本 **1.1.9**  
- [ ] L3 silent 仍默认关（抽检）  

---

## 3. Git 提交策略

推荐 **1～2 个 commit**：

**方案 A（推荐）**

1. `feat(1.1.9): PTY scrollback reattach + Terminal/Changes polish`  
   — pty host + IPC + TerminalPanel + Changes + docs/prompts  
2. `release: HFQ Code 1.1.9 coding-loop polish (PTY reattach)`  
   — version bump + `RELEASE-1.1.9.md` + ROADMAP  

**方案 B**

- 单 commit：`release: HFQ Code 1.1.9 PTY reattach + Changes/Tasks polish`  

**禁止**：force-push `main`；改写已发布 tag；提交密钥。

---

## 4. 门禁命令（顺序）

```bash
pnpm install   # 若需要
pnpm exec vitest run packages/pty/src/host.test.ts
pnpm --filter @hfq/desktop run typecheck
pnpm release:check

# 抬版本后可选打包
pnpm pack:win
```

红则停：修阻断或回报，**不要**带红 tag。  
node-pty `AttachConsole failed` 在 **tests 全绿** 后可记噪音，不单独阻断。

---

## 5. Electron T1（tag 前硬门槛 · 不可跳过）

测试简报已钉死：**无 Electron T1 屏测 → 无完整 GO → 无 tag。**

### 5.1 最短剧本

1. 启动桌面（开发或安装包均可，须含本 train 代码）。  
2. 绑定 workspace → 打开 **终端** → **新建**。  
3. 执行并确认屏上可见：  
   - cmd/PowerShell：`echo HFQ-1.1.9-REATTACH` 或 `Write-Output 'HFQ-1.1.9-REATTACH'`  
4. 切到 **对话 / Chat**，停留 **≥3 秒**。  
5. 回到 **终端**。  
6. **断言**：标记字符串 **仍在** 终端视图中。  
7. （建议）不点关闭再切一次路由 → 进程仍活；点关闭 → 列表移除。

### 5.2 失败处理

- T1 **失败**：**禁止** tag / GitHub Release；记日志，可修后重测。  
- 仅 BE 模拟 / 代码走读：**不算** §5 完成。

### 5.3 证据写入

- `docs/RELEASE-1.1.9.md` Verify 勾选 + 一两句结果  
- 回复用户：T1 PASS/FAIL + 可选截图路径  

---

## 6. Tag 与 GitHub Release

**仅当** §4 全绿 **且** §5 T1 PASS：

```bash
git tag -a v1.1.9 -m "HFQ Code 1.1.9 — PTY reattach + coding-loop polish"
git push origin main
git push origin v1.1.9
```

GitHub Release：

- 标题：`HFQ Code 1.1.9`  
- 正文：对齐 `docs/RELEASE-1.1.9.md`  
- 附件：NSIS / portable（若本轮 pack）  
- **勿**宣称 1.2 大改 UI 或默认静默更新  

---

## 7. 交付格式（回复用户）

1. 结论：是否已 tag `v1.1.9` / Release URL  
2. commits + version 文件  
3. `release:check` 结果  
4. **Electron T1** 证据（必填；未做则说明 **未发布 tag**）  
5. 产物路径 / 附件  
6. 残留风险（未测项、噪音）  

---

## 8. 非目标 / 禁止

- 跳过 Electron T1 直接 tag  
- 把 CONDITIONAL GO 写成完整 GO 而不补测  
- 扩大 scope 到 1.2 Layout / Memory  
- 提交密钥  

---

**开始发版。顺序：整理 → 门禁 → 抬版本 →（可选 pack）→ Electron T1 → 文档勾选 → tag。T1 不过则停在「已提交/已打包待验收」。**
