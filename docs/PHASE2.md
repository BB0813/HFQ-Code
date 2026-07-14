# HFQ Code — Phase 2 完整计划

Last updated: 2026-07-14  
Product: **HFQ Code** (`hfq-code`) · Windows desktop coding agent  
Baseline: **Beta `0.2.0-beta`**（Phase-1 页面与主循环已交付，见 [BETA.md](./BETA.md)）  
**Implementation status:** **1.0.0-rc.1** — see [PHASE2-STATUS.md](./PHASE2-STATUS.md) · [CHANGELOG.md](../CHANGELOG.md)

---

## 0. 结论：第一阶段是否完成？

**是。** 在产品定义下，**Phase-1 / Beta 交付目标已完成**：

| 判定项 | 状态 |
|--------|------|
| Phase-1 页面集（Home / Chat / Changes / Terminal / Tasks / Skills / MCP / Models / Permissions / Audit / Settings） | 已落地 |
| 会话循环（创建 / 恢复 / 停止 / 删除 / 改名 / 自动标题 / 流式 / 用量） | 已落地 |
| 工作区工具 + 权限 + 审计 + JSONL 崩溃恢复 | 已落地 |
| MCP stdio + HTTP 可调用、`mcpServers` 持久化 | 已落地 |
| 本机文件记忆 + 上下文压缩 + 设置偏好（主题/代理等） | Beta 增量已落地 |
| 自动化：`pnpm -r run build` · `pnpm test` · `pnpm smoke` | 绿 |
| 桌面：`pnpm dev:desktop` 可启动 | 已验证 |

**明确不算「产品 1.0 发版完成」的部分**（留给 Phase-2 / 发版轨）：安装包与自动更新、向量记忆与检索 UI、导入向导、子代理、用量计费面板、Eval、会话进程隔离、高级 MCP（OAuth / 完整 Streamable-HTTP）等。

定位不变（[DECISIONS.md](./DECISIONS.md)）：**编码桌面 Agent，不做 IM 网关。**

---

## 1. Phase-2 目标

在 Beta 可编码闭环之上，把 HFQ Code 做成 **可日常主力使用 + 可迁移 + 可治理 + 可度量** 的 1.0 候选：

1. **记得住**：项目/用户记忆可检索、可测试、可清理（不仅是 notes.json 关键词）
2. **迁得进**：一键从 OpenClaw / Claude / Cursor / 共享 skills 导入规则与技能
3. **分得开**：子代理 / 并行任务，主会话不被长工具链淹没
4. **看得见**：Token / 费用 / 延迟仪表盘，权限与审计可运营
5. **装得出**：Windows 安装包、更新通道、崩溃与诊断打包
6. **稳得住**：会话 Worker 子进程化、长会话预算、危险操作更细策略

成功标准（工程 + 产品）：

| 指标 | Phase-2 目标 |
|------|----------------|
| 从安装到第一次成功编辑 | &lt; 5 min（含模型配置） |
| 会话崩溃后可恢复率 | ≥ 99%（JSONL + open） |
| 记忆检索「有用命中」主观可用 | 核心项目笔记 Top-5 有帮助 |
| 导入向导一次成功率 | 常见 OpenClaw/Cursor 技能目录无手工改路径 |
| 子代理完成独立子任务不污染主 transcript 语义 | 主会话只见摘要 + 产物路径 |
| 发布 | `electron-builder` NSIS/portable；版本号与更新说明齐全 |

---

## 2. 范围总表

### 2.1 In scope（Phase-2）

