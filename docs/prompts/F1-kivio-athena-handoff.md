# HFQ Code · Track F1 收口 + 前后端联调（整包 Prompt · 不拆分）

> **用法**：把本文件**原样整份**发给前端 Agent 或后端 Agent（同一份，不拆）。  
> 角色：你是实现 Agent；统筹已完成 F1 主链路；你只做**缺口收口、联调、验收**，禁止重做已落地能力、禁止扩 scope 到 F2。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`（HFQ Code monorepo）  
> 产品：Windows 桌面**编程智能体**（Electron + TS），**不是** IM 网关 / 通用生产力壳。  
> 基线：1.1.4 · 采纳方案见 `docs/ADOPT-KIVIO-ATHENA.md`、`docs/DECISIONS.md` Q8、`docs/ROADMAP.md` Track F1。  
> 硬约束：不提交密钥；workspace path-escape 不放宽；不改 Layout A 默认；不引入 Kivio/Athena 凭证。  
> 落盘：`docs/prompts/F1-kivio-athena-handoff.md`（以本文件为准）

---

## 0. 你的任务一句话

**把 F1「Kivio/Athena 能力模式」前后端接缝补齐到可演示、可验收**，已有后端/配置/主链路不要推倒重写；只修缺口、补 UI 消费、补类型、补测试与文档勾选。

---

## 1. 已落地（禁止重复实现 / 不要大改 API 形状）

### 1.1 配置（`@hfq/config`）
- `prefs.codingProfiles[]`、`activeCodingProfileId`
- `prefs.modelRoles.title | compression`：`{ providerId?, model? }`
- `prefs.skillMatch`：`{ enabled, maxBodies, maxBodyChars }` 默认 `{ true, 2, 6000 }`
- 内置 profiles：`defaultCodingProfiles()`（Refactor / Debug / Review / Docs / Frontend / Research）
- 空 profiles 启动 seed；`withPrefs` 已 merge 新字段

### 1.2 Skills
- `packages/skills/src/match.ts`：`matchSkills` / `formatMatchedSkillBodies`
- `skills/bundled/diagram/SKILL.md`（mermaid-first）

### 1.3 Agent-core / shared / memory / tools
- `packages/shared/src/events.ts` → `task.updated` 可选：
  - `kind?: "goal"|"tool"|"subagent"`
  - `objective?: string`
  - `progress?: number`（0–100）
  - `budget?: { maxRounds?, maxToolCalls? }`
  - `parentTaskId?: string`
  - `blockedReason?: string`
  - `acceptance?: string`
- `packages/agent-core/src/history.ts` → `UiTask` 含同上字段；`SessionSnapshot.tasks`
- `packages/agent-core/src/context.ts` → `profileAddon` + `matchedSkillsBlock` + mermaid 指引
- `packages/agent-core/src/loop.ts` → skillMatch 注入、`/goal` 发 goal 字段、titleModelRole 可走廉价模型
- `manager` / `worker/protocol` / `worker/entry` → create/open 透传 `codingProfileAddon` / `codingProfileSkillIds` / `skillMatch` / `titleModelRole` / `compressionModelRole`
- Memory：`links[]` + tags 加权；`memory_save` 支持 `tags`/`links`

### 1.4 Desktop 主进程（`apps/desktop/electron/main.cjs`）
- `sessionPrefs()` 解析 active coding profile → addon/skillIds/`permissionModeFromProfile`；解析 modelRoles → providerSpec
- `session:create` / `session:open` 已传 profile + skillMatch + title/compression roles
- `config:setPrefs` 已接受 `activeCodingProfileId` / `codingProfiles` / `modelRoles` / `skillMatch`

### 1.5 Desktop 渲染（部分）
- `features/chat/MarkdownMessage.tsx` + Chat 里 agent / streaming 已用 MarkdownMessage（mermaid + fence）
- `SettingsPage` 已有：Coding Profile chips、skillMatch 开关、title/compression model 输入

### 1.6 明确未做 / 后置（F2，本轮禁止开工）
- Goal 树 sidecar 持久化、Memory FTS5、pdf/docx/xlsx skills、可配置停靠面板、compression 专用 summarizer 路径

---

## 2. 本轮必须完成的缺口（前后端一体验收）

### A. 前端 · Tasks 消费 Goal Driver 字段（P0）

**现状**：`TasksPanel` 几乎只做 subagent 子会话 / spawn attempts，**没有**展示会话内 `UiTask` 的 goal 字段。  
**后端已发**：`/goal …` → `task.updated` 带 `kind:"goal"`、`objective`、`progress`、`budget`、`blockedReason`；snapshot.tasks 也有。

**要求**：
1. 在 `apps/desktop/renderer/src/lib/hfq.ts` 定义正式类型（不要长期 `tasks?: unknown[]`）：

```ts
export interface UiTask {
  taskId: string
  title: string
  status: "pending" | "in_progress" | "completed" | "cancelled" | "failed"
  detail?: string
  kind?: "goal" | "tool" | "subagent"
  objective?: string
  progress?: number // 0-100
  budget?: { maxRounds?: number; maxToolCalls?: number }
  parentTaskId?: string
  blockedReason?: string
  acceptance?: string
  updatedAt?: string
  [key: string]: unknown
}
```

`SessionSnapshot.tasks?: UiTask[]`

2. `app-store`：
   - open/snapshot 时归一化并保存 `tasks: UiTask[]`（按 session 或 active session 一份即可，匹配现有 store 风格）
   - 监听 `task.updated`：upsert by `taskId`（同 history 语义）；忽略未知字段
   - session 切换 / open 时用 snapshot 覆盖，避免脏状态

3. `TasksPanel`（drawer + `/tasks` 共用）：
   - 新增区块 **「本会话任务 / Goals」**（可放在 subagent 列表上方）
   - 优先展示 `kind==="goal"`；若无 kind 但 title 以 `goal:` 开头也当作 goal
   - 每条展示：`title`、`status` badge、`progress`（有则进度条或 `xx%`）、`objective` 摘要（可折叠）、`blockedReason`（failed/cancelled 时醒目）、`budget` 一行小字
   - 空态：`暂无目标任务，可在 Chat 输入 /goal …`
   - **不要**做成 Athena 完整 Goal OS；轻量列表即可
   - 保持现有 subagent 子会话 UI 不回归

4. Chat（轻量，P1 但建议同轮）：
   - 若 active session 存在 `status==="in_progress"` 且 `kind==="goal"` 的 task，在消息列表上方或 composer 附近显示一条 **Goal banner**（objective 截断 + progress + blockedReason）
   - 停止/完成后 banner 消失或变完成态（跟随 store tasks）

### B. 前端 · Settings / 状态可见性（P0）

1. Coding Profile：
   - 保存后 toast 已有；补文案：**「新会话生效」**（create 新会话才吃 active profile；不要暗示当前 running session 热切换）
   - 若列表为空（异常），显示「将使用内置默认档案」并引导重启/重载 config（seed 在 store load）

2. Model roles：
   - title / compression 输入框旁注明：空 = 跟随当前主模型；仅 model id 时用 `activeProviderId`（与 main `sessionPrefs.resolveRole` 一致）
   - compression：**标明「预留，当前版本仅保存配置」**，不要假装已生效 summarizer

3. skillMatch：
   - 开关保存 `prefs.skillMatch.enabled`；高级数字（maxBodies/maxBodyChars）可不做 UI，保持默认即可

4. 可选 P1：Chat 顶栏或 composer 旁 chip 显示 **当前 active coding profile 名**（只读，点进 Settings）

### C. 前端 · Memory links 展示（P1）

- `MemoryPage` / memory 列表若已有条目 UI：展示 `tags` + `links`（chip 或小字）
- 无编辑器大改；只读展示即可
- 类型与 IPC 返回字段对齐 `packages/memory`（`links?: string[]`）

### D. 前端 · Mermaid 稳健性（P0 回归）

- `MarkdownMessage`：mermaid 失败时 fallback 为代码块，**禁止**白屏/整条消息崩溃
- 仅渲染 agent / streaming agent；user / tool 保持 plain（或现有策略）
- 安全：仅 mermaid SVG，**禁止** `dangerouslySetInnerHTML` 整页 HTML、禁止执行模型输出脚本
- 确认 `apps/desktop/package.json` 含 `"mermaid": "11"`；renderer typecheck 通过

### E. 后端 / 主进程 · 接缝核对与补丁（P0）

> **状态（2026-07-19 · 后端 Agent）**：E1–E8 **已收口**，`pnpm test` **179 passed**。前端 Agent **不要重做**下列项，只消费契约。

1. **create vs open** — ✅  
   - 均经 `sessionPrefs()` 注入 addon / skillIds / skillMatch / title+compression roles  
   - open 权限解析与 create 对齐：`payload.permissionMode` > **合法** `profile.permissionMode` > prefs  
   - 非法 / 未配置 profile 模式不会静默升到 `full_access`

2. **Profile permissionMode** — ✅  
   - `sessionPrefs` 仅在四枚举内赋值 `permissionModeFromProfile`

3. **titleModelRole** — ✅  
   - `loop` 用 `String(res?.message ?? "")`；失败回退截断标题

4. **compressionModelRole** — ✅ 透传 + prefs 持久化；**不**改 compact 算法（F1 约定）

5. **skill progressive match** — ✅ agent-core + skills 测试锁住

6. **`/goal` 事件** — ✅  
   - in_progress / completed / cancel / fail 带 `kind|objective|progress|budget|blockedReason`  
   - `buildSessionSnapshot` / `getSnapshot` 重建 `tasks` 字段（session + history 测试）

7. **Memory links** — ✅ `packages/memory` 测试绿

8. **Worker 路径** — ✅ entry create/open 与 local 同参；worker 测试不回归

### F. 类型与 IPC 文档（P1）

- ✅ `docs/FRONTEND-IPC.md` 已补 F1 prefs / `task.updated` / snapshot.tasks 一小节  
- ✅ `docs/ADOPT-KIVIO-ATHENA.md` Acceptance 已勾 integration test

---

## 3. 数据契约（实现时必须对齐，勿另起炉灶）

### 3.1 prefs（getConfig / setPrefs）

```ts
prefs.codingProfiles: Array<{
  id: string
  name: string
  description?: string
  icon?: string
  systemAddon?: string
  skillIds?: string[]
  permissionMode?: "confirm_before_change"|"auto_edit"|"plan"|"full_access"
  providerId?: string
  model?: string
  builtIn?: boolean
  enabled?: boolean
}>
prefs.activeCodingProfileId: string  // "" = none
prefs.modelRoles: {
  title?: { providerId?: string; model?: string } | null
  compression?: { providerId?: string; model?: string } | null
}
prefs.skillMatch: {
  enabled?: boolean      // default true
  maxBodies?: number     // default 2
  maxBodyChars?: number  // default 6000
}
```

### 3.2 session create/open 内部参数（主进程 → agent-core / worker）

```ts
{
  codingProfileAddon?: string
  codingProfileSkillIds?: string[]
  skillMatch?: { enabled?: boolean; maxBodies?: number; maxBodyChars?: number }
  titleModelRole?: { provider: Provider|WorkerProviderSpec; model: string }
  compressionModelRole?: { provider: Provider|WorkerProviderSpec; model: string }
  // 既有: model, provider, planMode, permissionMode, memoryEnabled, compactMaxChars, workspacePath...
}
```

### 3.3 task.updated（广播 + snapshot.tasks）

见 §1.3；前端必须容错缺字段。

### 3.4 Chat mermaid

模型输出：

````md
```mermaid
flowchart TD
  A-->B
