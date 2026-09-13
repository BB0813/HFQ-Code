# 测试任务 · HFQ Code **1.2 Slice A**（壳 + Chat 可演示门禁 · Test Agent 整包 Prompt）

> **用法**：把本文件**原样整份**发给 **测试 Agent**。  
> **你是测试 / QA Agent**，不是实现 Agent、不是发版 Agent。  
> - **做**：跑自动化门禁、Electron 视觉/手测、记录证据、给 **GO / NO-GO / CONDITIONAL GO**。  
> - **不做**：改产品功能代码、抬版本、打 tag、GitHub Release、开 Slice B/C（Terminal 大版式 / Memory FTS / Goal OS）。  
> - **可做最小修复**：仅测试脚本/文档勾选与事实不符；功能缺陷记 **BUG-xxx** 回传，**禁止**自行大改 UI。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面**编程智能体**（Electron + TS）— **不是** IM 网关。  
> 基线：**1.1.9 shipped**（`v1.1.9`）。工作区应含 **未发布的 1.2 Slice A WIP**（package 可能仍为 **1.1.9**，正常）。  
> 契约：  
> - [`1.2-slice-a-handoff.md`](./1.2-slice-a-handoff.md)（Slice A 总范围 · **产品选项 A**）  
> - [`1.2-slice-a-shell-handoff.md`](./1.2-slice-a-shell-handoff.md)（U2 壳硬做）  
> - [`docs/UI-1.2.md`](../UI-1.2.md)（U0 锁定）  
> - 父包：[`1.2-ui-handoff.md`](./1.2-ui-handoff.md)（本 gate **不**验收 B/C）  
> 落盘：本文件 `docs/prompts/test-1.2-slice-a-gate.md`  
> 简报模板：[`test-1.2-slice-a-report-brief.md`](./test-1.2-slice-a-report-brief.md)（可覆写填结论）  
> 硬约束：不提交密钥；报告可脱敏本机路径。

---

## 0. 一句话任务

验证 **1.2 Slice A（选项 A）是否达到「可演示 / 可进发版准备」门槛**：自动化绿 + **冷启动整壳一眼升级**（活动栏 + 顶栏 + 侧栏 + Chat + 底栏）+ **1.1.9 编码闭环不回退**（尤其 Terminal T1）+ **未越界**（无 Layout IA 更换、无 L3 默认打开、无 Slice B/C 假完成）。

**产品钉死（选项 A）**：

1. **仅 Chat 变好看、顶栏/底栏/活动栏仍完全是 1.1.9 观感 → 不得完整 GO**（壳 P0 未过）。  
2. **T1「切 Chat 再回 Terminal，历史输出仍在」未过 → 不得完整 GO**（回归硬门槛；可用 Electron 手测或 `scripts/t1-pty-reattach.mjs` 若环境可用）。  
3. 仅 typecheck 绿、无 Electron 视觉 → 最多 **CONDITIONAL GO**（须写明残留风险）。  
4. package 仍为 `1.1.9` **不**算失败；抬版本是发版 Agent 的事。

---

## 1. 测试前环境确认

```bash
git status -sb
git log --oneline -8
git tag -l "v1.1.*" "v1.2.*" | sort -V | tail -8
node -p "require('./package.json').version"
node -p "require('./apps/desktop/package.json').version"
git diff --stat HEAD -- apps/desktop/renderer/
# 期望：最高产品 tag 含 v1.1.9；version 可能仍 1.1.9；working tree 有 1.2 Slice A 相关 M/??
```

### 1.1 必须存在的实现信号（缺则「实现未就绪」或 NO-GO）

