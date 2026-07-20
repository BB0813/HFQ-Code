# 测试任务 · HFQ Code **1.1.9 编码闭环补丁**（Test Agent 整包 Prompt）

> **用法**：把本文件**原样整份**发给 **测试 Agent**。  
> **你是测试 / QA Agent**，不是实现 Agent、不是发版 Agent。  
> - **做**：跑自动化门禁、Electron 手测/半自动冒烟、记录证据、给 **GO / NO-GO / CONDITIONAL GO**。  
> - **不做**：改产品功能代码、抬版本、打 tag、GitHub Release、开 1.2 Layout / Memory FTS / Goal OS。  
> - **可做最小修复**：仅测试脚本/文档勾选与事实不符；功能缺陷记 **BUG-xxx** 回传，**禁止**自行大改 Terminal/PTY。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面**编程智能体**（Electron + TS）— **不是** IM 网关。  
> 基线：**1.1.8 shipped**（`v1.1.8`）。工作区应含 **未发布的 1.1.9** 改动（以 `git status` 为准；package 可能仍为 **1.1.8**，正常）。  
> 契约：  
> - [`1.1.9-polish-handoff.md`](./1.1.9-polish-handoff.md)  
> - [`1.1.9-fe-implementation.md`](./1.1.9-fe-implementation.md)  
> - [`docs/FRONTEND-IPC.md`](../FRONTEND-IPC.md) PTY 节 · [`docs/PTY-1.1.md`](../PTY-1.1.md)  
> 落盘：本文件 `docs/prompts/test-1.1.9-polish-gate.md`  
> 硬约束：不提交密钥；报告可脱敏本机路径。

---

## 0. 一句话任务

验证 **1.1.9 是否达到可发版门槛**：自动化绿 + **Terminal 切页/重连仍见输出（硬门槛）** + Changes 提交流/j/k/ask-agent + Tasks 树/父栈/spawn 失败可读 + **未越界**（无 Layout 大改、无 L3 回归破坏）；输出 **GO / CONDITIONAL GO / NO-GO**。

**产品钉死**：

- **T1「切 Chat 再回 Terminal，历史输出仍在」未过 → 不得完整 GO。**  
- 仅单元测试绿、未开 Electron 手测 → 最多 **CONDITIONAL GO**（须写明残留风险）。

---

## 1. 测试前环境确认

```bash
git status -sb
git log --oneline -8
git tag -l "v1.1.*" | sort -V | tail -6
node -p "require('./package.json').version"
node -p "require('./apps/desktop/package.json').version"
# 期望：最高 tag 含 v1.1.8；version 可能仍 1.1.8；working tree 有 1.1.9 相关 M/??
```

### 1.1 必须存在的实现信号（缺则「实现未就绪」或 NO-GO）

| 信号 | 路径 / 符号 |
|------|-------------|
| PTY ring + API | `packages/pty/src/host.ts` → `getScrollback` · `shellKind` · `alive` |
| 单测 | `packages/pty/src/host.test.ts`（scrollback / 死 id） |
| IPC | `main.cjs` → `pty:getScrollback`；`preload.cjs` → `ptyGetScrollback` |
| FE 类型 | `renderer/src/lib/hfq.ts` → `ptyGetScrollback` · `shellKind?` · `alive?` |
| FE 接线 | `TerminalPanel.tsx` → 调用 `ptyGetScrollback`、cache、workspace 清列表 |
| Changes | `ChangesPanel.tsx` → 空 message toast、staged 摘要、commit disabled、`askAgentToFix` |
| Tasks | `TasksPanel.tsx` → parentStack / topGoals / errorCode（可无本 train diff） |
| 文档 | `FRONTEND-IPC.md` / `PTY-1.1.md` 有 reattach 说明 |

**不要**因未抬版本到 1.1.9 判实现失败。

**机器**：Windows x64；能 `pnpm` + 启动桌面（`pnpm --filter @hfq/desktop start` 或项目惯用命令）。

---

## 2. 自动化门禁（必须跑）

在仓库根：

```bash
# 2.1 PTY 聚焦
pnpm exec vitest run packages/pty/src/host.test.ts

# 2.2 桌面类型
pnpm --filter @hfq/desktop run typecheck

# 2.3 全量（发版级；GO 强烈建议全绿）
pnpm release:check
# = build + test + smoke + eval
```

