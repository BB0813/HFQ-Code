# F1 联调审计（统筹 · 2026-07-19）

> 状态：**F1 可演示收口**。前后端主链路已对齐；统筹已直接修 3 处 FE 接缝。  
> **无需再发**新的 FE/BE 整包实现 Prompt（除非你要做下面「可选 polish」）。  
> 原交接单：[`F1-kivio-athena-handoff.md`](./F1-kivio-athena-handoff.md)

---

## 1. 验收对照（handoff §6）

| 项 | 结果 |
|----|------|
| Coding Profile → **新会话**注入 system addon / skillIds | ✅ main `sessionPrefs` + create/open 透传 agent-core/worker |
| skillMatch 开关 + top-K body 注入 | ✅ config + loop + Settings |
| `/goal` → Tasks goal 行（objective/progress/blockedReason） | ✅ loop 发事件；FE TasksPanel + store |
| snapshot 冷开 goal 字段仍在 | ✅ history rebuild + open 注入 prefs；FE 从 snapshot 覆盖 tasks |
| mermaid fence 出图 / 失败降级 | ✅ MarkdownMessage + `securityLevel: "strict"` |
| memory links 工具 + UI | ✅ memory/tools + MemoryPage tags/links |
| title model 失败不阻断 | ✅ `String(res?.message ?? "")` + heuristic fallback |
| compression 仅保存 | ✅ 透传 reserved；Settings 已标明预留 |
| create/open permissionMode 一致 | ✅ payload > profile > prefs |
| 聚焦测试 | ✅ 6 files / **49 passed** |
| desktop typecheck | ✅ |

---

## 2. 统筹本轮直接修补（无需再转发）

| 问题 | 修复 |
|------|------|
| **会话切换 tasks 串台** | `selectSession` 先 `tasks: []`；snapshot **始终** `tasks: snapTasks`（空数组也覆盖，禁止保留旧会话） |
| **task.updated 默认 kind=goal** | 去掉默认 `"goal"`，缺省 `kind` 不污染 Goals 列表 |
| **SessionSnapshot.tasks 仍为 unknown[]** | 改为 `UiTask[]`；snapshot 归一化 taskId/title/progress |
| Settings 文案 | 保存 toast 提示 Profile「新会话生效」；compression 标明仅持久化 |
| Tasks 空态 | 始终显示「目标任务」区 + `/goal …` 引导 |

文件：
- `apps/desktop/renderer/src/store/app-store.ts`
- `apps/desktop/renderer/src/lib/hfq.ts`
- `apps/desktop/renderer/src/pages/SettingsPage.tsx`
- `apps/desktop/renderer/src/features/tasks/TasksPanel.tsx`

---

## 3. 前后端接缝结论

### 后端 / 主进程
- `sessionPrefs`：profile addon/skillIds、skillMatch、title/compression、permissionModeFromProfile
- `session:create` / `session:open`：双路径（worker + local）均注入 F1 参数
- open 的 permissionMode 与 create 对齐
- worker protocol/entry 含 codingProfile / skillMatch / model roles
- `/goal` 事件字段完整；history → snapshot.tasks

### 前端
- `UiTask` 类型、store tasks、`task.updated` upsert、Tasks 目标区、Chat goal banner
- MarkdownMessage mermaid、Settings profiles/roles/skillMatch、Memory links 只读
- FRONTEND-IPC F1 小节已有

### 文档
- `docs/ADOPT-KIVIO-ATHENA.md` Acceptance 已勾 F1
- `docs/prompts/F1-kivio-athena-handoff.md` 仍作历史交接源

---

## 4. 不在本轮 / F2（明确未做）

- Goal 树 sidecar 持久化、Memory FTS5、pdf/docx/xlsx skills
- 可配置 dock 面板、compression 真正驱动 compact
- Chat 顶栏 active Coding Profile chip（原 handoff 可选 P1）

---

## 5. 可选 polish（若你要再开一轮 FE）

仅当产品要「再磨一刀」时，再开新文件 `docs/prompts/F1-ui-polish.md`，建议范围：

1. Chat 顶栏/composer **只读 chip**：当前 `activeCodingProfileId` 名称（点进 Settings）  
2. Goal banner 优先显示 `objective` 截断（现在偏 `title`）  
3. Settings 档案列表为空时的 seed 失败提示（异常路径）  

**当前不强制**；无阻塞联调项。

---

## 6. 手动冒烟（建议你本机点一遍）

1. 设置 → 选 Coding Profile（如 Debug）→ 保存 → **新建会话** → 发「画架构图」类话术（skillMatch 开）  
2. Chat：`/goal 修复登录超时` → 开 Tasks / 抽屉 → 见目标任务 in_progress → 完成后 progress/状态更新  
3. 切换到另一会话 → 目标列表应清空或只显示该会话 snapshot（**不串台**）  
4. Agent 回 mermaid fence → 出图；故意坏语法 → 代码块降级  
5. Memory 页：有 tags/links 的条目可看见 chip  

---

## 7. 命令摘要（统筹已跑）

```text
pnpm --filter @hfq/{shared,skills,config,memory,agent-core} build  → OK
pnpm exec vitest run packages/skills/src/match.test.ts \
  packages/memory/src/index.test.ts packages/config/src/store.test.ts \
  packages/shared/src/events.test.ts packages/agent-core/tests/history.test.ts \
  packages/agent-core/tests/session.test.ts
  → 6 files / 49 passed
pnpm --filter @hfq/desktop run typecheck → OK
```

---

## 8. 给用户的结论

- **F1 联调通过**；前后端不需要再各发一份大实现 Prompt。  
- 若只做 §5 可选 polish，再说一声，统筹再落盘 `F1-ui-polish.md`。  
- 下一列车默认进 **F2**（goal tree / FTS / doc skills），另开 `docs/prompts/F2-….md`。
