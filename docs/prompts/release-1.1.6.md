# 发版任务 · HFQ Code **1.1.6**（full train）

> **用法**：把本文件**原样整份**发给 **发版 Agent**。  
> **你是发版 Agent**，不是前后端实现 Agent：整理工作区 → 抬版本 → 门禁 → 打包 → 文档 → tag → GitHub Release。  
> 仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`  
> 产品：Windows 桌面**编程智能体**（Electron + TypeScript）— **不是** IM 网关。  
> 基线：**1.1.5 已 ship**（tag `v1.1.5` · commit `23b77c8` 一带）。  
> 源真相：本文件 · 联调收口 [`1.1.6-integration-audit.md`](./1.1.6-integration-audit.md) · 实现契约 [`1.1.6-handoff.md`](./1.1.6-handoff.md) · 范围 [`1.1.6-full-train.md`](./1.1.6-full-train.md)。  
> **必须发 `1.1.6` / tag `v1.1.6`，禁止复用/覆盖 `v1.1.5`。**

---

## 0. 一句话任务

把工作区里已联调通过的 **1.1.6 full train**（compression LLM compact · Goal sidecar · `read_document` · Settings compact · UI polish）提交、抬版本、`release:check` 绿、打 Windows 包、写 Release 说明、打 tag 并发布 GitHub Release。

---

## 1. 发什么（范围 In）

### 1.1 功能（相对 1.1.5）

| ID | 能力 |
|----|------|
| B | `prefs.modelRoles.compression` 真正参与 compact（`compactChatMessagesMaybeLlm`）；失败回退启发式；可观察 note `[context compacted · llm]` |
| C | Goal 树 sidecar `%data%/sessions/<sessionId>.goals.json`：upsert / cold open merge / delete unlink |
| D | Settings：`compactMaxChars`（8000–200000）+ compression 文案（非「仅预留」） |
| E | 工具 `read_document`（文本 / docx / 尽力 pdf；path-escape 拒绝）+ `skills/bundled/document-read` |
| A | UI：profile chip 热更新、mermaid 流式安全、goal banner objective、Tasks parentTaskId 缩进（含孤儿顶层）、shell surface 等 |

### 1.2 明确 Out（不要塞进 1.1.6）

- Memory 倒排索引 / FTS5（P2 残留 → 1.2 或单独 train）  
- 完整 Goal OS / 多级拖拽树 / dock 自由布局  
- 商业 OV/EV 签名声誉、PTY 大改、IM / OCR  
- **不要**再开前后端功能开发；缺口只修**发版阻断**（编译/测试/打包红）

### 1.3 工作区现状（发版前必读）

`main` 远端对齐 **1.1.5**；**大量未提交** 1.1.6 改动（实现 + 联调）。发版 Agent 负责：

1. `git status` / `git diff --stat` 扫一遍  
2. **排除**密钥、本机路径凭证、临时垃圾（`*.pfx`、含 API key 的本地 config 副本、`node_modules` 等）  
3. 应纳入的典型路径（以 status 为准，勿漏 untracked）：  
   - `packages/agent-core/**`（`compact.ts`、`goals-store.ts`、`loop.ts`、`manager.ts`、tests）  
   - `packages/tools/**`、`packages/policy/**`  
   - `skills/bundled/document-read/**`  
   - `apps/desktop/renderer/**`（Settings / Tasks / Chat / shell / ui-store / css）  
   - `docs/**`（ROADMAP、FRONTEND-IPC、ADOPT、`docs/prompts/1.1.6-*`、本 release prompt）  
4. 若发现**与 1.1.6 无关的半截改动**：单独说明，**不要** silently 塞进 release commit；阻断则停并报告用户  

联调结论：**可演示收口**（见 integration-audit）。发版前仍跑全量门禁，不以「联调过了」跳过 `release:check`。

---

## 2. 版本与文件

### 2.1 必须抬到 `1.1.6`

| 文件 | 动作 |
|------|------|
| 根 `package.json` | `"version": "1.1.6"` |
| `apps/desktop/package.json` | `"version": "1.1.6"`（Electron `app.getVersion` / 更新检查依赖） |
| 文档/UI **写死**的 `1.1.5` 产品串 | 按需改为 `1.1.6`（StatusBar 一般读 package 版本，勿硬编码错版） |

**不要**批量改 `packages/*` 的 `0.1.0` workspace 包版本（与历史 1.1.x 一致），除非仓库已有脚本强制同步。

### 2.2 必须新建 / 更新的文档

| 文件 | 动作 |
|------|------|
| **`docs/RELEASE-1.1.6.md`** | **新建**（对齐 `RELEASE-1.1.5.md` 结构：Why / Highlights / Install / Verify / Out of scope） |
| `docs/ROADMAP.md` | baseline → **1.1.6 shipped**；「1.1.6 full train in progress」改为 **done**；Next train 指到 1.2 / F2 remainder |
| `docs/prompts/README.md` | 本文件状态 `active` → 发版完成后可标 done（发版 Agent 可改） |
| `docs/ADOPT-KIVIO-ATHENA.md` / `FRONTEND-IPC.md` | 已有 1.1.6 字段则核对，**不要**大改契约 |

仓库**无**根级 `CHANGELOG.md`：以 **`docs/RELEASE-1.1.6.md`** 为用户可见发版说明；可选在 `docs/CHANGES-GIT-1.1.md` 追加一行指针（若该文件惯例在用）。

### 2.3 `RELEASE-1.1.6.md` 建议 Highlights（可润色，事实勿编）

1. **Compression 真压缩**：配置压缩 model 后长上下文 / compact 路径尝试 LLM 摘要；失败回退启发式；Chat 可见 `[context compacted · llm]`  
2. **Goal 冷启动**：`*.goals.json` sidecar；`/goal` 后杀进程重开 Tasks 仍有 objective/progress 等  
3. **`read_document`**：workspace 内 docx/文本/尽力 pdf；越界拒绝；bundled `document-read` skill  
4. **Settings**：`compactMaxChars`；compression 文案更新  
5. **UI 手感**：Coding Profile chip 热更新、mermaid 流式安全、Tasks 父子缩进、shell surface  

**Out of scope 写清**：Memory FTS/倒排未做；无完整 Goal OS。

---

## 3. Git 提交策略

推荐 **1～2 个 commit**（风格对齐历史）：

**方案 A（推荐）**

1. `feat(1.1.6): compression LLM compact, goals sidecar, read_document, UI polish`  
   — 全部功能 + 测试 + 联调小修 + prompts  
2. `release: HFQ Code 1.1.6 …`  
   — 仅 version bump + `RELEASE-1.1.6.md` + ROADMAP baseline  

**方案 B**

- 单 commit：`release: HFQ Code 1.1.6 compression compact + goals sidecar + read_document + UI`  
  （功能与发版材料一起；信息写全）

约束：

- 先看 diff，**不** `git add .` 盲加  
- 作者信息用仓库已有 git user  
- **不** force-push `main`；**不**删除 `v1.1.5`  
- tag 注释/信息含简短亮点  

---

## 4. 门禁（必须绿）

按顺序（失败如实停，**不要假绿**）：

```bash
# 1) 相关包构建（实现若动了 dist 源）
pnpm --filter @hfq/shared build
pnpm --filter @hfq/tools build
pnpm --filter @hfq/policy build
pnpm --filter @hfq/agent-core build
pnpm --filter @hfq/desktop run typecheck

# 2) 全量发版门禁
pnpm release:check
# = pnpm build && pnpm test && pnpm smoke && pnpm eval
```

可选聚焦自证（不替代 release:check）：

```bash
pnpm exec vitest run packages/agent-core/tests/compact.test.ts packages/agent-core/tests/session.test.ts packages/tools/src/hub.test.ts
```

若 `release:check` 红：

- **测试/类型/构建** → 最小修复后重跑（仍属发版阻断修）  
- **环境/签名/网络** → 报告用户，勿伪造通过  

---

## 5. 打包与校验

按仓库惯例（见 `docs/PACKAGING.md`、历史 release）：

```bash
pnpm pack:win          # 或 pack:dir 视 CI/本机
# 有签名 secrets / HFQ_SIGN_ROOT 则签；无则明确「未签名」写入交付说明
pnpm sha256:release    # 生成 SHA256SUMS
pnpm pack:verify       # 若脚本适用
```

产物期望（名称以实际 electron-builder 为准）：

- NSIS：`HFQ Code-1.1.6-x64.exe`（或仓库既有命名）  
- portable（若启用）  
- `SHA256SUMS.txt`  

检查：

- [ ] 安装包/解压后 About / StatusBar / Settings 版本 **1.1.6**  
- [ ] 包内无 `*.pfx`、无真实 API key  
- [ ] 有签名时 `HFQ Code.exe` 签名有效；无签名在 Release 正文注明  

---

## 6. Tag 与 GitHub Release

```text
tag:    v1.1.6
target: 含 1.1.6 发版 commit 的 main（或 release commit）
```

GitHub Release（`gh release create` 或等价）：

- **Title**：`HFQ Code 1.1.6`  
- **Body**：以 `docs/RELEASE-1.1.6.md` 为主（可截 Highlights + Install + 已知限制）  
- **Assets**：NSIS + portable（若有）+ `SHA256SUMS.txt`  
- **latest**：按产品惯例设为 latest（与 1.1.5 更新检查路径一致）  

推送：

```bash
git push origin main
git push origin v1.1.6
```

（若用户环境无权限 push，完成本地 tag + 包 + 说明，并在交付里写清「待用户 push / 上传」——**不要**假装已发布。）

---

## 7. 发版后冒烟清单（写入 RELEASE 或交付回复）

- [ ] Settings：压缩 model + 小 `compactMaxChars` → 长对话或上下文触发后 Chat 可见 llm compact note（无 model 则仅启发式）  
- [ ] `/goal …` → Tasks 有目标；杀进程冷开仍在；delete session 后 sidecar 消失  
- [ ] workspace docx/md → agent 可 `read_document`  
- [ ] 换 Coding Profile 保存 → Header chip 立即更新（新会话才吃 profile 逻辑）  
- [ ] 流式 mermaid 不崩；完整 fence 可渲染  
- [ ] 检查更新路径：旧装 1.1.5 → 应能看到 **1.1.6**（发布为 latest 后）  

---

## 8. 安全与产品硬约束

- 不提交密钥、token、Kivio/Athena 凭证、用户本机 `%APPDATA%` 配置副本  
- workspace path-escape **不**放宽  
- 不改 Layout A 默认  
- 不把「Memory FTS 未做」写成已交付  

---

## 9. 交付回复格式（发版 Agent → 用户）

1. **版本 / tag / commit hash**  
2. **纳入的主要路径摘要**（BE / FE / docs）  
3. **`pnpm release:check` 结果**（失败贴关键日志）  
4. **打包产物路径 + SHA256**（或 SUMS 文件位置）  
5. **签名状态**（已签 / 未签原因）  
6. **GitHub Release URL**（或「仅本地完成，待 push」）  
7. **已知限制**（Memory P2 等）  
8. **未做步骤**（若有）  

---

## 10. 建议执行顺序

1. `git status` + diff 审阅 · 排除脏文件  
2. 功能 commit（若尚未 commit）  
3. bump `1.1.6` · 写 `docs/RELEASE-1.1.6.md` · 更新 ROADMAP  
4. `pnpm release:check`  
5. release commit（若与 2 分开）  
6. `pack:win` + `sha256:release`  
7. `git tag v1.1.6` · push · `gh release create`  
8. 按 §9 回复  

---

## 11. 非目标（再次强调）

- 不实现 Memory 索引 / F2 剩余  
- 不重做 1.1.6 功能设计  
- 不覆盖 `v1.1.5`  
- 不把统筹联调 audit 当用户主 Release 文案（可链到 prompts，主文案用 `RELEASE-1.1.6.md`）  

---

**开始执行发版全流程。失败如实停并报告；门禁红不要标 shipped。**
