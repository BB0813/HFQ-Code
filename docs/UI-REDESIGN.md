# UI / UX 架构迁移与重设计（已提前）

Status: **R9 in progress · React + shadcn Layout A**  
Last updated: 2026-07-15 · R0–R8 archived; **R9 supersedes R5/Q5**  
 

Canonical product plan: [ROADMAP.md](./ROADMAP.md) Track C · 中文总览: [项目规划书.md](./项目规划书.md)

---

## Why（为什么提前）

`apps/desktop/renderer/app.js` 已超过 **约 5300 行**，是页面路由 + 状态 + 事件绑定的单体文件。  
1.0.3 对话打磨、1.0.5～1.0.9 技能商店、权限与模型菜单都继续往里堆，**再在巨石上做 1.1 终端 / 任务树 / 改动页会显著提高回归成本**。

产品决定：**界面架构迁移 / 优化往前提**——先完成结构拆分（R1），再放大视觉与交互改动（R2～R4），而不是等 1.1 功能全部做完再拆。

---

## Principles（原则）

1. **可随版本切片发版** — IPC / agent-core 约定保持稳定  
2. **反模板感** — zinc / IDE 密度；避免泛滥的「AI 紫」营销卡  
3. **产品界面中文** — 文案中文；代码与技术文档可中英  
4. **不滑向 IM 网关** — 始终是编程工作台  
5. **R9 推翻 R5** — 直接 React + shadcn；vanilla 归档 `renderer-legacy/`

---

## R9 — React + shadcn 全量替换（2026-07-15）

| 项 | 内容 |
|----|------|
| 路径 | `apps/desktop/renderer`（Vite React TS）→ `renderer/dist` |
| 布局 | **A** 活动栏 + 会话侧栏 + 中心 Chat + 右侧抽屉 |
| 加载 | `electron/main.cjs` → `renderer/dist/index.html` |
| 归档 | `apps/desktop/renderer-legacy/`（旧 vanilla + Shoelace） |
| 决策 | [DECISIONS.md](./DECISIONS.md) Q6 |

验收：`pnpm --filter @hfq/desktop start` 出壳；14 hash 路由；PTY/Git/Tasks/Usage/Settings 接线。

### R9 截图自审（2026-07-16）

工具：`scripts/screenshot-hfq.py`（boot-route 经 `%APPDATA%/@hfq/desktop/boot-route.txt`）

| 截图 | 路径 |
|------|------|
| Chat 空态 | `docs/design-proposals/_audit-r9-final-chat.png` |
| Home | `docs/design-proposals/_audit-r9-final-home.png` |
| Settings | `docs/design-proposals/_audit-r9-final-settings.png` |
| 交互迭代 ix | `docs/design-proposals/_audit-r9-ix-*.png` |
| 交互迭代 ix2 | `docs/design-proposals/_audit-r9-ix2-{chat,home,settings,terminal}.png` |
| UX Pro Max ix3 | `docs/design-proposals/_audit-r9-ix3-{chat,home,settings,terminal}.png` |

本轮视觉 / 交互修正：
- 去掉中心黑空洞 → 空态引导 + 快捷提示 chip + 抬升 composer
- zinc 表面/边框对比度；状态栏产品版本 `1.0.9`
- Settings 去掉 Radix Select（file:// 下易挂），改 button group；DPAPI 徽章可见
- **路由感知壳**：二级页自动收起会话侧栏与检视抽屉；工作台路由保留 Layout A
- **命令面板** Ctrl+K；侧栏 Ctrl+B；检视 Ctrl+J；新建会话 Ctrl+N；打开工作区 Ctrl+O
- 活动栏加入「终端」；全页终端时不叠双 PTY 抽屉；Changes 仅 dirty 时显示 commit 条
- Terminal 面板去掉 Radix Select（chip 切换 shell）+ 空态 CTA
- 会话列表 active 左边条；权限弹窗强化；composer 字数/焦点环
- 二级页 `hideTitle` 避免与顶栏重复标题
- **UX Pro Max 对齐（ix3）**：focus-visible ring-2、cursor-pointer、150ms 过渡、prefers-reduced-motion、删除会话确认、运行态 success 绿、muted 对比度提升、aria-label / listbox 命令面板、tool 卡图标底座
- bootstrap `finally` 必出 splash + 8s 启动超时；主区 ErrorBoundary
- 截图脚本：仅 PrintWindow 重试（禁桌面 BitBlt，避免 QQ 等顶层窗污染）+ settle 直到 unique≥100
- **IPC 合同对齐（ix4）**：修复前端与 main/agent-core 字段不一致导致「后端像没接上」
  - `session:send` → `{ sessionId, text }`（非 `content`）
  - workspace IPC → `{ workspacePath }` 归一化为 UI `path`
  - `openSession` 快照 → `info` + `messages[].text`；`messageBody` 兼容 text/content
  - 事件：`message.delta|completed`（`text`）、`permission.requested`（`summary`）、`session.completed|failed|aborted`、`tool.started|completed`、单路径 `diff.updated`
  - `permission:resolve` → `{ requestId, decision: allow|deny|allow_session }`
  - 无工作区时 create/send 引导打开；失败 toast；bootstrap 可重入刷新 `info`