| 编号 | 主题 | 用户价值 | 主要包 / 面 |
|------|------|----------|-------------|
| P2-A | **记忆 2.0** | 跨会话可靠召回 | `packages/memory`、Chat/Settings/新 Memory 页 |
| P2-B | **导入向导** | 从旧工具迁入 | `apps/desktop` + `packages/skills` + config |
| P2-C | **子代理** | 并行调研/改多模块 | `agent-core` + Tasks/Chat UI |
| P2-D | **用量与成本** | 模型花费可控 | providers usage + Settings/新 Usage 页 |
| P2-E | **Eval 实验室（轻量）** | 回归 mock/真实模型行为 | `scripts/` + 可选 UI |
| P2-F | **发版与壳增强** | 可分发、可更新 | `apps/desktop` electron-builder |
| P2-G | **运行时硬化** | 长稳、隔离、策略 | agent-core / policy / transcript |
| P2-H | **MCP / 协议增强** | 企业远程 MCP | `packages/mcp` |
| P2-I | **编码体验加深** | 更像主力 IDE Agent | tools + Changes + git 写路径（谨慎） |

### 2.2 Out of scope（Phase-2 仍不做）

- 多通道 IM 网关 / 手机 companion
- 训练 / RL / 自建大模型微调流水线
- 完整 OpenClaw 配置双写热同步
- 移动端壳
- 云端多租户账号体系（可预留 provider 登录，但不做 SaaS 中枢）

---

## 3. 工作流与里程碑

建议 4 个可发布切片（每片结束：`build + test + smoke + 手测清单`）。

```text
M2.1  Memory 2.0 + Usage 基础     ──► 内测包
M2.2  Import Wizard + Skills 管理 ──► 迁移友好
M2.3  Sub-agents + 运行时隔离     ──► 复杂任务
M2.4  Packaging + MCP 增强 + Eval ──► 1.0 RC
```

| 里程碑 | 主题 | 退出标准 |
|--------|------|----------|
| **M2.1** | 记忆可测 + 用量可见 | Memory 页可 CRUD/检索；Usage 按会话/日汇总；prefs 与路径文档齐 |
| **M2.2** | 导入向导 | 向导扫描 → 预览 → 复制到 HFQ 目录；密钥仅显式确认后写入 |
| **M2.3** | 子代理 | 主会话可派生子会话；Tasks 显示子任务；产物回写主会话摘要 |
| **M2.4** | 发版 RC | NSIS/portable；自动更新或手动更新说明；Eval 烟雾集；CHANGELOG |

预估量级（单人全职量级，可并行压缩）：

- M2.1：1.5–2.5 周  
- M2.2：1–2 周  
- M2.3：2–3 周  
- M2.4：1.5–2.5 周  
- **合计约 6–10 周** 到 1.0 RC（视向量方案与打包联调浮动）

---

## 4. 分主题详细设计

### 4.1 P2-A — Memory 2.0

**现状（Beta）**  
- 文件脑：`%APPDATA%/HFQ-Code/memory/notes.json`  
- 工具：`memory_search` / `memory_save`  
- 启动时把少量笔记注入 system prompt  

**目标**  
- 项目级 + 用户级两层记忆  
- 可检索（关键词 → 可选 embedding）  
- GUI：**Memory** 页（检索测试、列表、删除、置顶、导入导出）  
- Agent 在用户明确要求或高相关时自动 `memory_save`（策略：medium/ask 可配置）

**技术方案**

| 层 | 方案 |
|----|------|
| 存储 | `memory/user/notes.jsonl` + `memory/projects/<hash>/notes.jsonl` |
| 索引 v1 | 继续 token 重叠 + 可选 BM25（纯 TS，无原生依赖） |
| 索引 v2（可选） | 本地 embedding（ONNX / 小模型）或调用用户已有 OpenAI-compatible embeddings |
| API | 保持 `MemoryBrain { upsert, search, list, remove }`；增加 `scope: user \| project` |
| Sidecar | 接口稳定后，Python 实现可替换 `createFileMemory`（[DECISIONS Q1](./DECISIONS.md)） |

**UI**  
- 新导航：记忆（系统组）  
- 检索测试框：query → hits + score  
- 与 Settings 中「注入记忆」开关联动  

