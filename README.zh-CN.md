# HFQ Code

Windows 桌面端 **编程智能体**（WorkBuddy / ZCode 一类产品）：完整 GUI、工作区绑定会话、Skills、MCP、多提供商模型、权限与审计。

> 仓库目录可能仍叫 `HFQ_Clod-Agent`；产品名是 **HFQ Code**。

**语言：** [English](./README.md) · **简体中文**

## 状态

**1.1.3** — Windows 编程智能体（Phase-1+2 + Phase-3 + 1.0.x 补丁列车 + 1.1 提供商生命周期 / 会话模型重绑 + 会话身份与 Tasks 冷启动修复）：

- 会话循环：创建 / 恢复 / 停止 / 删除 / 重命名 + 自动标题、流式输出、token、压缩、**计划模式**、**子智能体**
- **Session worker**（子进程）隔离 agent 循环；进程内回退
- 访问模式（变更前确认 / 自动编辑 / 计划 / 完全访问）· 权限弹窗队列 · 超时自动拒绝
- 工具：`read_file` · `list_dir` · `grep` · `git_status` · `git_diff` · `git_show` · `git_commit` · `memory_*` · `write_file` · `apply_patch` · `shell` · `network_fetch` · `spawn_subagent` + 动态 `mcp__*`
- 密钥存于 `credentials.json`（API Key / MCP 鉴权头）
- Memory 2.0 · 用量面板 · 导入向导 · `/goal` 长任务 + Tasks 横幅
- Skills 商店：精选目录 · 本地文件夹 + **远程 https zip/tar.gz** · SKILL.md 预览 / 冲突 / 标签
- MCP：stdio + HTTP · 权限 + 审计 · Changes · 终端（一次性） · Models
- 更新检查：多源回退（ghproxy 镜像 → ungh → 直连 GitHub）；**仅手动下载安装**（D3 应用内下载）
- 打包：NSIS + portable · `pnpm release:check` / `pack:verify` · 自签 HFQ-ClodBreeze
- 提供商：可删除 mock/最后一个渠道 · 空列表 fail-closed · `models:list` · baseURL 规范化
- 会话：open/send 重绑全局 active · identity pin 抑制历史模型自称
- Chat UI：顶栏提供方 · 模型 · 作曲栏仅模型 ID · 菜单向上弹出
- **1.1.3**：`listSessions` 恒定暴露 `model`/`providerId`；Tasks `goal_required` spawn 冷启动可恢复；UI 身份字段统一 helper

更多：[docs/PHASE3-STATUS.md](./docs/PHASE3-STATUS.md) · [docs/ROADMAP.md](./docs/ROADMAP.md) · [docs/PACKAGING.md](./docs/PACKAGING.md) · [docs/AUDIT.md](./docs/AUDIT.md) · [CHANGELOG.md](./CHANGELOG.md)

## 下载与 Windows SmartScreen