- **UX Pro Max ix5（IDE 密度）**：
  - 语义 token：`warning` / `panel` / `panel-elevated`；边框对比略抬；scroll thumb 更细
  - 组件工具类：`status-dot-*`、`msg-user|agent|tool`、`composer-shell`、`hint-chip`、`section-label`、`skeleton`
  - Shell：活动栏 active bar、Header running badge、侧栏无工作区 warning 态、StatusBar success/warning 色点
  - Chat：角色左边条、tool running spinner、未绑定工作区 inline banner、发送 loading
  - Home：loading 按钮、未绑定高亮、最近会话 running 点
- **UX Pro Max ix6（全页交互一致性）**：
  - 共享 `page-states`：`ErrorBanner` / `EmptyState` / `LoadingBlock` / `SectionHeader` / `RefreshButton` / `ChipButton`
  - 二级页统一：Skills · Models · MCP · Memory · Usage · Permissions · Audit · Import · Settings — loading / empty / error / toast / busy 按钮
  - Usage：token 摘要卡 + 导出 + reveal；Permissions：矩阵表 + 会话允许 badge；Audit：暂停/清空事件流；Import：扫描空态 CTA
  - Settings：Chip 主题/shell、保存 loading、诊断 toast、DPAPI success badge
  - 面板：Changes（ErrorBanner + EmptyState + toast commit/revert）、Terminal（EmptyState + Chip shell）、Tasks（状态 badge + SectionHeader）
- **UX Pro Max ix7（可读性放大 · 反过密）**：
  - 根字号 14px；`2xs` 抬到 12px、`xs` 13px；圆角 `--radius` 0.5rem
  - 控件：Button default h-9 / sm h-8 / icon 9·8；Input h-9；Badge 常规 `text-xs`
  - 壳：ActivityBar w-12 · Header h-12 · SideBar 248 · Drawer 340 · StatusBar h-7
  - 页面：`PageScaffold` max-w-5xl + 更大 padding；Chat 正文 14px、composer 更高；Home/二级页去 `h-7`/`text-2xs` 压迫
  - 共享 `page-states` 与 18 个页面/面板批量抬密度（图标 4×4、行距/卡片更松）
- **参考 AthenaOS 工作台语汇（ix8，借鉴布局语法不抄皮肤）**：
  - 来源：本机 `AthenaOS/data/layout.json` — 水平 multi-leaf dock：`chat` / `sessions` / `plugins` / `files` / `settings`；leaf 约 450px 宽、标题化面板
  - 会话侧栏 **280** + dock 标题条「会话」；右侧检视 **380** + 大号 tab
  - 中心对话 `max-w-[760px]`、更大 padding；面板 header 用 `dock-pane-*` 工具类
  - 分栏边框/背景对比加强（pane 作为一等公民，避免 chrome 糊成一片）
  - 保持 Layout A（活动栏 + 会话 + Chat + 右抽屉）；不迁 Athena 的插件/文件三栏默认
