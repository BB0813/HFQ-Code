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
| 采纳 2 · 渐进式门控 | **done（本轮）** | `ChatView.tsx` `noWorkspace` 发送禁用 + 引导文案 |
| 采纳 6 · 技能启停/卸载 | **pending → 下一功能刀** | 需新增 IPC：`skills:toggle` / `skills:remove`（main.cjs + packages/skills + agent-core 匹配门控 + preload + FE Switch/卸载） |

## 4. 给后续列车

- Slice B/C 规划时把「技能 = 插件一等管理」写进验收（对齐 dsh 精神，也是 F2 的自然延伸）
- 新功能对标检查表：配置热生效 / 渐进门控 / 策略驱动审批 / 一等可管理——四条问一遍再出设计
