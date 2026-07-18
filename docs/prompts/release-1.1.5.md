# 发版任务 · HFQ Code **1.1.5**（Track F1）

你是 **发版 Agent**。仓库：`D:\Binbim\个人项目\HFQ_Clod-Agent`。当前 **main 基线已是 1.1.4**；工作区有 **未提交** 的 Track F1（Coding Profiles / mermaid / skill match / goal fields / memory links / diagram skill + 联调修补）。**必须发 `1.1.5`，禁止复用/覆盖 `v1.1.4`。**

## 范围

- 版本：`1.1.5`（root `package.json` + `apps/desktop/package.json`，及文档/UI 中写死的版本串）
- 内容：F1 采纳（见 `docs/ADOPT-KIVIO-ATHENA.md`、`docs/prompts/F1-integration-audit.md`）
- 文档：`CHANGELOG.md` 新增 1.1.5 节 · 新建 `docs/RELEASE-1.1.5.md` · 更新 `docs/ROADMAP.md` baseline
- 门禁：`pnpm release:check` 必须绿
- 打包：按仓库惯例 `pack:win` / 签名（有 secrets 则签）/ `pnpm sha256:release`
- Git：提交 F1+发版材料 → tag **`v1.1.5`** → GitHub Release（NSIS + portable + SHA256SUMS）
- **不要**提交密钥/credentials；**不要**开 F2

## 约束

- 先 `git status` / diff 确认无意外文件再 commit
- 提交信息风格对齐历史：`release: HFQ Code 1.1.5 …`
- 失败如实停并报告；不要假绿

开始执行发版全流程。
