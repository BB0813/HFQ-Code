# 测试任务 · HFQ Code **1.1.8 L3 发布门槛**（Test Agent 整包 Prompt）

> **用法**：把本文件**原样整份**发给 **测试 Agent**。  
> **你是测试 / QA Agent**，不是实现 Agent、不是发版 Agent。  
> - **做**：跑自动化测试、手工/半自动冒烟、记录证据、给 **GO / NO-GO** 发版结论。  
> - **不做**：改产品功能代码、抬版本、打 tag、GitHub Release、扩大 scope 到 Memory/Goal OS。  
> - **可做最小修复**：仅当「测试脚本本身坏了 / 路径写错 / 文档勾选与事实不符」；功能缺陷只记 bug，**回传用户/统筹**，不要自行大改 L3。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面编程智能体（Electron + TS）— **不是** IM 网关。  
> 基线：**1.1.7 shipped**（`v1.1.7`）。工作区应含 **未发布的 1.1.8 L3 实现**（以 `git status` 为准）。  
> 契约：[`docs/UPDATE-L1-L3.md`](../UPDATE-L1-L3.md) §6.3 · [`docs/prompts/1.1.8-l3-handoff.md`](./1.1.8-l3-handoff.md) · [`docs/FRONTEND-IPC.md`](../FRONTEND-IPC.md) Updates 节 · DECISIONS **Q9**。  
> 落盘：本文件 `docs/prompts/test-1.1.8-l3-gate.md`  
> 硬约束：不提交密钥；不把真实 API key 写进报告；测试账号/本机路径可写「已脱敏」。

---

## 0. 一句话任务

验证 **1.1.8 L3 是否达到可发版门槛**：单元/门禁绿 + **至少一条真实（或等价）NSIS 静默升级故事** + L1/L2 回归 + 安全边界；输出 **GO / NO-GO** 与缺陷列表。

**产品钉死**：没有 L3 真包（或书面等价）证据，**不得**给 GO。

---

## 1. 测试前环境确认

在仓库根目录执行并记录输出摘要：

```bash
git status -sb
git log --oneline -5
git tag -l "v1.1.*" | sort -V | tail -5
# 期望：最高已发布 tag 含 v1.1.7；工作区有 L3 相关 M/?? 文件
```

**必须存在的实现信号**（缺则 NO-GO 并停，或标「实现未就绪」）：

| 信号 | 路径 / 符号 |
|------|-------------|
| pending + `/S` | `apps/desktop/electron/update-silent.cjs`、`packages/shared/src/update-silent.ts` |
| schedule | `main.cjs` → `scheduleSilentInstall` / `update:installSilent` |
| preload | `installUpdateSilent`、`getPendingInstall`、`onUpdateInstallScheduled` 等 |
| Settings | 「下载完成后自动安装更新」可开 + 二次确认 + ready 时「安装并重启」 |
| 版本 | 根与 `apps/desktop` 在测试时可能仍是 **1.1.7**（未发版正常）；**不要**因未抬版本判实现失败 |

**机器**：Windows x64；能跑 Electron / `pnpm`；**NSIS 安装版**路径优先（Portable 只做「拒绝 L3」负例）。

---

## 2. 自动化门禁（必须跑）

在仓库根：

```bash
# 2.1 L3 / updatePolicy 聚焦
pnpm --filter @hfq/shared build
pnpm --filter @hfq/config build
pnpm exec vitest run packages/shared/src/update-silent.test.ts packages/config/src/store.test.ts

# 2.2 桌面类型
pnpm --filter @hfq/desktop run typecheck

# 2.3 全量（发版级；若过慢可先 2.1+2.2，但最终 GO 建议全量绿）
pnpm release:check
# = build + test + smoke + eval
```

**判定**：

| 结果 | 动作 |
|------|------|
| 全绿 | 自动化门禁 PASS |
| 红 | 贴失败日志关键段；标 **NO-GO** 或 **GO 受阻**；区分「与 L3 无关的 flaky」并注明 |

把命令、退出码、失败摘要写入交付报告。

---

## 3. 功能验收矩阵

图例：`P` = Pass · `F` = Fail · `B` = Blocked（环境）· `N/A` = 不适用 · `S` = Skipped（写明原因）

### 3.1 L3 核心（发布门槛 · 权重最高）

