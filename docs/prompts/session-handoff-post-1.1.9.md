# 会话压缩交接 · post-1.1.9 → 1.2 统筹起点

> 用途：对话过长时的**状态压缩**；开 1.2 前读本文件即可，不必回翻全历史。  
> 日期：2026-07-21 · 仓库：`HFQ_Clod-Agent` · 角色：统筹联调  
> 产品：Windows 桌面编程智能体（Electron+TS）— **不是** IM 网关  

---

## 1. 当前基线（事实）

| 项 | 值 |
|----|-----|
| Baseline | **1.1.9** · tag **`v1.1.9`** · commit `a94dad9` |
| 工作区 | 发版后应为 **clean** / `main` ≈ `origin/main` |
| Release | https://github.com/BB0813/HFQ-Code/releases/tag/v1.1.9 |
| Layout | **A**（Cursor 中枢）· React + shadcn · DECISIONS Q6 |
| 更新阶梯 | L0–**L3 shipped**（1.1.7 L1+L2 · 1.1.8 L3 opt-in `/S` · **永不默认开**） |

### 1.1.x 已 ship（近端）

| 版 | 要点 |
|----|------|
| 1.1.5 | F1 Profiles / mermaid / skill match / goal 字段 / memory links |
| 1.1.6 | compression compact · goal sidecar · `read_document` |
| 1.1.7 | 更新 L1+L2 |
| 1.1.8 | 更新 L3 opt-in 静默 + Path A |
| **1.1.9** | PTY ring + `ptyGetScrollback` · Terminal 切页重连 · Changes toast · Electron **T1 PASS** |

### 明确不做（近端仍有效）

- IM 网关 / 多租户云 Agent  
- 默认静默更新 · 无书面例外不迁 electron-updater  
- 跳过 1.1.9 直接大改壳（**已满足**：1.1.9 已 ship）  

---

## 2. 产品排序（用户钉死）

```text
✅ 1.1.9 小补丁（编码闭环）
 → 🔜 1.2 大动 UI（+ F2 余量可切片）
```

规划源：`docs/prompts/1.2-ui-plan.md` · ROADMAP Next · ADOPT F2 remainder  

---

## 3. 1.2 规划摘要（未实现）

**主轴 UI（必须过 U0 门禁）**

| 包 | 内容 |
|----|------|
| **U0** | 设计选型：A 深改 vs D 混合 · 终端右抽屉 vs 底栏 · 密度 |
| **U1** | 设计系统 tokens / 密度 / 反模板感 |
| **U2** | 壳：活动栏 / 侧栏 / 顶栏 / 抽屉 / 窄屏 |
| **U3** | Chat 工作台 |
| **U4** | Terminal / Changes / Tasks **版式**（行为已在 1.1.9） |
| **U5** | Settings / Skills / Memory / Models 统一 Page 语法 |

**副轴 F2（可与 UI 分 slice）**

- Memory FTS5 / 倒排  
- Goal OS 轻量（非多租户 goals.db）  
- Panel prefs（与 U2 相关）  

**硬规则**

1. U0 **人工选型**前禁止大面积改 `AppShell` 信息架构  
2. 分 slice 发版（1.2.0 / 1.2.1…）优于 big-bang  
3. IPC 尽量稳定；大改优先 renderer  

---

## 4. 关键路径速查

| 用途 | 路径 |
|------|------|
| 1.2 规划 | `docs/prompts/1.2-ui-plan.md` |
| 布局提案 | `docs/LAYOUT-PROPOSALS.md` · `docs/design-proposals/` |
| UI 迁移史 | `docs/UI-REDESIGN.md`（R9 React） |
| 决策 | `docs/DECISIONS.md` Q6/Q8/Q9 |
| 路线图 | `docs/ROADMAP.md` baseline 1.1.9 |
| PTY | `docs/PTY-1.1.md` · `packages/pty` · TerminalPanel |
| 更新 L3 | `docs/UPDATE-L1-L3.md` · DECISIONS Q9 |
| Prompt 索引 | `docs/prompts/README.md` |
| 编排规则 | `AGENTS.md`（handoff 落 `docs/prompts/` 整包不拆 FE/BE 漂移） |

---

## 5. 工程习惯（统筹）

- 大改前读 `DECISIONS.md` + `ARCHITECTURE.md`  
- 实现/测试/发版：**整包 prompt 文件**，聊天只给路径+摘要  
- 发版硬门槛写进 release prompt（例：1.1.8 Path A · 1.1.9 Electron T1）  
- `pnpm release:check`；版本只抬根 + `apps/desktop`  
- 工作区工具 path-escape；不提交密钥  

---

## 6. 开 1.2 时统筹第一步（下轮直接做）

1. 确认基线仍 clean / 1.1.9  
2. 读 `1.2-ui-plan.md` + LAYOUT + 现行 shell 结构  
3. **U0 门禁材料**：选项对照（A 深改 / D 混合 / 终端挂点 / 密度）→ 请用户拍板  
4. 用户确认后写：  
   - `docs/UI-1.2.md` 或回写 LAYOUT 选型纪要  
   - `docs/prompts/1.2-ui-handoff.md`（或 U1–U3 第一刀整包）  
5. **不要**在 U0 未过时开大面积实现  

---

## 7. 本会话不再需要的细节（可丢）

- 1.1.6–1.1.8 逐文件联调长文  
- 启动超时 8s/12s 修复过程（已随既有 train 处理）  
- 测试矩阵逐格过程稿（结论已进 RELEASE / prompts done）  
- CONDITIONAL GO 中间态（1.1.8 Path A · 1.1.9 T1 均已由发版补齐）  

**保留口令**：基线 1.1.9 · 下一刀 1.2 U0 · 不 IM · L3 默认关 · handoff 落盘  

---

**压缩完毕。下一用户句「开始 1.2」→ 从 §6 执行。**
