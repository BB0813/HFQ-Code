# 发版任务 · HFQ Code **1.2.0**（Slice A · 壳 + Chat 工作台升级）

> **用法**：把本文件**原样整份**发给 **发版 Agent**。  
> **你是发版 Agent**，不是前后端实现 Agent、不是测试 Agent：整理工作区 → 抬版本 → 门禁 → **Electron 双硬门槛** → 文档 → tag → GitHub Release。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面**编程智能体**（Electron + TypeScript）— **不是** IM 网关。  
> 基线：**1.1.9 已 ship**（tag `v1.1.9` · HEAD 一带 `a94dad9`）。  
> 源真相：本文件 · 实现 [`1.2-slice-a-handoff.md`](./1.2-slice-a-handoff.md) · 壳刀 [`1.2-slice-a-shell-handoff.md`](./1.2-slice-a-shell-handoff.md) · 选型 [`docs/UI-1.2.md`](../UI-1.2.md) · 测试 gate [`test-1.2-slice-a-gate.md`](./test-1.2-slice-a-gate.md) · 测试简报 [`test-1.2-slice-a-report-brief.md`](./test-1.2-slice-a-report-brief.md)（**CONDITIONAL GO**）。  
> **必须发 `1.2.0` / tag `v1.2.0`，禁止复用/覆盖 `v1.1.9`。**  
> **测试结论（当前）：CONDITIONAL GO** — 自动化全绿、壳/Chat 实现信号齐全（代码走读）；**Electron 整壳视觉 V8 + T1 屏测未做**。  
> **硬规则：在 §5 双门槛未 PASS 前，禁止 `git tag v1.2.0` 与 GitHub Release。** 允许先 commit + 抬版本 + `pack:win`；tag 前必须完成 §5。

---

## 0. 一句话任务

把工作区 **1.2 Slice A（选项 A）**（设计 token 字体 · 壳层 Header/StatusBar/ActivityBar/SideBar/窄屏 · Chat 去营销卡/工具折叠/中文态 · 文档/prompts）提交、抬版本到 **1.2.0**、`release:check` 绿、**Electron 冷启整壳一眼 + Terminal T1 手测 PASS**、写 Release、打 tag 并发布。

**本版叙事**：工作台 **UI 主感知升级（Slice A）**；**不是**完整 1.2 列车（无 Memory FTS / Goal OS / 三页大版式）。

---

## 1. 发什么（范围 In）

### 1.1 功能（相对 1.1.9 · Slice A only）

| 域 | 能力 |
|----|------|
| **U1** | `--font-ui` / `--font-mono`；EmptyState 密度略收 |
| **U2** | AppHeader 密度/中文「运行中」；StatusBar 中文运行/git 态；ActivityBar 主页钮去 zinc 白块；SessionSideBar workbench active；AppShell 跨阈值收抽屉/侧栏；RightDrawer tabs 略收 |
| **U3** | Chat 去 radial 光晕；surface；工具卡可折叠；空态去 gradient 营销卡；工具态中文 |
| 文档 | `UI-1.2.md` · prompts（1.2 plan/handoff/slice-a/shell/test）· ROADMAP |

### 1.2 明确 Out（禁止塞进本 release 或假写进 Highlights）

- **Slice B**：Terminal / Changes / Tasks **大版式**重做  
- **Slice C**：Memory FTS · Goal OS 产品化 · panel prefs 持久化  
- 更新 L0–L3 行为变更、electron-updater、默认静默安装  
- Layout 换底栏终端 / 方案 B  
- IM / Track E  
- **不要**再开功能开发；缺口只修**发版阻断**（编译/测试/打包/§5 红）  
- Chat 角色仍标 You/Agent（Nit）— **可不修**；若顺手中文化可带，非阻断  

### 1.3 工作区现状（发版前必读）

`main` 对齐 **1.1.9**（`v1.1.9`）；**未提交** 1.2 Slice A 改动。发版 Agent：