| 结果 | 动作 |
|------|------|
| 全绿 | 自动化 PASS |
| 红 | 贴失败摘要；**NO-GO** 或标 Blocked；区分 flaky（如 node-pty `AttachConsole failed` **日志噪音** vs 真实 test fail） |

说明：vitest 通过后偶发 node-pty ConPTY 子进程 `AttachConsole failed` **若 tests 仍 5 passed，不单独算红**；写入报告「噪音」即可。

---

## 3. 功能验收矩阵

图例：`P` Pass · `F` Fail · `B` Blocked · `S` Skipped（写原因）· `N/A`

### 3.1 Terminal / PTY（发布硬门槛）

| ID | 场景 | 步骤 | 期望 | 结果 |
|----|------|------|------|------|
| **T1** | **切页重连** | 有 workspace → Terminal 新建 → 输入可见字符（如 `echo hfq-119`）→ 切到 **Chat** → 再回 **Terminal** | **仍能看到**先前输出（允许截断提示「…更早输出已截断」） | |
| **T2** | 多 tab | 建 2 个终端；分别输入不同标记；来回点 tab | 各 tab 内容不串（或切换后从 ring/cache 正确恢复） | |
| **T3** | kill | 关当前终端 | 列表去掉该 id；可再新建；无僵尸 active | |
| **T4** | 空态 | 无会话 | 中文空态「还没有终端」类 + 可新建 | |
| **T5** | workspace 切换/清空 | 换 workspace 或清工作区（按产品能力） | 列表刷新；**不**残留旧 tab；cache 不串会话 | |
| **T6** | 死会话 | kill 后若 UI 仍点旧 id / getScrollback 失败 | 不崩；refresh 清掉；可有 toast/静默恢复 | |
| **T7** | tab 标签 | 有 `shellKind` 时 | 标签可读（非仅裸 uuid）；`alive===false` 可有标记 | |
| **T8** | 不误杀 | 仅切路由离开 Terminal | **进程仍活**（回页能续；未点关闭则不应被 kill） | |

**T1 = F → 整体不得完整 GO。**

### 3.2 Changes / Git

| ID | 场景 | 期望 | 结果 |
|----|------|------|------|
| **C1** | 空提交说明 | Commit 禁用或 toast「请先填写提交说明」 | |
| **C2** | 无 staged | 不能 commit；中文提示 | |
| **C3** | 暂存摘要 | 可见「将提交 N 个…」类摘要 | |
| **C4** | j/k 审阅 | 文件列表 j/k 或 ↑↓ 切换；**在 message 输入框内不抢键** | |
| **C5** | 请 Agent 修 | 写入 composer 草稿 + 进入 Chat；**不自动发送** | |
| **C6** | 无 workspace / 非 git | 友好中文空态，不白屏 | |

### 3.3 Tasks / 子代理

| ID | 场景 | 期望 | 结果 |
|----|------|------|------|
| **K1** | Goal 层级 | 有 parent 的 goal 缩进/分组；**孤儿** parent 缺失仍顶层可见 | |
| **K2** | 子会话 | 打开子会话后可 **返回父**（parentStack 或 parentSessionId） | |
| **K3** | spawn 失败 | 失败原因中文或可读 code；可复制更佳 | |
| **K4** | 无数据 | 空态不崩 | |

若环境无真实 subagent/goal：可用已有会话列表做 **K2** 弱测，或标 `B` + 代码走读结论（须声明，不能假 P）。

### 3.4 回归 / 边界（抽检）

| ID | 场景 | 期望 | 结果 |
|----|------|------|------|
| **R1** | Layout A | 活动栏 + 会话侧栏 + 中心 + 右抽屉 **未**换成另一套信息架构 | |
| **R2** | 更新 L3 | Settings 仍有 opt-in 静默装；**默认关**（不要求重跑 1.1.8 真包） | |
| **R3** | 密钥 | diff/报告无 `.pfx` / API key | |
| **R4** | 非目标 | 无 Memory FTS 大改、无 Goal OS 新产品、无 electron-updater | |