- **多 Agent 编码工作台语汇（ix9，截图对齐 + 产品定位）**：
  - 产品语义：HFQ = **多 Agent 编码工作台**（会话 / 子 Agent / 技能 / MCP / 模型路由），非 Athena 自由 dock OS；**只借视觉语法**
  - Token：`--workbench` 暖橙强调（rail 左边条、active tab ring、capability-tag、Chip active）
  - 共享：`MetricStrip` + `CapabilityCard`（状态点 · 名称 · badge · 能力 tag · trailing 开关）
  - Skills / MCP / Models：顶部指标条 + 能力卡网格；Home 文案改为「多 Agent 编码工作台」
  - ActivityBar active 用 workbench 高亮；RightDrawer tab active 暖色 ring
  - 会话侧栏标题「Agent 会话」

---

## Phases（历史 R0–R8 · 归档）

### R0 — 盘点（仅文档）✅ 1.0.5

- [x] 建立本清单  
- [x] 热点：`app.js` 各页、对话输入区、技能商店页签、设置里的更新面板  

### R1 — 壳层结构拆分 ✅ **结构边界已落地**（行为不变的搬家）

目标：把 `app.js` 收成「编排器」，页面与纯函数外置。

- [x] 首次抽出：`skills-ui.js`（`HFQSkillsUI` 纯函数）— **1.0.6**  
- [x] `nav-ui.js` / 侧栏构建 + `ICONS` / `NAV_META`（`HFQNavUI`）  
- [x] `pages/settings-ui.js`（含更新源、诊断区块，`HFQSettingsUI`）  
- [x] `pages/skills-page.js`（商店 + 已安装，`HFQSkillsPage`）  
- [x] `chat/chat-shell.js`：消息列表 HTML + 会话页壳（`HFQChatShell`）  
- [x] `shared-ui.js`：面板头 / 空状态 / 分段页签 / escape / shortPath  
- [ ] 键盘焦点说明（弹窗 / 命令面板）— 仍挂在 `app.js` 绑定逻辑  
- [x] 首页 / 任务 / 改动页 HTML 外置（R4）  
- [ ] 继续瘦身：handlers / 绑定逻辑仍可从 `app.js` 外移  

**模块加载顺序**（`index.html`，CSP `script-src 'self'`）：

```text
shared-ui → nav-ui → skills-ui → islands/bootstrap
→ pages/settings-ui · skills-page · home-page · tasks-page · changes-page
→ chat/chat-shell → app.js
```

**R1 完成标准（退出条件）**

1. ~~大块页面逻辑不再堆在单文件里~~ — 设置 / 技能 / 对话 / 首页 / 任务 / 改动 / 导航已外置；`app.js` 仍持状态与 handlers（约 5300 → ~4620 行）  
2. ~~至少具备：导航壳、设置页、技能页、对话壳~~  
3. ~~共享三件套：面板头 / 空状态 / 分段页签~~（`HFQSharedUI`）  
4. ~~`pnpm release:check` 全绿；无接口破坏~~  

**后续 R1+（非阻塞）**：把 `bind*Handlers` 与剩余页面 HTML 继续外移；键盘焦点文档化。

### R2 — 对话 / 会话体验（紧接 R1 的 chat 模块）✅

- [x] 长消息列表窗口化（默认最近 80 条，可「显示更早」）— 非完整虚拟滚动  
- [x] 工具调用卡片（输入/输出可折叠；started/completed 按 callId 合并）  
- [x] 更稳的粘性输入区 + 层级 kicker（`composer-shell-sticky`）  
- [x] 长目标横幅（预算 + 停止）— **1.0.6**  
- [ ] 完整虚拟列表（仅当窗口化不够时再上）  

### R3 — 技能商店视觉 ✅

- [x] 网格密度、分类条、空状态  
- [x] 安装冲突确认 — **1.0.6**  
- [x] 技能说明预览抽屉 — **1.0.6**  
- [x] 标签筛选视觉抛光（分类 rail + chip + 卡片标签）  
- [x] 远程包安装 — **1.0.9**  

### R4 — 首页 / 任务 / 改动 ✅

- [x] 首页「恢复工作」仪表盘（最近会话 + 进行中的目标）— `pages/home-page.js`  
- [x] 任务树：子智能体 + 长目标 + 工具步骤 — `pages/tasks-page.js`  
- [x] 改动页多文件审阅布局（侧栏摘要 + diff 面板）— `pages/changes-page.js`  

### R5 — 渐进岛屿（**不**整站 React）✅ 决策落地

