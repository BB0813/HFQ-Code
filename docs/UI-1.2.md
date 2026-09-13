# HFQ Code · UI 1.2 选型纪要（U0 门禁）

Status: **LOCKED for 1.2 train** · 2026-07-21  
Baseline product: **1.1.9** (`v1.1.9`)  
Canonical implement prompt: [`docs/prompts/1.2-ui-handoff.md`](./prompts/1.2-ui-handoff.md)  
Plan: [`docs/prompts/1.2-ui-plan.md`](./prompts/1.2-ui-plan.md) · Layout history: [`LAYOUT-PROPOSALS.md`](./LAYOUT-PROPOSALS.md)

---

## 选型（本 train 默认，实现按此执行）

| 项 | 决定 | 说明 |
|----|------|------|
| 信息架构 | **Layout A 深改（换皮 + 密度 + 动效）** | 活动栏 + 会话侧栏 + 中心 Chat + 右侧抽屉。**不**换成 VS Code 全文件树主路径，**不**默认 D 底栏终端 |
| 框架 | 保持 **React 19 + Tailwind + shadcn** | 不重开 vanilla；不引入第二壳 |
| 终端挂点 | **继续右侧抽屉 tab**（changes / terminal / tasks） | 允许后续 prefs「默认打开 tab」；**1.2 不做**可拖底栏 PTY 重架构 |
| 密度 | **IDE 紧凑** | zinc 工作台；行高/间距偏工具而非营销落地页 |
| 文案 | **中文产品 UI** | 代码/技术文档可中英 |
| 反模式 | 禁止泛滥「AI 紫」营销卡、大面积玻璃拟态、IM 会话气泡化 | 始终本地编码 Agent |

### 明确不采纳（1.2）

- 方案 B 全量 IDE 化（文件树为默认主栏）  
- 方案 C 极简对话占满、弱化改动审阅  
- 方案 D 默认底栏终端（语法可借鉴动效/折叠，**不**改默认挂点）  
- IM / 多账号社交壳  

若产品中途改挂点或改 IA，必须先改本文 + DECISIONS，再改 handoff。

---

## 切片与发版建议

| 版本建议 | 范围 |
|----------|------|
| **1.2.0** | U1 设计系统 + U2 壳 + U3 Chat（最大感知） |
| **1.2.1** | U4 编码三页版式 + U5 次级页统一 |
| **1.2.1 或 1.2.2** | F2-4 Memory 可检索 · F2-Goal 轻量 · F2-5 panel prefs |

允许单 tag `1.2.0` 含多 slice，但验收仍按 U/F 勾选。

---

## 成功标准（列车结束）

- 一眼「工作台升级」：壳 + Chat + 密度  
- 1.1.9 编码闭环不回退（PTY reattach / Changes / Tasks）  
- Memory **可检索**或 Release 书面延期  
- L3 silent **仍默认关**；`pnpm release:check` 绿  