**验收**  
- 单测：scope 隔离、检索排序、路径逃逸无  
- 手测：A 项目笔记不出现在 B 项目默认检索（除非 user scope）

---

### 4.2 P2-B — Import Wizard（配置 / 技能 / 规则）

**依据** [COMPAT.md](./COMPAT.md) Phase 2 wizard。

**流程**

```text
选择来源 → 扫描（只读）→ 差异预览 → 用户勾选 → 复制到 HFQ 目录
         → 可选：provider key（二次确认）→ 完成报告
```

**导入源（P0）**

| 源 | 内容 |
|----|------|
| `~/.agents/skills` | AgentSkills |
| `~/.openclaw/skills`、`~/.openclaw/workspace/skills` | OpenClaw skills |
| 工作区 `CLAUDE.md` / `.cursorrules` / `.cursor/rules` | 生成或合并 `AGENTS.md` 草稿 |
| Cursor / Claude 用户级规则目录（Windows 常见路径表） | 只读扫描 |

**安全**  
- 默认 **不** 导入 API Key；勾选「导入密钥」才写入 `config.json`，并 mask 展示  
- 从不双写回 OpenClaw 配置  
- 路径复制保留相对结构，记录 `import-manifest.json`

**UI**  
- Settings 入口「导入向导」或首次启动可选  
- 步骤条 + 可勾选树 + 冲突策略（跳过 / 覆盖 / 重命名）

**验收**  
- 空目录、权限拒绝、超大 skill 包有明确错误  
- 导入后 Skills 页立即可见；会话 system 含 AGENTS 草稿（若用户确认写入工作区）

---

### 4.3 P2-C — Sub-agents（子代理）

**目标**  
主会话可派发 **只读调研** 或 **有界修改** 子任务；子会话独立 JSONL；完成后向主会话提交摘要 + 变更路径列表。

**模型**

```text
Parent Session
  ├── spawn(subagent): { role, goal, toolsProfile, workspacePath, budget }
  ├── events: task.updated (subagent_*)
  └── on complete: message.completed(system/assistant summary) + optional diff.updated fan-in
```

**toolsProfile 预设**

| Profile | 工具 | 默认策略 |
|---------|------|----------|
| `explore` | read/list/grep/git_status/memory_search | 全 allow 只读 |
| `edit` | explore + write/apply_patch | 写仍 ask 或继承父会话 allow |
| `shell` | edit + shell | 始终更严；危险模式强制 ask |

**UI**  
- Chat：工具轨迹中显示「子代理：标题」  
- Tasks：子任务状态树  
- 可选 Sub-agents 面板（列表、打开子会话只读回放）

**实现要点**  
- `SessionManager.spawn` / `listChildren`  
- 子会话 `parentSessionId` 写入 `session.meta`  
- 预算：`maxRounds`、`maxToolCalls`、墙钟超时  
- 禁止子代理再无限嵌套（默认 depth ≤ 1 或 2）

**验收**  
- 集成测试：父会话 spawn → 子 list/read → 父收到 summary  
- 父 abort 可级联 cancel 子会话

---

### 4.4 P2-D — Usage & Cost Dashboard

**现状**  
会话级 `usage.updated` 累加 input/output tokens。

**目标**  
- 按 **会话 / 日 / 提供方 / 模型** 聚合  
- 可选 **单价表**（用户填写 $/1M tokens）估算成本  
- 导出 CSV/JSON  

**数据**  
- 从 JSONL 扫 `usage.updated` + `session.meta.model`（离线可算）  
- 可选写入 `logs/usage-daily.json` 加速  

**UI**  
- 新页「用量」或 Settings 子面板  
- 图表：简单 bar（CSS/纯 canvas，避免重图表库也可）

**验收**  
- 与单会话 toolbar 累计 tokens 一致  
- 无密钥泄露到导出文件

---

### 4.5 P2-E — Eval Lab（轻量）