---

## 4. 推荐手测剧本（最短路径）

### 4.1 Terminal T1（强制）

1. 启动应用，绑定任意 git/workspace。  
2. 打开 **终端** → **新建** → 执行：  
   `echo HFQ-1.1.9-REATTACH`（或 PowerShell `Write-Output 'HFQ-1.1.9-REATTACH'`）  
3. 确认输出可见。  
4. 切到 **对话 / Chat**，停留 ≥3s（可再敲几下 Chat 确认应用仍活）。  
5. 回到 **终端**。  
6. **断言**：标记字符串仍在滚动缓冲中。  
7. 证据：升级前/后可用截图或复制终端可见文本写入报告。

### 4.2 Changes C1–C5（建议）

1. 改一个文件 → stage → 看摘要。  
2. 空 message 点提交 → 拦截。  
3. 填 message 提交（可选，勿强依赖远程）。  
4. 打开 diff → **请 Agent 修改** → Chat 见草稿、**未发出**。  
5. 在 message 框输入时按 `j` → 应输入字母 j，而非跳文件。

### 4.3 Tasks（能测则测）

1. 有子会话则点入再返回。  
2. 有 spawn 失败记录则看中文/code。

---

## 5. DevTools / IPC 抽检（可选）

渲染进程控制台（有 PTY 时）：

```js
const list = await window.hfq.ptyList()
const id = (list.sessions || list)[0]?.id
// 若有 id：
await window.hfq.ptyGetScrollback({ id })
// 期望：{ id, data, truncated, bytes, chars }；data 含近期输出
```

未知 id 应 reject/抛错 → UI 应 refresh，不白屏。

---

## 6. 缺陷记录格式

```text
### BUG-00x · <标题>
- 严重度：Blocker / Major / Minor / Nit
- 复现：1. … 2. …
- 期望：
- 实际：
- 证据：截图/日志
- 是否阻断 1.1.9 GO：是 / 否
```

**Blocker 示例**：T1 切页后终端空白；kill 杀光所有会话；ask agent 自动发送；typecheck/release:check 红且属产品代码。

---

## 7. GO / NO-GO 规则

| 结论 | 条件 |
|------|------|
| **GO** | 自动化（至少 2.1+2.2；全量 `release:check` 优先）绿 **且** **T1 PASS** **且** C1–C5 无 Blocker **且** R1–R3 过 **且** 无 Blocker bug |
| **CONDITIONAL GO** | 自动化绿 + 代码审查/弱测认为逻辑在，但 **Electron T1 未跑** 或 Tasks 仅走读；**须**写残留风险，建议发版前补 T1 |
| **NO-GO** | T1 Fail / 自动化红（产品）/ 实现信号缺失 / 存在 Blocker |

测试 Agent **无权**把「只跑了 vitest」写成完整 GO。

---

## 8. 交付物（回复用户）

1. **结论**：GO / CONDITIONAL GO / NO-GO（一句话原因）  
2. **环境**：OS、commit/dirty、tag、package version  
3. **自动化**：命令 + 绿/红（含噪音说明）  
4. **矩阵**：§3 填 P/F/B  
5. **T1 证据**：是否看见 `HFQ-1.1.9-REATTACH`（或等价）  
6. **缺陷列表** BUG-xxx  
7. **给发版 Agent**：可否开 `release-1.1.9`；须重测项  
8. **未测 / 跳过**  

可选落盘：`docs/prompts/test-1.1.9-polish-report-brief.md`（若用户要求）。

---

## 9. 非目标

- 不实现功能、不抬 1.1.9、不打 tag  
- 不测 1.2 Layout / Memory FTS / 完整 Goal OS  
- 不要求重跑 1.1.8 NSIS 真包路径 A（R2 仅抽检默认关）  
- 不把 SmartScreen / 无签名警告算 1.1.9 失败  

---

## 10. 建议执行顺序

1. §1 环境 + 实现信号  
2. §2 自动化  
3. §4.1 **T1 硬门槛**  
4. §3.2 Changes · §3.3 Tasks  
5. §3.4 回归抽检  
6. 报告 · GO/NO-GO  

---

**开始测试。以证据说话；T1 没过不要给完整 GO。**
