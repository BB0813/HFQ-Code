# 1.1 · 子代理可观测性（B3 backend）

Status: **B3 backend landed**  
Date: 2026-07-15  
UI tree polish: frontend agent

## 已有能力（此前）

| API | 说明 |
|-----|------|
| `hfq.listChildSessions({ sessionId })` | 父会话下存活子会话 `SessionInfo[]` |
| `hfq.spawnSubagent({ sessionId, goal, profile })` | 手动 / explore 按钮派生 |
| Agent 工具 `spawn_subagent` | 循环内派生，结果回写 parent tool output |
| Tasks 页 | 已渲染 `state.childSessions` +「打开」 |

## 本轮补齐（后端）

### 1. 子会话元数据（`SessionInfo` 扩展）

可选字段（旧会话/快照兼容）：

- `model` / `providerId`（与根会话相同；list/open 侧栏依赖）
- `parentSessionId`
- `subagentProfile`: `explore` \| `edit` \| `shell`
- `subagentDepth`
- `goal`

创建子会话时写入；`session.meta` 事件持久化（含 `providerId`），重放 `buildSessionSnapshot` 可恢复。

### 2. 事件 `subagent.updated`

挂在**父会话**事件流（`session:event` / manager `onEvent`）：

```ts
{
  type: "subagent.updated",
  sessionId: parentId,       // 与 parentSessionId 相同，便于现有按 session 过滤
  parentSessionId: string,
  childSessionId?: string,   // 失败且未创建时可能缺省
  profile: "explore" | "edit" | "shell",
  goal: string,
  status: "started" | "completed" | "failed",
  error?: string,
  errorCode?: string,        // depth | goal_required | create_failed | run_failed
  at: string,
}
```

### 3. 失败原因可查询

- `spawnSubagent` 返回：`{ ok, childSessionId, summary, error?, errorCode? }`
- `listSpawnAttempts(parentSessionId)`：最近尝试列表（含失败、无 child 的情况）

### Preload 契约

```js
await hfq.listChildSessions({ sessionId })
// → SessionInfo[] 含 parentSessionId / subagentProfile / goal / status

await hfq.listSpawnAttempts({ sessionId })
// → [{ attemptId, parentSessionId, childSessionId?, profile, goal, status, error?, errorCode?, at, updatedAt }]

await hfq.spawnSubagent({ sessionId, goal, profile? })
// → { ok, childSessionId, summary, error?, errorCode? }

// 事件
// onSessionEvent: type === "subagent.updated" → 刷新树 / 失败条
```

## 前端建议（B3-1 / B3-2 / B3-3）

1. **B3-1 树**：goal 任务 → 子代理节点（profile + goal + status）→ 工具步骤  
2. **B3-2 打开子会话**：现有 `openRecentSession(childId)`；可记住 parent 以便返回（本地 state，无需新 IPC）  
3. **B3-3 失败原因**：监听 `subagent.updated` failed，或打开 Tasks 时 `listSpawnAttempts`，展示 `error` / `errorCode` 中文映射  

## 持久化语义（1.1.1）

| API | 冷启动行为 |
|-----|------------|
| `listChildSessions` / `listChildren` | 内存 parent→children map **+** 扫 sessions JSONL（`SessionInfo.parentSessionId`）合并去重；字段含 parent/goal/profile/depth/model/providerId |
| `listSpawnAttempts` | 内存优先；未加载时读 `%data%/sessions/<parentId>.spawn-attempts.json`（最近 50 条；含失败无 child） |
| 子会话 transcript | 仍由 JSONL 承担；open 时从 meta 恢复 parent/goal/profile/depth 并回填 children map |

损坏的 attempts 文件 → 返回 `[]`，不拖垮 list。

## 非目标

- 无限嵌套；硬上限 depth 2  
- attempts 跨机器同步 / 云端  

## 测试

- `packages/agent-core/tests/session.test.ts` — spawn + listChildren + depth fail + **cold-start** children/attempts  
- `packages/shared/src/events.test.ts` — schema  