```
````

UI 渲染为图；失败则代码块。

---

## 4. 关键改动文件地图（按需，勿无关大重构）

| 区域 | 路径 |
|------|------|
| 类型 / IPC 客户端 | `apps/desktop/renderer/src/lib/hfq.ts` |
| Store | `apps/desktop/renderer/src/store/app-store.ts` |
| Tasks UI | `apps/desktop/renderer/src/features/tasks/TasksPanel.tsx` |
| Chat | `apps/desktop/renderer/src/features/chat/ChatView.tsx`, `MarkdownMessage.tsx` |
| Settings | `apps/desktop/renderer/src/pages/SettingsPage.tsx` |
| Memory UI | `apps/desktop/renderer/src/pages/MemoryPage.tsx` |
| 主进程 prefs/session | `apps/desktop/electron/main.cjs` |
| 事件 / history / loop | `packages/shared`, `packages/agent-core/src/{history,loop,manager,worker/*}.ts` |
| Config | `packages/config/src/{schema,store}.ts` |
| Skills match | `packages/skills/src/match.ts` |
| Memory / tools | `packages/memory`, `packages/tools/src/builtin.ts` |
| 文档 | `docs/ADOPT-KIVIO-ATHENA.md` acceptance、`docs/FRONTEND-IPC.md` 可选 |

---

## 5. 实现原则

1. **匹配周边代码**：TS ESM、小模块、现有 Zustand/shadcn 风格；注释密度与邻文件一致。  
2. **加法优先**：字段 optional；旧 session / 旧 config 不炸。  
3. **安全**：mermaid 客户端 SVG only；profile 不默认 YOLO；无密钥入库。  
4. **不要**：引入新 UI 框架、改 Layout A 默认、做 F2、复制 Kivio/Athena 安装目录配置、提交 `.env` / API key。  
5. **Worker + local 双路径**改 session 参数时必须两边一致。  
6. 改共享类型后按仓库习惯 rebuild 依赖包（`pnpm --filter @hfq/shared build` 等），避免 dist 陈旧导致 tsc 假红。

---

## 6. 验收清单（做完必须自证）

### 功能
- [ ] Settings 可选 Coding Profile → **新建会话**后 system 含 profile addon（可通过日志/行为或单测证明）
- [ ] skillMatch 开：相关用户话术注入 top-K skill body；关：不注入 body
- [ ] `/goal 修复登录超时` → Tasks 出现 goal 行：in_progress → completed/failed，含 objective/progress/blockedReason
- [ ] snapshot 冷开同一 session，goal 任务字段仍在
- [ ] Chat agent 消息 mermaid fence 出图；非法 mermaid 降级代码块
- [ ] memory_save 带 links 后 search/prompt/UI 可见
- [ ] title model 配置非法/缺失时不阻断主对话
- [ ] compression 配置可保存（允许本版不驱动 compact）

### 质量
- [ ] 触及包：`pnpm --filter <pkg> test` 或等价 vitest 绿  
- [ ] `apps/desktop` renderer typecheck 绿  
- [ ] agent-core build 绿（含 worker）  
- [ ] 不引入密钥；`git status` 无 credentials  
- [ ] 更新 `docs/ADOPT-KIVIO-ATHENA.md` Acceptance 勾选（若集成测已跑可将 `pnpm test` 项勾上）

### 建议命令（按环境）
```bash
pnpm --filter @hfq/shared build
pnpm --filter @hfq/skills build
pnpm --filter @hfq/config build
pnpm --filter @hfq/memory build
pnpm --filter @hfq/tools build
pnpm --filter @hfq/agent-core build
# 聚焦测试
pnpm --filter @hfq/skills test
pnpm --filter @hfq/memory test
pnpm --filter @hfq/config test
pnpm --filter @hfq/agent-core test
# desktop
pnpm --filter hfq-desktop exec tsc -p apps/desktop/renderer --noEmit
# 或仓库既有 typecheck script
```

---

## 7. 交付说明（Agent 完成后回复格式）

请用中文简报，固定结构：

1. **改了什么**（FE / BE 分两列表，文件级）  
2. **未改什么**（明确 F2 未动）  
3. **如何手动验证**（3–6 步点击/命令路径）  
4. **测试结果**（贴关键命令输出摘要；失败如实报）  
5. **残留风险**（若有）

---

## 8. 非目标（再次强调）

- 不做 Goal 树 DB / FTS5 / pdf-docx skill / dock 面板 prefs  
- 不做 Kivio 全量 assistant 矩阵、Athena 自由停靠壳  
- 不做 HTML live preview sandbox  
- 不把 HFQ 做成 IM 或通用 Agent OS  

---

## 9. 给执行 Agent 的开工顺序（建议）

1. 读 `docs/ADOPT-KIVIO-ATHENA.md` + 本 Prompt §1–3  
2. 核对 main.cjs create/open/setPrefs 与 agent-core 透传是否完整 → 只补缺口  
3. 前端类型 + app-store `task.updated` + TasksPanel goal 列表  
4. Chat goal banner（若时间紧可 P1 但优先做）  
5. Settings 文案 / Memory links 只读  
6. Mermaid 失败降级回归  
7. 跑测试 + 勾 acceptance  

**开始实现。不要只写方案；直接改代码并验证。**

---

## Changelog

### 2026-07-19 · 后端收口

| 项 | 说明 |
|----|------|
| open permissionMode | 与 create 一致：payload > 合法 profile > prefs |
| profile 模式校验 | 仅四枚举写入 `permissionModeFromProfile` |
| goal 测试 | session `/goal` 断言 kind/objective/progress/budget + snapshot.tasks；history 重建 failed+blockedReason |
| 文档 | `FRONTEND-IPC.md` F1 表；`ADOPT-KIVIO-ATHENA.md` acceptance 勾选 |
| 测试 | 全仓 `pnpm test` **179 passed** |

**前端 Agent 本轮仍须完成**：§2 A/B/C/D（Tasks goal 列表、Settings 文案、Memory links 只读、Mermaid 降级）。后端 §2 E/F 勿重做。
