# HFQ Code · 布局方案审核（先选型，后改生产 UI）

Status: **SELECTED · Layout A** (2026-07-15) · production shell **R9 React + shadcn**  
Date: 2026-07-15  
Static mocks: [`docs/design-proposals/`](./design-proposals/index.html)

## 选型结论

| 项 | 决定 |
|----|------|
| 布局 | **A · Cursor Agent 中枢** |
| 框架 | React 19 + Tailwind + shadcn（直接替换 vanilla） |
| 终端 | **右侧抽屉 tab**（非底栏 B/D） |
| 文档 | [DECISIONS.md](./DECISIONS.md) Q6 · [UI-REDESIGN.md](./UI-REDESIGN.md) R9 |

## 原则

1. 信息架构以 **A** 为生产壳  
2. **借鉴主流工具的布局语法，不抄皮肤** — Cursor / VS Code / Claude / Zed / Trae / Codex  
3. **中文产品文案**；代码与技术文档可中英  
4. **不滑向 IM 网关** — 始终是本地编码工作台  


## 方案 D · 三合一工作台（合成稿）

静态页：[`docs/design-proposals/D-hybrid-workbench.html`](./design-proposals/D-hybrid-workbench.html)

把 A/B/C **合成一套默认可落地布局**，而不是再发明第四种风格。

| 区域 | 来源 | 行为 |
|------|------|------|
| 活动栏 | A + B | 会话 / 文件 / 改动 / 任务 / 技能 / 更多 |
| 左侧列表 | A 为主 | 默认**会话列表**；点「文件」才显示轻量树（B） |
| 中央 | C 为主 + A | **对话时间线**干净；顶栏极简 |
| 右侧 | A | **改动 / 任务 / 详情**检视；可折叠 |
| 底栏 | B | **PTY 终端**首选挂载；默认可收起，需要时展开 |

### 默认开关

- 开：活动栏、会话列表、对话、右侧改动（有 diff 时）  
- 收：底栏终端、文件树  
- 窄屏：右 → 左 依次折叠  

### 框架

与 A/B 相同：倾向 **React/Preact + 自研 tokens**；Agent 核心不动。选定 D 后再开生产壳迁移。

### 为何推荐 D 作为审核主稿

1. 符合「编码 Agent」主路径：说 → 改 → 审  
2. 给 1.1 PTY 一个自然挂点（底栏），又不逼用户时刻看着终端  
3. 文件树可选，避免一上来变成重 IDE  
4. 中央保持 C 的阅读舒适度  

---
## 三套方案对照（拆开对比）

| | **A · Cursor Agent 中枢** | **B · VS Code 工作台** | **C · Claude/Zed 焦点** |
|--|---------------------------|------------------------|-------------------------|
| **结构** | 活动栏 + 会话列表 + 中央对话 + 右侧改动/终端 | 活动栏 + 文件树 + 标签编辑区 + 底栏终端 + 右改动 | 极窄导航 + 全宽对话 + 浮层改动/终端 |
| **主路径** | 说 → 改 → 右侧审 | 文件/测试权重高，Agent 为中心标签 | 对话几乎占满 |
| **终端** | 右侧 tab 或抽屉 | **底栏 PTY** 最自然 | 浮层 / 命令调出 |
| **改动审阅** | 右侧检视器 | 右侧 SCM 式 | 底部/浮动 sheet |
| **实现成本** | 中 | 高（面板状态多） | 低～中 |
| **框架建议** | React/Preact 多面板更顺；可先模块化 vanilla 验证 | **强烈建议框架** + 布局引擎 | vanilla 也能撑；框架收益较小 |
| **推荐场景** | **默认推荐**：编码 Agent 日常 | 重度 IDE 用户 / 要文件树 | 讨厌 chrome、对话驱动 |

### 打开方式

```text
docs/design-proposals/index.html
  ├─ A-cursor-agent.html
  ├─ B-vscode-workbench.html
  └─ C-claude-zen.html
```

浏览器直接打开即可（不依赖 Electron）。

## 框架决策（与布局绑定）

| 选型 | 框架建议 | 说明 |
|------|----------|------|
| **A** | 倾向 **React 或 Preact + 自研 CSS tokens** | 会话列表 + 主对话 + 检视器三栏状态清晰；Agent 核心仍 TS monorepo |
| **B** | **React + 面板状态**（可参考工作台模式） | 底栏 PTY、标签页、树；vanilla 维护成本高 |
| **C** | **可继续 vanilla islands** | 结构简单；若仅 C 可暂缓框架 |

**明确不做（选型前）：** 整站 Tailwind 重写、上 Ant/shadcn 默认皮肤、为框架而框架。

## 生产落地顺序（选定后）

1. 冻结布局 ASCII + 关键页面清单（本文件勾选）  
2. 若需框架：新建 `apps/desktop/renderer-next` 或 `ui/` 并行壳，**IPC / agent-core 不变**  
3. 按页迁移：Shell → Chat → Changes → Terminal(PTY) → 其余  
4. 每页 `release:check`；旧 vanilla 可开关回退一版  

## 与 1.1 的关系

- **PTY 预研不阻塞选型** — 见 [PTY-1.1.md](./PTY-1.1.md)  
- 终端 UI 落点：  
  - A → 右侧 tab / 可拖抽屉  
  - B → 底栏（首选）  
  - C → 浮层或全屏临时页  

## 审核请回复

请直接回复其一（可附修改）：

- **选 D（三合一，推荐）** / **选 A** / **选 B** / **选 C**  
- 或 **A 为主 + B 的底栏终端** 等混合说明  

未回复前：**生产 UI 不做大改版**；继续 1.1 能力与文档推进。