1. `git status` / `git diff --stat` 全扫  
2. **排除**密钥、`.pfx`、本机凭证、`node_modules`、APPDATA 副本  
3. 应纳入的典型路径（以 status 为准，**勿漏 untracked**）：  
   - `apps/desktop/renderer/src/index.css`  
   - `apps/desktop/renderer/src/components/shell/AppHeader.tsx`  
   - `apps/desktop/renderer/src/components/shell/StatusBar.tsx`  
   - `apps/desktop/renderer/src/components/shell/ActivityBar.tsx`  
   - `apps/desktop/renderer/src/components/shell/AppShell.tsx`  
   - `apps/desktop/renderer/src/components/shell/SessionSideBar.tsx`  
   - `apps/desktop/renderer/src/components/shell/RightDrawer.tsx`  
   - `apps/desktop/renderer/src/components/ui/page-states.tsx`  
   - `apps/desktop/renderer/src/features/chat/ChatView.tsx`  
   - `docs/UI-1.2.md` · `docs/ROADMAP.md`  
   - `docs/prompts/1.2-*.md` · `test-1.2-slice-a-*.md` · `session-handoff-post-1.1.9.md` · `README.md` · 本 `release-1.2.0.md`  
4. 与 1.2 Slice A **无关**的半截 diff：单独说明，**不要** silently 塞进 release  

测试侧：`release:check` 曾绿（193 tests 一带）；**仍必须**自己再跑全量。

---

## 2. 版本与文件

### 2.1 必须抬到 `1.2.0`

| 文件 | 动作 |
|------|------|
| 根 `package.json` | `"version": "1.2.0"` |
| `apps/desktop/package.json` | `"version": "1.2.0"` |
| 文档/UI 写死的产品版本串 | 按需改为 `1.2.0` |

**不要**批量改 `packages/*` 的 `0.1.0` workspace 包版本。

### 2.2 必须新建 / 更新的文档

| 文件 | 动作 |
|------|------|
| **`docs/RELEASE-1.2.0.md`** | **新建**（Why / Highlights / Install / **Verify 含 §5 双门槛** / Out of scope · 写明 **Slice A only**） |
| `docs/ROADMAP.md` | baseline → **1.2.0 shipped**；Next → Slice B/C 或 1.2.1（见 `1.2-ui-handoff.md`） |
| `docs/UI-1.2.md` | 确认 U0 仍锁；不无故改 IA |
| `docs/prompts/README.md` | 本 release / test / handoff → done |
| `CHANGELOG.md`（若仓库已有） | 按历史风格加 1.2.0 条 |

无根级 CHANGELOG 时以 **`docs/RELEASE-1.2.0.md`** 为准。

### 2.3 `RELEASE-1.2.0.md` 建议 Highlights（可润色，事实勿编）

1. **工作台壳升级**：活动栏 / 顶栏 / 底栏 / 会话侧栏 IDE 密度与中文态（选项 A）  
2. **Chat**：去营销光晕与空态大卡；工具卡可折叠；运行/失败中文  
3. **字体 token**：UI / mono 体系统一  
4. **窄屏**：跨宽度阈值自动收抽屉再收侧栏  
5. **非本版**：Memory 全文检索、Goal OS、Terminal/Changes/Tasks 大版式、默认静默更新  

**Verify（发版自检 · §5 必勾）：**

- [ ] `pnpm release:check` 绿  
- [ ] **Electron V8**：冷启后活动栏+顶栏+侧栏+Chat+底栏 **一眼相对 1.1.9 升级**  
- [ ] **Electron T1**：标记输出 → Chat ≥3s → 回 Terminal → 仍可见  
- [ ] StatusBar：运行中/空闲 · 有改动/干净；版本显示 **1.2.0**  
- [ ] Changes ask-agent **不**自动发送；空 message 不能 commit（抽检）  
- [ ] L3 silent 仍默认关  
- [ ] Layout 仍为右抽屉终端（无底栏终端）  

---

## 3. Git 提交策略

推荐 **1～2 个 commit**：

**方案 A（推荐）**

1. `feat(1.2.0): Slice A shell + Chat workbench polish`  
   — renderer shell/chat/css + UI-1.2 + prompts  
2. `release: HFQ Code 1.2.0 Slice A UI`  
   — version bump + `RELEASE-1.2.0.md` + ROADMAP  

**方案 B**

- 单 commit：`release: HFQ Code 1.2.0 Slice A shell + Chat`