**结论（2026-07-15）：** R1～R4 的 vanilla 模块拆分已足够维护；**不引入 React/Vue 全量重写**。

- [x] 仅当 R1～R2 仍不够维护时再评估全框架 — **评估结果：不够不够的前提不成立，保持 vanilla**  
- [x] 优先「岛屿」渐进：`islands/bootstrap.js` → `window.HFQIslands`  
  - `register / mountAll / unmountAll`  
  - 内置：`composer-focus`、`skill-tag-rail`  
  - `app.js` 在 `renderPage` / 异步重绘后 `remountIslands()`  
- [x] 禁止巨石未拆就全量重写 — 已遵守  

```text
shared-ui → nav-ui → skills-ui → islands/bootstrap
→ pages/* (settings, skills, home, tasks, changes)
→ chat/chat-shell → app.js
```

---

## 与版本列车的关系（提前后）

```text
1.0.9 已发
   │
   ▼
✅ R0～R5 UI 架构列车（结构 + 对话 + 商店 + 首页/任务/改动 + 岛屿）
   │
   ▼
✅ R6～R7 视觉列车（Obsidian → quiet IDE → 单层 CSS）
   │
   ▼
✅ R8 Shoelace 设计系统（本地 vendor + 主题桥 + 壳层；无 React）
   │
   ▼
下一主线：1.1 真交互终端（PTY）+ Changes/Git 功能深度 · LAYOUT 选型后多栏壳
```

| 优先级 | 事项 |
|--------|------|
| **P0** | 1.1 可交互终端（PTY） |
| **P1** | 1.1 Changes/Git + 子代理可观测性 |
| **P2** | 业务页逐步换 `<sl-*>` 控件；LAYOUT 选型 |
| **—** | R0～R8 结构与设计系统接入 **已落地** |

### R6 — 壳层 Obsidian 视觉（2026-07-15）

- 保留现有 CSS 变量名与 DOM/ID 契约；暗/亮令牌对齐 Obsidian（`#080A0F` + cyan `#22D3EE`）
- 侧栏 / 顶栏 / 全局 `.btn`·`.panel`·`.pill` 密度收敛；硬编码 sky-blue → `var(--accent*)`
- `main` 内增加只读底栏 `#statusBar` 区域（`.statusbar`）；不替代顶栏 pill
- **不**引入 React / 不接 `@hfq/obsidian-ui` 进 Electron（R5 仍有效）

### R6.1 — 主题完整性 / 密度 / 可选中（2026-07-15）

- 亮色：去掉输入框 / 聊天底 / diff·终端 / badge 等硬编码暗 hex，统一 token
- 会话/终端/变更：`100vh` 改 content flex 填充，消除双滚动
- 全局 `user-select: none` 保留在壳层；消息/代码/diff/路径/表格可复制
- 导航 30px 行高 + 更紧 section；polish 尾段去掉 `!important` 叠层
- 状态栏文案 `HFQ Code`（不再写 Obsidian · ready）

### R6.2 — 产品级 motion / 交互反馈（2026-07-15）

- 切页：`setContentHtml` + `.page-enter`（仅 page id 变化时 220ms fade/rise）
- 同页刷新不动画（避免列表/技能重绘闪屏）
- 导航 active 左侧 cyan rail；按钮 press scale；菜单/模态 enter
- 去掉全量消息 `msg-in`（流式重建会闪）；保留 busy pulse / streaming caret
- motion tokens：`--dur-fast/slow`、`--ease-out`、`--z-*`；`prefers-reduced-motion`

### R6.3 — 设计语言重置 · quiet IDE（2026-07-15）

判定：R6～R6.2 仍是「青系驾驶舱 token 叠在旧 IA 上」，观感偏装饰、不稳。  
方向改为 **Cursor / Linear 工作台语汇**（vanilla CSS，R5 不变）：

- **锌灰底** `#09090b` 栈，去掉 navy 偏色与大面积 cyan 填充
- **主按钮中性**（`--primary` 白/黑），cyan 仅 focus ring / busy 点
- 导航 active 中性底；去掉 cyan rail 与 logo 光晕
- 对话：消息流扁平（user 浅底、assistant 无边框卡、tool 线框）
- 首页 spotlight / resume / metric 去掉 mesh 渐变与青洗
- motion 收敛为短 fade；无装饰性 scale 动画
- 脚本：`scripts/ui-language-reset.py`（可重放 token+壳层）