**目标**  
固定场景回归，防止改 loop/provider 时行为漂移。

**P0 用例（headless）**

| ID | 场景 |
|----|------|
| E01 | mock list + read |
| E02 | write 触发 permission |
| E03 | apply_patch 多文件 |
| E04 | git_status dirty |
| E05 | memory_save + search |
| E06 | compact 后仍保留最近 user |
| E07 | MCP stdio fake server call |
| E08 | 会话 delete 后 list 不含 |

**形态**  
- `pnpm eval` → 输出 JUnit/JSON 摘要  
- UI 可选：展示最近 eval 结果（非必须上 1.0）

---

### 4.6 P2-F — Packaging & Desktop hardening

| 项 | 计划 |
|----|------|
| 打包 | `electron-builder`：NSIS + portable |
| 应用图标 / 协议 | `hfq-code://` 可选 |
| 自动更新 | 可选 generic provider / GitHub Releases |
| 诊断包 | 导出：config（脱敏）+ 最近 session 元数据 + logs 尾部 |
| 单实例锁 | 第二实例聚焦已有窗口 |
| 关于页 | 版本、Chromium/Electron、数据目录 |

**验收**  
- 干净 Windows 机安装 → 打开 → mock 会话跑通  
- 卸载不删用户数据（或明确询问）

---

### 4.7 P2-G — Runtime hardening

| 项 | 说明 |
|----|------|
| Session Worker 子进程 | 主进程不跑重 CPU；crash 不拖死窗口（架构文档已预留） |
| 大工具结果外置 | `sessions/<id>/artifacts/`（COMPAT 已写） |
| Transcript 脱敏 | API key / Bearer 正则红acted 再入盘 |
| 策略细化 | 按路径 glob 的 write allow；shell allowlist 模式 |
| 计划模式（Plan mode） | 只读工具 + 输出计划，不落写；Chat 开关 |
| 并发会话 | 多会话切换不串事件（按 sessionId 已有基础，补压力测试） |

---

### 4.8 P2-H — MCP / 协议增强

| 项 | 说明 |
|----|------|
| HTTP | 完整 session 头、重试、鉴权 header 配置 UI（Bearer / 自定义） |
| OAuth MCP | 若生态需要，独立里程碑 |
| 资源 / prompts | `resources/list` 只读浏览（可选） |
| 健康检查 | 设置页一键 ping 已配置服务器 |

---

### 4.9 P2-I — 编码体验加深

| 项 | 说明 | 风险 |
|----|------|------|
| `git_diff` / `git_show` 只读 | 补全 git 态势 | 低 |
| `git_commit`（可选） | 显式高风险 + 双确认 | 高：默认关闭 |
| 多文件 Changes 批量 | 按目录过滤、搜索 path | 低 |
| 内联「在编辑器打开」 | 已有 openPath，补 VS Code `vscode://file` | 低 |
| 终端真实 PTY | node-pty 交互式（可选，工作量大） | 中 |
| 规则编辑器 | 应用内编辑 AGENTS.md | 低 |

---

## 5. 页面演进（相对 Phase-1）

| 页面 | Phase-2 变化 |
|------|----------------|
| Home | 导入入口、用量摘要条、更新提示 |
| Chat | Plan mode、子代理轨迹、记忆快捷指令 |
| Changes | 过滤/搜索、与 git_diff 对照（可选） |
| Terminal | 可选 PTY；否则保持会话命令块 |
| Tasks | 子代理任务树 |
| Skills | 启用/禁用持久化、从向导安装 |
| MCP | HTTP 鉴权字段、连接日志 |
| Models | 单价、默认 fallback 链 |
| Permissions | 路径规则、Plan 模式策略 |
| Audit | 跨会话查询（只读扫 JSONL） |
| Settings | 诊断包、更新、导入 |
| **Memory（新）** | 检索 / CRUD / scope |
| **Usage（新）** | 成本与 tokens |
| **Import（新或向导）** | 迁移 |