| ID | 场景 | 步骤（摘要） | 期望 | 结果 |
|----|------|--------------|------|------|
| **L3-01** | silent 默认关 | 新配置 / 默认 prefs | `silentInstall !== true`；`installUpdate({mode:"silent"})` **拒绝** | |
| **L3-02** | 首次 opt-in | Settings 打开「下载完成后自动安装更新」 | **二次确认** UI；确认后 prefs 有 `silentInstall:true` 且 **`silentInstallAcceptedAt` 非空**（getConfig 或 status） | |
| **L3-03** | 取消 opt-in | 二次确认点取消 | 开关保持关；不写 silent | |
| **L3-04** | 关闭 silent | 打开后再关 | `silentInstall:false`；AcceptedAt 清空或无效 | |
| **L3-05** | CTA 文案 | ready + silent 开 | 主按钮 **「安装并重启」**（或等价）；仍可走 L2 向导 | |
| **L3-06** | schedule 路径 | ready 后点「安装并重启」 | 写 `%APPDATA%/HFQ-Code/updates/pending-install.json`；spawn 参数含 **`/S`**；应用 **quit**（允许 toast 后延迟） | |
| **L3-07** | **真包升级** | 见 §4 真包剧本 | 升级后 About/StatusBar 版本 **高于** 升级前；**无完整 NSIS 向导页**（UAC 可出现）；`%APPDATA%/HFQ-Code` 下 config/sessions **仍在** | |
| **L3-08** | boot 成功清 marker | 升级后冷启动 | `pending-install` 清除或 status success；可选 toast「已更新到 x」 | |
| **L3-09** | 失败保留 / L2 回退 | 模拟坏路径或取消 UAC / 删包后重试 | 不死循环；Settings 可 **打开安装向导**（`mode:"ui"` / openPath） | |
| **L3-10** | Portable 拒绝 | Portable 运行时开 silent 或 silent install | **拒绝** + 中文说明；L2 仍可用 | |
| **L3-11** | 下载中不可装 | downloading 时点安装 | 明确错误「正在下载…」类 | |
| **L3-12** | 路径沙箱 | 若可构造（勿破坏机器） | 安装路径必须在 `userData/updates` 下 `.exe`；越界拒绝 | |

**L3-07 未过 → 整体不得 GO。**

### 3.2 L1 / L2 回归（1.1.7 行为不能坏）

| ID | 场景 | 期望 | 结果 |
|----|------|------|------|
| **L1-01** | autoDownload 默认 false | 无自动下（除非用户打开） | |
| **L1-02** | 打开 autoDownload + 有新版本 | 后台下载 → status **ready** / 进度 | |
| **L2-01** | silent 关 + 安装更新 | **确认框** + `openPath` 向导路径 | |
| **L2-02** | 检查更新 / 取消下载 | 不崩；错误中文 | |

### 3.3 启动超时误报（工作区若含 App.tsx 修复则验）

| ID | 场景 | 期望 | 结果 |
|----|------|------|------|
| **BOOT-01** | 正常冷启动（有/无 workspace） | **不**长期贴「启动超时，部分状态可能未就绪」；偶发后应被清除 | |
| **BOOT-02** | 启动后 StatusBar 版本可读 | 与 package 一致（1.1.7 或本地 1.1.8 构建） | |

### 3.4 安全 / 产品边界（抽检）

| ID | 检查 | 期望 | 结果 |
|----|------|------|------|
| **SEC-01** | 报告与 diff | 无密钥、无 `.pfx` 误提交建议 | |
| **SEC-02** | silent 默认 | 永远 default off | |
| **SEC-03** | 文档一致 | UPDATE-L1-L3 / PACKAGING 写「opt-in L3」而非「禁止一切自动装」 | |

---

## 4. 真包剧本（L3-07 · 强制）

### 4.1 目标

证明：**已安装的旧构建** → 应用内 L3 → **更高版本 NSIS** 静默装上 → 数据还在。

### 4.2 推荐路径 A（双构建 · 最可信）

1. **构建「新」安装包**（工作区 L3 代码）：  
   ```bash
   pnpm --filter @hfq/shared build
   pnpm --filter @hfq/config build
   # 可选：临时把 apps/desktop package.json version 改为 1.1.8 仅用于包名/版本比较（测试后可还原，或交给发版 Agent）
   pnpm pack:win
   ```  
   产物一般在 `apps/desktop/release/HFQ Code-<ver>-x64.exe`（**NSIS，不要 portable**）。

2. **准备「旧」宿主**：  
   - 已安装的 **1.1.7** 正式包；或  
   - 同仓库再打一包 version=1.1.7 的 NSIS 装上。  

3. 在**旧宿主**中：  
   - 绑定任意测试 workspace（可选）  
   - 确认 `%APPDATA%/HFQ-Code/config.json` 存在（可记一份 hash/字段快照）  
   - Settings：开 **后台下载**（可选）+ **下载完成后自动安装**（二次确认）  
   - 将新包 **放入** `%APPDATA%/HFQ-Code/updates/` 并命名成可被 `resolveInstallerPath` / 版本解析识别的 `.exe`（或走正常 check+download，若 latest 已是新包）  
   - 状态 **ready** → **安装并重启**  
   - 观察：UAC（可允许）→ **无完整安装向导** → 应用退出 → 新版本启动  