| 信号 | 路径 / 期望（相对 `v1.1.9` 有 diff 或行为） |
|------|---------------------------------------------|
| 字体 token | `renderer/src/index.css` → `--font-ui` / `--font-mono` · body/code 使用 |
| Chat 1.2 | `ChatView.tsx` → 无 radial 营销光晕 · surface · 工具可折叠 · 空态非 gradient 大卡 |
| SideBar | `SessionSideBar.tsx` → active workbench 轨/密度 |
| Header | `AppHeader.tsx` → **非琐碎 diff** · 控件密度统一 · 「运行中」等中文 |
| StatusBar | `StatusBar.tsx` → **非琐碎 diff** · 运行中/空闲 · git「有改动/干净」类中文 |
| ActivityBar | `ActivityBar.tsx` → 主页钮 **非** zinc 白块徽章 · 与 rail 语言一致 |
| 窄屏 | `AppShell.tsx` → 跨阈值关抽屉/侧栏（`prevWidth` 或等价） |
| EmptyState | `page-states.tsx` → 密度略收（可选信号） |
| **不应出现** | Memory FTS 大改 · Goal OS 产品化 · 底栏终端 · Layout B/D |

**不要**因未抬版本到 1.2.0 判实现失败。

**机器**：Windows x64；能 `pnpm` + 启动桌面（`pnpm --filter @hfq/desktop start` 或项目惯用命令）。

---

## 2. 自动化门禁（必须跑）

在仓库根：

```bash
# 2.1 桌面类型（Slice A 主战场）
pnpm --filter @hfq/desktop run typecheck

# 2.2 PTY 回归（1.1.9 红线，本 train 不应破坏）
pnpm exec vitest run packages/pty/src/host.test.ts

# 2.3 可选但 GO 强烈建议
pnpm release:check
# = build + test + smoke + eval（若过慢：至少 typecheck + pty + desktop build）
```

| 结果 | 动作 |
|------|------|
| typecheck + pty 绿 | 自动化基线 PASS |
| `release:check` 绿 | 记入报告加分 |
| 红 | 贴失败摘要；**NO-GO** 或 Blocked；区分 flaky（node-pty `AttachConsole failed` 日志噪音 vs 真实 fail） |

---

## 3. 功能 / 视觉验收矩阵

图例：`P` Pass · `F` Fail · `B` Blocked · `S` Skipped（写原因）· `N/A`

### 3.1 冷启动整壳（选项 A · **发布级硬门槛**）

启动 Electron，绑定任意 workspace（或先无 workspace 看空态）。

| ID | 场景 | 步骤 / 期望 | 结果 |
|----|------|-------------|------|
| **V1** | 活动栏 | 主页钮 **不是**刺眼 zinc 白块；PRIMARY 中文 tooltip；active 与 workbench 语言一致 | |
| **V2** | 顶栏 AppHeader | 标题/工作区层级清晰；控件高度统一（约 h-7）；Chat 运行时见 **「运行中」**（非英文 running） | |
| **V3** | 会话侧栏 | 当前会话 active 可辨（workbench 轨/底）；密度紧凑；新建/搜索中文可用 | |
| **V4** | Chat 空态 | **无**大 gradient 营销卡；引导中文；hint 克制 | |
| **V5** | Chat 有消息 | 用户/Agent 区分清晰（非微信 IM 气泡）；工具卡可折叠；状态中文（运行中/失败） | |
| **V6** | 底栏 StatusBar | **运行中/空闲**；git **有改动/干净**（或等价中文）；模型/路径可点 | |
| **V7** | 右抽屉 | tabs 中文；打开 Terminal/Changes/Tasks 不崩；tabs 密度与壳一致 | |
| **V8** | 一眼升级 | 相对记忆中的 1.1.9：**壳+Chat 整体**像升级，而非「只改了聊天背景」 | |

**V8 = F 或 V1–V3/V6 大面积 F → 不得完整 GO（选项 A）。**

### 3.2 交互 / 窄屏

| ID | 场景 | 期望 | 结果 |
|----|------|------|------|
| **N1** | 宽→窄过 900 | 抽屉被收起（跨阈值） | |
| **N2** | 继续过 700 | 工作台路由下侧栏被收起 | |
| **N3** | 窄屏手动再开抽屉 | 不因每一次微小 resize 立刻被关死（prevWidth 逻辑） | |
| **N4** | Ctrl+B / Ctrl+J / Ctrl+K | 侧栏/抽屉/命令面板仍可用 | |
| **N5** | 命令面板 | 中文项；新建会话/终端/改动/设置可达（Palette 可仍偏 1.1.9，**不**单独因「未大改 Palette」判 NO-GO，除非完全不可用） | |