**禁止**：force-push `main`；改写已发布 tag；提交密钥。

---

## 4. 门禁命令（顺序）

```bash
pnpm install   # 若需要
pnpm --filter @hfq/desktop run typecheck
pnpm exec vitest run packages/pty/src/host.test.ts
pnpm release:check

# 抬版本后可选打包
pnpm pack:win
```

红则停：修阻断或回报，**不要**带红 tag。  
node-pty `AttachConsole failed` 在 **tests 全绿** 后可记噪音，不单独阻断。

---

## 5. Electron 双硬门槛（tag 前 · 不可跳过）

测试简报：**CONDITIONAL GO** — 无屏测 → 无完整 GO → **无 tag**。

### 5.1 门槛 A · 冷启整壳（V8 / 选项 A）

1. 启动桌面（开发或安装包均可，须含本 train 代码）。  
2. 冷启后目视：  
   - **活动栏**：主页钮非 zinc 白块；与 rail 同语言  
   - **顶栏**：控件紧凑；Chat 运行时 **「运行中」**  
   - **侧栏**：当前会话 active 清晰  
   - **Chat**：无大营销光晕/空态大卡  
   - **底栏**：**运行中/空闲** · **有改动/干净**  
3. **断言**：相对 1.1.9 记忆，**整壳+Chat** 像升级，不是只改聊天背景。  

**失败 → 禁止 tag**（可回实现修壳，或产品书面改口选项 B — **发版 Agent 不得擅自改口**）。

### 5.2 门槛 B · Terminal T1（1.1.9 回归）

1. 绑定 workspace → **终端** → 新建。  
2. 屏上可见标记：`echo HFQ-1.2.0-REATTACH`（或 PowerShell 等价）。  
3. 切 **对话 / Chat**，停留 **≥3 秒**。  
4. 回 **终端**。  
5. **断言**：标记字符串 **仍在**。  
6. （建议）切路由不误杀；显式关闭才从列表移除。  

仅 BE 模拟 / 代码走读：**不算** §5.2 完成。

### 5.3 建议抽检（非 tag 硬门槛，失败记风险）

- 窄屏：宽→过 900 收抽屉；过 700 收侧栏；手动再开抽屉不被微抖关死  
- Settings：静默安装默认关  
- Changes：空 message；ask agent 不自动发送  

### 5.4 证据写入

- `docs/RELEASE-1.2.0.md` Verify 勾选 + 一两句 V8/T1 结果  
- 回复用户：V8 PASS/FAIL · T1 PASS/FAIL + 可选截图路径  

---

## 6. Tag 与 GitHub Release

**仅当** §4 全绿 **且** §5.1 V8 PASS **且** §5.2 T1 PASS：

```bash
git tag -a v1.2.0 -m "HFQ Code 1.2.0 — Slice A shell + Chat workbench"
git push origin main
git push origin v1.2.0
```

GitHub Release：

- 标题：`HFQ Code 1.2.0`  
- 正文：对齐 `docs/RELEASE-1.2.0.md`  
- 附件：NSIS / portable（若本轮 pack）  
- **勿**宣称 Memory FTS / Goal OS / 默认静默更新 / 完整 1.2 全列车已交付  
- **应**写明：本版为 **Slice A（壳+Chat）**；B/C 后续  

---

## 7. 交付格式（回复用户）

1. 结论：是否已 tag `v1.2.0` / Release URL  
2. commits + version 文件  
3. `release:check` 结果  
4. **Electron V8 + T1** 证据（必填；未做则说明 **未发布 tag**）  
5. 产物路径 / 附件  
6. 残留风险（You/Agent 英文、Palette 未大改、Slice B 未做）  

---

## 8. 非目标 / 禁止

- 跳过 V8 或 T1 直接 tag  
- 把 CONDITIONAL GO 写成完整 GO 而不补测  
- 扩大 scope 到 Slice B/C  
- 提交密钥  
- 把 1.2.0 写成「全站重做 / IM / 默认静默」  

---

**开始发版。顺序：整理 → 门禁 → 抬版本 →（可选 pack）→ Electron V8 + T1 → 文档勾选 → tag。任一门槛不过则停在「已提交/已打包待验收」。**