4. **断言**：  
   - StatusBar / Settings 版本 **> 旧版本**  
   - `config.json` / sessions 仍在  
   - `updates/pending-install.json` 成功路径下被清掉  

### 4.3 路径 B（无双版本 · 弱等价 · 须声明）

若无法装两版，**最低限度**（只能拿 **CONDITIONAL GO**，不能标完整 GO）：

1. Dev/`electron .` 跑当前 main  
2. 手动把任意 **真实 NSIS 包** 放进 updates 目录  
3. 调 `installUpdate({ mode:"silent" })` 或 UI「安装并重启」  
4. 用 Process Monitor / 日志证明：  
   - 写出 `pending-install.json`  
   - 子进程命令行含 installer 路径与 **`/S`**  
   - `app.quit` 触发  
5. **无法证明**「装完版本号变化」时，报告必须写 **「未完成端到端版本跃迁」→ NO-GO 或 CONDITIONAL**

### 4.4 证据清单（报告必附）

- [ ] 升级前版本号截图或日志  
- [ ] 升级后版本号截图或日志  
- [ ] `pending-install.json` 样例（可脱敏路径）  
- [ ] spawn 参数（含 `/S`）日志或 `update:install-scheduled` 事件  
- [ ] APPDATA 保留证明（config 字段或 session 列表）  
- [ ] 失败场景至少一条（UAC 取消 / silent 关拒绝 / Portable）  

---

## 5. DevTools / IPC 抽检（可选但推荐）

在渲染进程控制台（Electron）：

```js
// 状态
await window.hfq.getUpdateDownloadStatus()
await window.hfq.getPendingInstall?.()

// 负例：未 opt-in
await window.hfq.installUpdate({ mode: "silent" }).catch(e => e.message)

// 正例：仅在 ready + opt-in + 有包时
// await window.hfq.installUpdate({ mode: "silent", reason: "qa-test" })
```

记录返回值 / 抛错文案是否符合 FRONTEND-IPC。

---

## 6. 缺陷记录格式

每条 bug：

```text
### BUG-00x · <标题>
- 严重度：Blocker / Major / Minor / Nit
- 复现：1. … 2. …
- 期望：
- 实际：
- 证据：日志/截图路径
- 是否阻断 1.1.8 GO：是 / 否
```

**Blocker 示例**：silent 默认开启；无 opt-in 可静默装；真包升级失败且无 L2 回退；路径逃逸可装任意 exe。

---

## 7. GO / NO-GO 规则（必须遵守）

| 结论 | 条件 |
|------|------|
| **GO** | 自动化门禁绿（至少 2.1+2.2；全量 release:check 优先）**且** L3-07 真包（路径 A）PASS **且** 无 Blocker |
| **CONDITIONAL GO** | 自动化绿 + L3 逻辑/负例全过，但仅有路径 B 弱等价；**须**写清残留风险，**建议**发版 Agent 打包后再跑一次路径 A |
| **NO-GO** | L3-07 失败 / 自动化红且属产品代码 / 存在 Blocker / 实现文件缺失 |

测试 Agent **无权**自行改口契约（例如「没有真包也算 L3 完成」）。

---

## 8. 交付物（回复用户）

按下列结构输出（可另存 `docs/prompts/test-1.1.8-l3-report.md` 若用户要求落盘；默认对话交付即可）：

1. **结论**：GO / CONDITIONAL GO / NO-GO（一句话原因）  
2. **环境**：OS、commit/dirty、tag、是否临时改 version  
3. **自动化**：命令 + 绿/红摘要  
4. **矩阵**：§3 表填 P/F/B  
5. **真包 §4**：路径 A 或 B + 证据列表  
6. **缺陷列表**（BUG-xxx）  
7. **给发版 Agent 的建议**（可否开 `release-1.1.8`；须重测项）  
8. **未测 / 跳过**  

---

## 9. 非目标

- 不实现 L3、不抬 1.1.8、不打 tag  
- 不测完整 Memory FTS / Goal OS / IM  
- 不要求购买 OV/EV 证书  
- 不把 SmartScreen 警告算作 L3 失败（**可记录**）  
- UAC 弹出 **不算** 失败（期望允许）  

---

## 10. 建议执行顺序

1. §1 环境  
2. §2 自动化  
3. §3.1 负例 + Settings opt-in（L3-01–05, 10–11）  
4. §4 真包 L3-07（优先路径 A）  
5. §3.2 L1/L2 回归 + BOOT  
6. 写报告 · GO/NO-GO  

---

**开始测试。以证据说话；不确定标 Blocked，不要猜 PASS。**