### R7 — 完整调研后重设计（2026-07-15）

**调研来源：** `UI-REDESIGN` · `LAYOUT-PROPOSALS`（D hybrid 意图）· `design-proposals/*` · 生产 renderer 审计（CSS 级联债 / 首页营销感 / 会话工具栏过重）。

**结论落地（vanilla，R5 不变；未选型前不做多栏壳）：**

1. **`styles.css` 单层重写**（~3200 行残影 → ~2430 行干净 cascade）— `scripts/ui-full-redesign.py`
2. **视觉：** zinc 工作台 + 中性 primary + cyan 仅 focus/live；无青轨 / mesh / logo 光晕
3. **首页：** 去「上手路径」营销块；主轴 = 继续工作 + 状态条 + 双列表
4. **会话：** 工具栏单行 meta（去掉卡片堆叠）；stream/composer 保持扁平
5. **契约：** ID / `data-*` / CSS 变量名 / 页面 id 不变

**仍不做：** D-hybrid 活动栏+右检视+底栏 PTY 整壳（等 LAYOUT 选型）；React 进 Electron。

### R8 — Shoelace 设计系统（2026-07-15）

判定：R6～R7 自研 CSS 仍呈「拼图感」；侧栏与控件缺统一组件语汇。  
方向：**接入 Shoelace 2.20.1**（Web Components，兼容 vanilla + R5，本地 vendor，无 CDN）。

| 触点 | 内容 |
|------|------|
| 依赖 | `@shoelace-style/shoelace@2.20.1` + `renderer/vendor/shoelace` + `renderer/vendor/esm`（lit 等 bare 依赖） |
| 引导 | `ds/shoelace-boot.js`（`setBasePath` + 关键组件 eager；失败不挡壳层） |
| importmap | `index.html` 内联 importmap → 解析 `lit/*`（file:// 无 node_modules） |
| 同步 | `pnpm --filter @hfq/desktop sync:shoelace` → `scripts/sync-shoelace-vendor.mjs` |
| 主题桥 | `ds/theme.css`：`--sl-*` ↔ `--bg-*` / soft `--primary` / cyan ≤ focus |
| 壳层 | `ds/shell.css` + 垂直 `.nav-item` rail（**禁止** `sl-menu` 当侧栏） |
| 主题 | `applyTheme` 同步 `.sl-theme-dark` / `.sl-theme-light` |
| CSP | `script-src 'self' 'unsafe-inline'`（importmap）；`connect-src 'self' data:`（SL 图标）；`img-src`/`font-src` data |

**R8.1～R8.3 截图纠偏：**
- **R8.1 错用** `sl-menu` 作侧栏 → 标签坍成一行；改为 `button.nav-item` + `sl-icon` + 分组排序
- **R8.2** 去掉 debug 品牌 tag / 过响顶栏 `sl-tag`；顶栏状态仍用 `.pill`
- **R8.3** 首页：一主 CTA、`status-strip` 扁平行、列表去嵌套卡/徽章堆；主色改为 soft zinc（非纯白）

**组件落地（合适角色才用库）：**
- 侧栏：自定义 vertical rail + `sl-icon`；底部 `sl-button` 打开工作区
- 权限：`sl-dialog` + badge/button
- 技能页签：`sl-button-group` + `sl-button`
- 首页主操作：原生 `.btn`（层次可控，避免白 CTA 刷屏）

**不做：** 整站 React；业务页全量一次换完；D-hybrid 多栏仍等选型。

---

## Non-goals（近期不做）

- 完整设计体系包对外发布  
- 手机端 / 纯网页 SaaS 壳  
- 主题市场  
- 未完成 R1 就全量上 React（R5 已明确拒绝整站重写）  

---

## Related

- 主计划 Track C：[ROADMAP.md](./ROADMAP.md)  
- 中文总览：[项目规划书.md](./项目规划书.md)  
- 产品页：[PRODUCT.md](./PRODUCT.md)  
- 第三阶段状态：[PHASE3-STATUS.md](./PHASE3-STATUS.md)  
