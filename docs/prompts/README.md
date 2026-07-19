# 前后端交接 Prompt 目录

统筹 Agent 给**前端 Agent / 后端 Agent**下发的实现需求，**一律落盘本目录**，禁止只贴在对话里。

## 规则（必须）

1. **整包不拆分**：同一需求前后端共用**一份** Prompt 文件（契约与验收统一），不要拆成 `fe.md` + `be.md` 两套互相漂移的说明。
2. **先写文件再转发**：用户说「给我 Prompt 去前端/后端 Agent」时，统筹 Agent 必须先写入本目录，再把**文件路径**交给用户；正文以文件为准。
3. **命名**：`{track-or-topic}-{short-slug}.md`  
   - 例：`F1-kivio-athena-handoff.md`、`F2-goal-tree-sidecar.md`  
   - 可选日期前缀：`2026-07-19-F1-kivio-athena-handoff.md`（同一 train 多轮修订时用）
4. **内容结构**（固定骨架，便于执行 Agent 扫读）：
   - 用法 / 角色 / 仓库 / 产品边界
   - 已落地（禁止重做）
   - 本轮必须完成的缺口（FE / BE 可分节，但仍在同一文件）
   - 数据契约
   - 文件地图
   - 实现原则与非目标
   - 验收清单
   - 交付回复格式
5. **安全**：不得写入 API key、token、本机凭证路径中的密钥内容；可写「从 config/credentials 读取」类说明。
6. **修订**：同一文件可追加 `## Changelog` 小节；大改行为则新开版本文件并在 README 索引表更新「当前有效」。

## 索引（当前有效）

| 文件 | 主题 | 状态 |
|------|------|------|
| [F1-kivio-athena-handoff.md](./F1-kivio-athena-handoff.md) | Track F1 收口 + 前后端联调（Kivio/Athena 采纳） | done（历史交接） |
| [F1-integration-audit.md](./F1-integration-audit.md) | 统筹联调审计 + 本轮 FE 接缝修补记录 | done · F1 收口 |
| [release-1.1.5.md](./release-1.1.5.md) | 发版 Agent：抬版本 1.1.5 + release:check + 打包 tag | done（1.1.5 shipped） |
| [1.1.6-ui-polish.md](./1.1.6-ui-polish.md) | 1.1.6 UI 子切片（并入 full train） | subsumed |
| [1.1.6-full-train.md](./1.1.6-full-train.md) | 1.1.6 范围说明（产品切片） | reference |
| [1.1.6-handoff.md](./1.1.6-handoff.md) | 1.1.6 前后端整包实现 Prompt | done · 已实现 |
| [1.1.6-integration-audit.md](./1.1.6-integration-audit.md) | 1.1.6 统筹联调审计 + 孤儿 goal FE 修补 | done · 收口 |
| [release-1.1.6.md](./release-1.1.6.md) | 发版 Agent：抬版本 1.1.6 + release:check + 打包 tag | done（1.1.6 shipped） |
| [1.1.7-handoff.md](./1.1.7-handoff.md) | 1.1.7 更新 L1+L2（后台下载 + 一键安装） | done · shipped in 1.1.7 |
| [release-1.1.7.md](./release-1.1.7.md) | 发版 Agent：抬版本 1.1.7 + release:check + 打包 tag | done（1.1.7 shipped） |
| [1.1.8-l3-handoff.md](./1.1.8-l3-handoff.md) | 1.1.8 完整 L3 静默升级（实现） | done · 实现在工作区 · 待发版 |
| [test-1.1.8-l3-gate.md](./test-1.1.8-l3-gate.md) | 测试 Agent：1.1.8 L3 发布门槛 | done · 已执行 |
| [test-1.1.8-l3-report-brief.md](./test-1.1.8-l3-report-brief.md) | 测试回传简报 | **CONDITIONAL GO** · 差路径 A |
| [release-1.1.8.md](./release-1.1.8.md) | **发版 Agent：1.1.8 L3 · tag 前强制真包路径 A** | **active · 待执行** |

阶梯总册（非 prompt，实现必读）：[`docs/UPDATE-L1-L3.md`](../UPDATE-L1-L3.md) · DECISIONS Q9

## 与产品文档的关系

- 产品决策 / 路线图仍以 `docs/DECISIONS.md`、`docs/ROADMAP.md`、`docs/ADOPT-*.md` 为准。
- 本目录是**可执行交接单**，不是替代架构决策；冲突时以 DECISIONS / ADOPT 文档为准，并回写修正 Prompt。
