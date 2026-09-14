# UI/UX 参考 · DeepSeek Harness（dsh）→ HFQ Code 采纳纪要

> 参考源：https://github.com/deepseek-ai/deepseek-harness（MIT · developer preview）  
> 摘要时间：2026-09-13 · 统筹整理 · 用于 1.2 Slice B/C 及后续 UI/UX 决策参考  
> 结论先行：**采纳 3 条、已对齐 4 条、不采纳 2 条**（理由见下）。

---

## 1. dsh 是什么

DeepSeek AI 开源的智能体运行框架（"Everything is a Plugin"），基于 Cordis 插件内核：
- `npx @deepseek-ai/dsh web` 一条命令启动 Web UI（127.0.0.1:3080，自动开浏览器，`--no-open` 兜底无头/SSH）
- 插件化：工具 / UI / 模型接入全部解耦为插件，`dsh-plugin` 主题标签做生态发现
- 配套：AGENTS.md 协作规范、多套 Vitest 配置（e2e/bench/snapshot/web/perf）、双语文档

## 2. 逐条对照与裁定

| # | dsh 设计点 | HFQ Code 现状 | 裁定 |
|---|-----------|---------------|------|
| 1 | **配置热生效**：换 API key/供应商保存即用，无需重启 | Providers 增删后 `bootstrap()` 即时刷新；模型热切换；Settings 保存热更新 | ✅ 已对齐 |
| 2 | **渐进式门控**：未配模型→路由不可用；未选工作区→composer 禁用 | 工作区未绑时 Chat 有黄色警示条，但**发送按钮仍可点**（点击后才失败） | 🟡 **采纳（本轮已做）**：`noWorkspace` 时发送禁用 + title/aria 引导（`ChatView.tsx`） |
| 3 | **权限策略驱动审批**：是否弹审批由 active permission policy 决定，细粒度可调 | permissionMode（ask/allow_session/…）+ 策略矩阵 + allow_session 授予/撤销页 | ✅ 已对齐 |
| 4 | **工作区根绑定**：以调用目录为文件系统根，降低误操作 | workspace 沙箱 + path-escape 拒绝 | ✅ 已对齐 |
| 5 | **plan / 委派一等展示**：智能体维护 plan、可委派子任务，UI 有进度位 | `/goal` + Tasks 面板 + 子会话/父栈 + spawn 错误中文 | ✅ 已对齐 |
| 6 | **插件一等管理**：插件可发现、可装卸（everything-is-a-plugin） | skills 已可安装/预览/搜索，但**无启停/卸载**（缺 IPC） | 🟡 **采纳 → 下一功能刀**：`skills:toggle` / `skills:remove` IPC + agent-core 匹配门控 + Switch/卸载 UI（ConfirmDialog 已就位） |
| 7 | **低摩擦启动**：单命令 + 自动开浏览器 + 无头兜底 | 桌面 App 双击即开；不适用浏览器自动打开语义 | ✅ 已对齐（形态不同） |
| 8 | **双语文档 i18n** | 产品 UI 中文是 U0 锁定 | ❌ 不采纳（UI）；文档可后续双语 |
| 9 | **Web UI 模式** | Windows 桌面产品（Electron） | ❌ 不采纳（形态冲突；SSH 场景属 Track E 之外的远期） |

## 3. 落地记录

| 项 | 状态 | 位置 |
|----|------|------|
| 采纳 2 · 渐进式门控 | **done** | `ChatView.tsx` `noWorkspace` 发送禁用 + 引导文案 |
| 采纳 6 · 技能启停/卸载 | **done** | `skills:toggle` / `skills:remove` IPC + `skillMatch.disabled` 门控 + SkillsPage Switch/卸载（commit `93bca20`） |

## 4. 给后续列车

- Slice B/C 规划时把「技能 = 插件一等管理」写进验收（对齐 dsh 精神，也是 F2 的自然延伸）
- 新功能对标检查表：配置热生效 / 渐进门控 / 策略驱动审批 / 一等可管理——四条问一遍再出设计

---

## 5. npm 包参考 · `@deepseek-ai/dsh@0.1.5-rc.2`

> 来源：https://www.npmjs.com/package/@deepseek-ai/dsh/v/0.1.5-rc.2 （发布约 2026-09-10 · MIT · bin: `dsh`）  
> 描述：**"dsh CLI: profile boot, plugin management, and the browser UI alias"** —— CLI 即「profile 启动 + 插件管理 + Web UI 别名」三件事。

### 5.1 插件分解（来自依赖树，63 个 `@deepseek-ai/dsh-*` 包）

| dsh 插件包 | 职责 | HFQ Code 对应物 | 启示 |
|------------|------|-----------------|------|
| `app-boot` / `sdk-app` / `headless` | 应用启动形态（web/SDK/无头） | Electron `main.cjs` 单壳 | 桌面单壳够用；无头/远程属远期 |
| `client-ui-agent-preset` | UI 的 agent 预设 | renderer shell | — |
| `tool-bash` / `tool-pwsh` / `tool-fs` / `tool-web` / `tool-str-replace-editor` | 工具即插件 | `packages/tools`（hub 内建） | **对照**：我们的工具未按"每工具一包"拆分；若生态开放，可借鉴包级拆分 |
| `plan-mode` | 计划模式为独立插件 | permissionMode `plan` + `/goal` | 已对齐 |
| `goal` | 目标子系统 | goal sidecar + Tasks | 已对齐 |
| `skill` | 技能插件 | `packages/skills` + 一等启停/卸载（`93bca20`） | 已对齐 |
| `compaction-tool-result-pruner` | **工具结果裁剪**作为压缩插件 | 1.1.6 LLM compact（按字符预算） | 🟡 可借鉴：**工具结果的结构化裁剪**（按工具类型丢弃/截断）作为 compact 的前置层，记入后续 |
| `mcp-client` | MCP 客户端插件 | `packages/mcp` | 已对齐 |
| `webhook-github` / `hooks-claude-code` | 外部事件钩子 | 无对应 | 🟡 记入 Track E 远期（GitHub webhook / hooks 系统） |
| `persona` / `cmdline` | 人设/命令行 | coding profiles / composer slash 命令 | 已对齐 |
| cordis `plugin-loader/hmr` | 插件热加载 | 无（重载 = 重启会话） | 远期 |

### 5.2 版本策略参考

- 单 CLI 包 + 63 子包锁 `^0.1.5-rc.2`：**发布一条流水线，能力按包切片**——HFQ 的 workspace 单仓 + pnpm 已是同构，不必改
- `bin: dsh → lib/bin.js` 极薄入口：对应我们 `electron/main.cjs` 的 bootstrap 层，保持薄是共同方向

## 6. TokenHub 定位澄清（2026-09-14）

- **TokenHub 腾讯云是这几天的测试用模型渠道**（企业版 Token Plan），用于联调与日常验证，非默认主渠道
- 平台预设（`PLATFORM_PRESETS`）保留仅含 URL/模型清单的模板，方便重建渠道；密钥只存在本地 DPAPI 加密的 credentials，不入仓库

