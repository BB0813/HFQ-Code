# 1.1 · 真交互终端（PTY）技术预研

Status: **T1 backend landed** (IPC + `@hfq/pty`; UI/xterm still frontend track)  
Date: 2026-07-15  
Depends: workspace bound · path sandbox · frontend wires xterm separately

## 现状（1.0.9）

| 能力 | 状态 |
|------|------|
| Agent `shell` 工具 | 有：一次性 spawn，stdout/stderr 回灌会话 |
| UI「终端」页 | 有：`runShell` IPC，非交互，历史块列表 |
| 真 PTY / ConPTY | **T1 backend** — `node-pty` when available, else `spawn-pipe` |
| 与会话绑定的交互式 shell | **IPC ready**; xterm UI not in this track |

相关代码：

- Renderer：`apps/desktop/renderer/app.js` → `pageTerminal` / `runTerminalCommand`
- Preload：`runShell` → `shell:run`
- Agent tools：`packages/tools` builtin `shell`
- 会话快照：`uiTerminal` in agent-core loop

## 产品目标（1.1 Done 时）

1. **人用交互终端**：在绑定工作区下打开 ConPTY/PTY，可跑 `git`、`pnpm`、交互式 REPL（基础）  
2. **与会话解耦又可关联**：终端页可独立用；Agent shell 输出仍进会话轨迹  
3. **权限**：危险命令策略与现网 access mode 一致；全访问 YOLO 仍警告  
4. **Windows 优先**：ConPTY；不承诺 macOS/Linux 同期  
5. **路径沙箱**：cwd 默认 workspace root；拒绝 workspace 外逃逸（与 tools 一致）

## 非目标（1.1）

- 完整 VS Code 任务系统 / 调试适配器  
- 多远程 SSH 主机  
- 把 Agent 循环整段放进 PTY 里「裸聊」  
- 未选型布局前的整站 UI 重做  

## 推荐架构

```text
Renderer (xterm.js)
    │ IPC: pty:create | pty:write | pty:resize | pty:kill | events pty:data/exit
    ▼
Electron main
    │ node-pty (ConPTY on Windows)
    │ cwd = workspaceRoot, env sanitized
    ▼
Shell process (powershell / pwsh / cmd — user pref)
```

### 模块边界

| 层 | 职责 |
|----|------|
| `packages/pty`（新建，可选） | 封装 node-pty 生命周期、编码、会话表 |
| `apps/desktop/electron` | IPC 白名单、窗口生命周期、杀进程 |
| `renderer` Terminal page / 底栏 | xterm 适配、fit addon、重连提示 |
| `agent-core` | **不**直接持 PTY；shell 工具可继续 one-shot，或后续「把命令写入共享 PTY」二期 |

### IPC 草图

```ts
// invoke
pty:create { sessionId?, cwd, shell?, cols, rows } → { id, … }
// shell omit → prefs.terminalShell → auto resolve
pty:write  { id, data }
pty:resize { id, cols, rows }
pty:kill   { id }
pty:list   → PtySessionInfo[]
pty:shells → { shells: AvailableShell[], preferred }

// events → renderer
pty:data { id, data }
pty:exit { id, exitCode, signal }
```

Canonical frontend pack: [FRONTEND-IPC.md](./FRONTEND-IPC.md).

### 依赖

- `node-pty`（注意 Electron ABI / Windows build tools）  
- `xterm` + `xterm-addon-fit`（renderer，可走 bundler 或拷贝 vendor）  
- 打包：electron-builder 需带上 node-pty 原生模块  

## 权限与安全

1. `pty:create` 仅当 `workspacePath` 已绑定且路径通过 normalize  
2. 默认 shell 白名单：`powershell.exe` / `pwsh.exe` / `cmd.exe`  
3. 环境变量：剥离敏感注入；继承最小集合  
4. 与 `full_access`：PTY 本身是用户交互面，**不**等于 Agent 自动 YOLO；Agent 写 PTY 若做二期需单独开关  
5. 窗口关闭 / 工作区切换：kill 所有 pty  

## 落地切片

| 切片 | 内容 | 估计 |
|------|------|------|
| **T0** | 本文档 + 终端页 HTML 外置 `pages/terminal-page.js` | ✅ |
| **T1** | `@hfq/pty` + main/preload IPC + unit smoke | ✅ backend |
| **T2** | renderer xterm 接入 Terminal 页（**frontend agent**） | 待前端 |
| **T3** | 按布局方案挂底栏(B) / 右侧(A) / 浮层(C) | 随 UI 选型 |
| **T4** | 历史 one-shot `runShell` 保留为「命令块」模式或降级 | 小 |

## 风险

| 风险 | 缓解 |
|------|------|
| node-pty 编译失败 | CI 文档；预编译；失败时保留 one-shot |
| 性能 / 卡 UI | data 事件节流；worker 可选 |
| 安全（任意 shell） | cwd 沙箱 + 明确用户手操面 + 审计可选记录 |

## 验收

- [x] `@hfq/pty` create/write/resize/kill + path sandbox + env scrub  
- [x] IPC: `pty:create|write|resize|kill|list` + events `pty:data|exit`  
- [x] 切换工作区 / before-quit → killAll  
- [x] one-shot `shell:run` 保留  
- [ ] 前端 xterm 接入（另一 Agent）→ 验收 echo/dir  
- [x] `pack-verify` 断言 `@hfq/pty` 进包；`node-pty` 原生有则 OK、无则 WARN（spawn-pipe 降级）  

## 与布局方案

见 [LAYOUT-PROPOSALS.md](./LAYOUT-PROPOSALS.md)。**PTY 核心 IPC 与布局无关**；仅 chrome 挂载点不同。


## Frontend contract (for UI agent)

Preload (`window.hfq`):

```js
await hfq.ptyCreate({ cols, rows, shell?, cwd?, label? }) // → { id, backend, cwd, shell, ... }
await hfq.ptyWrite({ id, data })
await hfq.ptyResize({ id, cols, rows })
await hfq.ptyKill({ id })
await hfq.ptyList()
const offData = hfq.onPtyData(({ id, data }) => { ... })
const offExit = hfq.onPtyExit(({ id, exitCode, signal }) => { ... })
```

Notes:

- Requires bound workspace (uses main `workspacePath` if payload omits it).
- `backend` is `node-pty` or `spawn-pipe` (degraded; still streams).
- Do **not** put secrets in PTY label; env is scrubbed of common key patterns.
- Keep existing `runShell` for one-shot command blocks.