官方构建：[GitHub Releases](https://github.com/BB0813/HFQ-Code/releases)（NSIS 安装包 + 便携版）。

**发行包使用自签发布者 `HFQ-ClodBreeze` 做 Authenticode 签名**（非商业 OV/EV 证书）。Windows 仍可能提示：

- 「无法验证发布者 / 未知发布者」——直到本机信任该发布者根证书
- SmartScreen：「Windows 已保护你的电脑」（信誉 / 新发布者）

这对自签桌面应用是预期行为，不代表下载损坏。细节见 [docs/PACKAGING.md](./docs/PACKAGING.md)。

### 怎么处理

1. 只从 **本仓库 Releases**（或你自己打的包）下载。
2. 可用同版本 `SHA256SUMS.txt` 校验文件。
3. 打开文件对话框选 **运行**。
4. 若出现 SmartScreen：**更多信息 → 仍要运行**。
5. **NSIS 安装** 可能提权并导入发布者信任包（`resources/trust`）。**便携版** 可运行 `resources/Launch-HFQ-Code.bat` 或管理员运行一次 `Install-Trust.bat`。

### 构建 / 签名说明

| 做法 | 效果 |
|------|------|
| 核对 Release URL + SHA-256 后确认 **运行 / 仍要运行** | 自用与小范围内测实用 |
| 使用 **便携版** + trust 启动器 | 同一发布者；可选静默导入信任 |
| 源码构建（`pnpm pack:win`）并配置 `HFQ_SIGN_ROOT` | 用本地 PFX 签名；切勿提交 `root.pfx` |
| `HFQ_SIGN_SKIP=1` | 仅本地未签名调试包 |

自签 **不保证** 通过 SmartScreen。商业 OV/EV 与下载信誉是后续选项。不要为了“省事”全局关闭 SmartScreen / UAC。

### 安装包 vs 便携版

| 产物 | 说明 |
|------|------|
| `HFQ Code-*-x64.exe` | NSIS 安装包（按机器安装；安装时导入信任） |
| `HFQ Code-*-portable.exe` | 便携版；用 `Launch-HFQ-Code.bat` 信任并启动 |
| `SHA256SUMS.txt` | 上述文件校验和 |

更新策略仍是 **手动**：应用内检查 → 下载 → 确认打开安装包；无静默自装。

## 版本历史

完整变更见 [CHANGELOG.md](./CHANGELOG.md)；发版手记见 `docs/RELEASE-*.md`。

| 版本 | 日期 | 摘要 |
|------|------|------|
| **[1.1.3](./docs/RELEASE-1.1.3.md)** | 2026-07-18 | 会话 `model`/`providerId` 恒定暴露；Tasks `goal_required` spawn 冷启动；UI 身份 helper；诊断测试数据目录隔离 |
| [1.1.2](./docs/RELEASE-1.1.2.md) | 2026-07-16 | 完整产品包：1.1.1 后端 + Settings/Tasks/Changes/Models UI |
| [1.1.1](./docs/RELEASE-1.1.1.md) | 2026-07-16 | D3 安装自动下载；`providerId`；Tasks 子会话/spawn 冷启动持久化 |
| [1.1.0](./docs/RELEASE-1.1.0.md) | 2026-07-16 | 提供商生命周期（可删 mock）；会话模型重绑 + identity pin |
| [1.0.10](./docs/RELEASE-1.0.10.md) | 2026-07-17 | HFQ-ClodBreeze 自签 + trust 包；React shell；thinking / DPAPI / D3 / PTY 后端列车 |
| [1.0.9](./docs/RELEASE-1.0.9.md) | 2026-07-15 | 远程 Skills 包（zip/tar.gz）；权限弹窗超时与队列 |
| [1.0.8](./docs/RELEASE-1.0.8.md) | 2026-07-15 | 顶栏提供方/模型；作曲栏仅模型名；菜单向上弹出 |
| [1.0.7](./docs/RELEASE-1.0.7.md) | 2026-07-15 | 更新检查多源回退（镜像 → ungh → 直连） |
| [1.0.6](./docs/RELEASE-1.0.6.md) | 2026-07-15 | Skills 预览/冲突/标签；`/goal` 横幅 |
| [1.0.5](./docs/RELEASE-1.0.5.md) | 2026-07-15 | 更新检查直连回退；Skills 商店脚手架 |
| [1.0.4](./docs/RELEASE-1.0.4.md) | 2026-07-14 | `/goal` 长任务；默认 ghproxy 更新检查 |
| [1.0.3](./docs/RELEASE-1.0.3.md) | 2026-07-14 | Chat UI 抛光（ZCode 风格作曲栏） |
| [1.0.2](./docs/RELEASE-1.0.2.md) | 2026-07-14 | 访问模式；图标戳记；更新检查 |
| [1.0.1](./docs/RELEASE-1.0.1.md) | 2026-07-14 | Logo / 身份 / 数据目录隔离 |
| [1.0.0](./docs/RELEASE-1.0.0.md) | 2026-07-14 | 首个正式版 + CI/CD |

## 已冻结决策

| 主题 | 选择 |
|------|------|
| Shell | Electron + TypeScript |
| 运行时 | TypeScript agent-core（Python brain 可选后续） |
| 场景 | 编程智能体优先 |
| 兼容 | Skills S1+轻量 S2、自有配置 + 导入向导、MCP |
| Phase-1 UI | Session/Diff/Terminal、Skills、MCP、Tasks、Models、Permissions/Audit |

细节：[docs/DECISIONS.md](./docs/DECISIONS.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [docs/COMPAT.md](./docs/COMPAT.md) · [docs/PRODUCT.md](./docs/PRODUCT.md) · [docs/NAMING.md](./docs/NAMING.md) · [docs/BETA.md](./docs/BETA.md) · [docs/PHASE2.md](./docs/PHASE2.md) · [docs/PHASE3.md](./docs/PHASE3.md) · [docs/AUDIT.md](./docs/AUDIT.md)

## Monorepo

```text
apps/desktop          Electron 应用
packages/*            agent-core, tools, skills, mcp, memory, providers, ...
docs/                 产品与架构
skills/bundled        随包 Skills
scripts/              eval 等脚本
```

## 开发（安装依赖后）

```bash
pnpm install
pnpm -r run build
pnpm test
pnpm smoke
pnpm eval
pnpm dev:desktop
```

要求：Node.js 22+、pnpm 9+。

### 打包（Windows）

```bash
pnpm release:check                         # build + test + smoke + eval
pnpm pack:verify                           # 解包目录冒烟断言
pnpm pack:win                              # NSIS + portable
```

产物在 `apps/desktop/release/`。更新策略：**手动** 下载/安装 — 见 [docs/PACKAGING.md](./docs/PACKAGING.md)。

### CI / CD

| Workflow | 时机 | 内容 |
|----------|------|------|
| **CI** | push / PR → `main` | `pnpm release:check`（Windows） |
| **Release** | tag `v*` | 打包 NSIS + portable → GitHub Release |
| **Pack verify** | 每周 / 手动 | `pnpm pack:verify` |

```bash
git tag -a v1.1.3 -m "HFQ Code 1.1.3"
git push origin v1.1.3   # 触发 Release workflow
```

### 桌面试用

1. `pnpm dev:desktop`
2. 打开工作区 → 选择本仓库
3. 会话 → 新建会话
4. 浏览 **记忆 / 用量 / 导入**；Chat 工具栏计划模式 + 子智能体
5. 工具：`list` / `read` / `git status` / write（需批准）/ MCP / shell

## 许可证

待定