---

## 6. 技术依赖与风险

| 风险 | 缓解 |
|------|------|
| Embedding 体积/原生模块 | M2.1 先 BM25；embedding 可插拔 |
| 子代理成本爆炸 | 硬预算 + 默认 explore profile |
| electron-builder 签名与 SmartScreen | RC 起准备证书；portable 作保底 |
| Worker 拆分 IPC 复杂 | 先同进程加固，M2.3 再拆进程 |
| 用户把 Beta 数据当生产 | 升级迁移脚本 + config `version` 字段演进 |

**config 版本**  
- 现 `version: 1`  
- Phase-2 引入 `prefs` 已兼容  
- 若破坏性变更 → `version: 2` + `migrateConfig()`

---

## 7. 测试与质量门禁

每里程碑必过：

```bash
pnpm -r run build
pnpm test
pnpm smoke
# M2.4+
pnpm eval
```

新增建议：

| 类型 | 内容 |
|------|------|
| 单元 | memory scope、import 路径、usage 聚合、子代理预算 |
| 集成 | spawn 子会话、导入后 loadSkills |
| 桌面手测表 | 见附录 A |
| 性能 | 1000+ 条 JSONL open &lt; 2s（SSD） |

---

## 8. 文档与发布产物

| 产物 | 说明 |
|------|------|
| `docs/PHASE2.md` | 本文 |
| `docs/BETA.md` | 基线已交付清单 |
| `CHANGELOG.md` | 从 0.2.0-beta → 0.3.x → 1.0.0 |
| 用户手册（简） | 安装、模型、权限、导入、记忆 |
| 默认安全说明 | 工作区边界、shell、密钥位置 |

版本建议：

```text
0.2.0-beta     当前
0.3.0-beta     M2.1+M2.2
0.4.0-beta     M2.3
1.0.0-rc.1     M2.4
1.0.0          发版
```

---

## 9. 建议执行顺序（落地时直接按此开干）

1. **Memory 页 + project scope + 检索测试**（用户可感知）  
2. **Usage 聚合页**（数据已在 JSONL，见效快）  
3. **Import wizard P0 源**  
4. **Plan mode**（策略开关，改动面可控）  
5. **Sub-agent explore profile**  
6. **electron-builder portable**  
7. **Worker 隔离 / git 只读增强 / MCP auth / Eval 集**  

---

## 附录 A — Phase-2 桌面手测清单（摘要）

- [ ] 安装包首启 → 数据目录创建  
- [ ] 配置 OpenAI-compatible / Anthropic → 测连  
- [ ] 打开工作区 → 会话 list/read/write/patch/shell  
- [ ] 记忆保存 → 新会话检索命中  
- [ ] 导入 skills → Skills 页可见  
- [ ] 子代理 explore → 主会话摘要  
- [ ] 权限拒绝 / 会话允许 / 审计导出  
- [ ] 主题切换、代理字段保存  
- [ ] 杀进程后 resume 会话  
- [ ] 用量数字与会话 chip 一致  

---

## 附录 B — 与现有文档关系

| 文档 | 角色 |
|------|------|
| [DECISIONS.md](./DECISIONS.md) | 冻结定位与 Phase-1 边界 |
| [PRODUCT.md](./PRODUCT.md) | 页面地图；Phase-2 条目以本文展开 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 进程与扩展点；Phase-2 实现须对齐 |
| [COMPAT.md](./COMPAT.md) | 导入源与协议承诺 |
| [BETA.md](./BETA.md) | Phase-1/Beta 完成定义 |

---

**一句话**：Phase-1/Beta 已把「能在本机写代码的 Agent 工作台」跑通；Phase-2 专注 **记忆深度、迁移、子代理、度量、发版与硬化**，把 Beta 推到可主力使用的 **1.0 RC**。