### 3.3 1.1.9 回归（硬门槛）

| ID | 场景 | 步骤 | 期望 | 结果 |
|----|------|------|------|------|
| **T1** | Terminal 切页 | Terminal 输出标记 → 切 **Chat** ≥3s → 回 Terminal | **仍见**标记输出 | |
| **T1b** | 可选脚本 | `node scripts/t1-pty-reattach.mjs`（若存在且环境可） | 脚本 PASS 可佐证；**不能替代**最终屏测若要完整 GO | |
| **C5** | Changes 请 Agent 修 | 写入 composer 草稿 + 进 Chat | **不自动发送** | |
| **C1** | 空 commit message | 禁用或中文 toast | 不能静默空提交 | |
| **R-L3** | Settings 更新 | `silentInstall` / 静默安装 | **默认仍关**；本 train 未默认打开 | |
| **R-IA** | 布局 | 活动栏+侧栏+中心+**右抽屉**终端 | **无**底栏终端 / 方案 B 主路径 | |

**T1 = F → 不得完整 GO。**  
**R-L3 默认被改开 / R-IA 换布局 → NO-GO。**

### 3.4 范围越界检查（走读 + git）

```bash
git diff --name-only HEAD
```

| ID | 检查 | 期望 | 结果 |
|----|------|------|------|
| **S1** | 无密钥/真 API key | 无 | |
| **S2** | 无 Memory FTS / Goal OS 大后端 | 无（或仅文档） | |
| **S3** | 无 electron-updater 迁移 | 无 | |
| **S4** | 主 diff 在 renderer shell/chat/css | 是 | |

---

## 4. 判定标准

| 结论 | 条件 |
|------|------|
| **GO** | §2 自动化基线绿 + **V8 过** + V1–V7 无 Blocker + **T1 过** + C5/C1/R-L3/R-IA 过 + 无 S 级越界 |
| **CONDITIONAL GO** | 自动化绿 + 壳/Chat 视觉基本过，但 **T1 未 Electron 手测** 或 N3/Palette 等非 P0 残留；或 V 有轻缺陷不挡演示 | 须列 **发版前必补** 清单 |
| **NO-GO** | typecheck 红 · 壳仍无 Header/Status/Activity 实质升级（选项 A 失败）· T1 失败 · L3 默认被打开 · Layout IA 被换 · 严重白屏/崩溃 |

**本 gate 的 GO ≠ 已发 1.2.0**；仅表示 **可交给发版 Agent 写 `release-1.2.0`（届时另写）**。F2/Slice B **不**要求本 gate 通过。

---

## 5. 回传格式（必须）

1. **结论一行**：`GO` | `CONDITIONAL GO` | `NO-GO` + 一句话理由  
2. 环境：`git status` 摘要 · version · 最高 tag  
3. 实现信号表：P/F  
4. 自动化：命令 + 结果（失败贴尾部日志）  
5. 矩阵：§3 各 ID 填 P/F/B/S  
6. **BUG-xxx** 列表（若有）：现象 · 复现 · 严重度  
7. 截图或操作路径（至少）：壳总览 · Chat · StatusBar 中文态 ·（T1 若测）Terminal 回页  
8. 范围越界：S1–S4  
9. 给统筹的建议：是否写 `release-1.2.0` · 是否先修 BUG · Slice B 是否仍禁止  

可把精简结论写入 / 覆写：[`test-1.2-slice-a-report-brief.md`](./test-1.2-slice-a-report-brief.md)。

---

## 6. 与其它 Prompt

| 文件 | 角色 |
|------|------|
| `1.2-slice-a-shell-handoff.md` | 实现刀（壳） |
| **本文件** | **测试门禁** |
| `release-1.2.0.md` | **尚未写**；仅 GO/CONDITIONAL 且产品同意后由统筹写 |

---

**开始测试。完整 GO 需要：整壳视觉过 + T1 不回退 + 自动化绿。**
