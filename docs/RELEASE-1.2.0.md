# RELEASE · HFQ Code **1.2.0**（Slice A · 壳 + Chat 工作台升级）

> 日期：2026-09-13 · 基线：`v1.1.9` → 本版 `v1.2.0`  
> 范围：**1.2 Slice A only**（设计 token · 壳层 · Chat）— **不含** Slice B/C（Terminal/Changes/Tasks 大版式 · Memory FTS · Goal OS）。  
> 选型：[`UI-1.2.md`](./UI-1.2.md)（U0 锁定）· 实现：[`prompts/1.2-slice-a-handoff.md`](./prompts/1.2-slice-a-handoff.md) + [`prompts/1.2-slice-a-shell-handoff.md`](./prompts/1.2-slice-a-shell-handoff.md)  
> 测试：[`prompts/test-1.2-slice-a-gate.md`](./prompts/test-1.2-slice-a-gate.md) → **CONDITIONAL GO**（自动化绿；屏测由发版补齐，见 Verify）

---

## Why

1.1.9 补齐编码闭环后，用户对工作台的「观感代差」成为最大短板：壳层组件各自为政、Chat 带 AI 营销光晕/空态大卡、状态与角色中英混杂。1.2 第一刀（选项 A）把 **设计系统 + 壳 + Chat** 拉到统一的 IDE 密度中文工作台，信息架构（活动栏 + 会话侧栏 + 中心 + 右抽屉）不变。

## Highlights

1. **设计 token**：`--font-ui` / `--font-mono` 全局生效；EmptyState 去虚线框、密度收紧。
2. **壳层（选项 A 硬做）**：
   - 活动栏：主页钮从 zinc 白块徽章并入 workbench rail 语言；strokeWidth 统一
   - 顶栏：控件统一 `h-7`；运行态 **「运行中」**；权限/模型 chip 跟随 surface token
   - 底栏：**运行中/空闲** · git **有改动/干净**；分区与 hover 统一
   - 会话侧栏：active 用 workbench 轨；列表密度收紧
   - 窄屏：跨 900/700 阈值依次收抽屉、侧栏（跨阈值触发，不与手动开合打架）
3. **Chat**：移除 radial 营销光晕与空态 gradient 大卡；工具卡可折叠、运行/失败中文化；角色标签中文化（你 / Agent）。
4. **文档/流程**：U0 选型锁定（`UI-1.2.md`）；1.2 全列车 + Slice A 双 handoff + 测试 gate 落盘 `docs/prompts/`。

## Install

- 安装包：GitHub Release 附件（NSIS / portable · CI `pack:win` 产物 + SHA256SUMS）
- 已装旧版：应用内 检查更新（L0–L3 行为本版无变化；静默安装仍默认关）

## Verify（发版自检）

- [x] `pnpm release:check` 绿（build + 193 tests + smoke + eval 10/10）
- [x] **Electron V8**：冷启整壳一眼升级（活动栏/顶栏/侧栏/Chat/底栏）— 屏测 PASS：主页钮 rail 化、顶栏 h-7+「完全访问/模型」、底栏「HFQ v1.2.0 · 非 Git · 空闲 · grok-4.5」、抽屉中文 tabs、消息角色「你/Agent」
- [x] **Electron T1**：Terminal 标记输出 → 切「改动」页 ~10s → 回「终端」tab → ring 回放完整（`echo HFQ-1.2.0-REATTACH-MARKER` + 输出 + prompt 均在屏，PTY 未重spawn）
- [x] StatusBar 版本显示 **1.2.0**；运行中/空闲 · 有改动/干净（非 Git 时显示「非 Git」）
- [x] L3 `silentInstall` 默认仍关（抽检 `updatePolicy` schema）
- [x] Layout 仍为右抽屉终端；无底栏终端
- [x] Changes ask-agent 不自动发送；空 message 不能 commit（1.1.9 逻辑未动，走读）

## Out of scope（下一站）

- Slice B：Terminal / Changes / Tasks 三页版式统一（`1.2-ui-handoff.md` §U4–U5）
- Slice C：Memory FTS / Goal light / panel prefs
- 已知残留：CommandPalette 未做 1.2 专项打磨（功能完好）；Chat 长工具输出默认展开
