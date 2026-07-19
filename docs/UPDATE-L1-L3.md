# HFQ Code · 应用内更新阶梯（L0 → L3）

> 状态：**产品已锁定** — **最迟 1.1.8 交付完整 L3**  
> 基线：1.1.6 shipped（D3：检查 / 手动下载 / 确认后 `shell.openPath` 打开安装包）  
> 相关：`docs/UPDATE-D3.md` · `docs/PACKAGING.md` · `docs/DECISIONS.md` Q9  
> 实现交接：`docs/prompts/1.1.7-handoff.md`（L1+L2）· `docs/prompts/1.1.8-l3-handoff.md`（L3）

---

## 0. 目标一句话

在**不换成 electron-updater 静默替换内核**的前提下，把现有 D3 管道做成：

**检查 →（可选）后台下载 → 就绪 → 用户确认或已授权的自动安装 → 退出旧进程 → NSIS 升级 → 拉起新版本**。

| 版本 | 必须达到 |
|------|----------|
| **1.1.7** | **L1 + L2** 完整可用（引导式全自动到「点一下装」） |
| **1.1.8（最迟）** | **完整 L3**（可选静默/自动安装升级，含 opt-in 与失败恢复） |

---

## 1. 档位定义（验收用语）

| 档 | 名称 | 检查 | 下载 | 安装 | 用户确认 |
|----|------|------|------|------|----------|
| **L0** | 手动 | 手动 / 启动通知 | 手动点下载 | `openPath` 向导 | 每次安装确认 |
| **L1** | 后台预下载 | 启动 + 间隔 | **自动**（策略开） | 仍手动 | 安装仍确认 |
| **L2** | 一键安装 | 同 L1 | 同 L1 | 就绪后 **一键** `installUpdate` | **至少一次**明确确认（可记住本版本） |
| **L3** | 自动安装 | 同 L1 | 同 L1 | **无安装向导 UI**：退出后 **NSIS 静默/半静默升级** | **首次 opt-in**；之后可无人值守（UAC 仍可能由系统弹出） |

**L3 不是**：无签名、无 allowlist、任意 URL 拉 exe 静默执行。  
**L3 是**：在 D3 安全边界内，对**已下载且校验过的** GitHub Release 安装包，在用户**明确授权**后自动完成替换升级。

---

## 2. 明确不做（全程）

| 项 | 原因 |
|----|------|
| 默认打开 silentInstall | 信任与误升风险；**default false** |
| 换 electron-updater / Squirrel 全盘重写 | 与自签、镜像链、现 D3 沙箱冲突大；L3 在现管道上延伸 |
| Portable 与 NSIS 同一套静默替换 | Portable **禁用 L3 自动装**（仅 L0–L2 或提示去 NSIS 通道） |
| 差分 delta 包 | 1.1.8 不做 |
| 绕过 host allowlist / updates 目录 | 永不放宽 |

---

## 3. 配置契约（`prefs.updatePolicy`）

```ts
prefs.updatePolicy?: {
  /** 启动/间隔检查。default true（对齐现 checkUpdatesOnStartup） */
  autoCheck?: boolean;
  /** 发现新版本后后台下载。default false → 1.1.7 起 Settings 可开；安装版可产品默认 true */
  autoDownload?: boolean;
  /** 检查间隔小时。default 24；与现 6h throttle 协调，取合理下限 */
  checkIntervalHours?: number;
  /**
   * L3：下载就绪后允许自动静默安装升级。
   * default false。开启前必须 Settings 二次确认文案。
   * 1.1.7 可出现字段但行为 no-op 或隐藏；1.1.8 必须生效。
   */
  silentInstall?: boolean;
  /** 用户同意 silentInstall 的时间 ISO（审计/展示） */
  silentInstallAcceptedAt?: string | null;
}
```

兼容：

- 现有 `prefs.updateSource` / `updateProxyBase` / `checkUpdatesOnStartup` **保留**  
- `checkUpdatesOnStartup === false` 时尊重，不强制 autoCheck  

---

## 4. 状态机（主进程单一真相）

```
idle
 → checking
 → up_to_date | available
 → downloading          (L1+)
 → ready                (本地 exe + 可选 sha256)
 → confirming           (L2 UI / dialog)
 → scheduling_install   (L3: 写 marker + quit)
 → installing           (spawn NSIS)
 → failed | cancelled
```

事件（可合并进现有 `update:download` 或新增 `update:state`）：

- `status`, `version?`, `percent?`, `filePath?`, `error?`, `mode?: "manual"|"auto"|"silent"`

---

## 5. 1.1.7 — L1 + L2（必须）

### L1 后台预下载

1. 启动 silent check（已有）后：若 `autoDownload && updateAvailable` 且本地无**同版本**完整包 → `downloadUpdate`  
2. 间隔：`checkIntervalHours`（默认 24）+ 现有 throttle 不打爆 API  
3. 无网 / 检查失败：静默记日志 + Settings 可显示上次错误，**不弹死循环**  
4. 下载仍走 `UpdateDownloader`：HTTPS、allowlist、`userData/updates`、体积上限  

### L2 一键安装

1. Settings / 全局条：状态 **「vX.Y.Z 已就绪」** + 按钮 **安装更新**  
2. `installUpdate`：确认框（可 `confirm:false` 若 UI 已确认）→ `shell.openPath`（**1.1.7 仍用向导路径**）  
3. `quitSuggested: true`；UI 可提供「安装后退出」  
4. 可选：`prefs` 记住「本版本已提示过」减少重复 toast，**不**等于 L3  

### 1.1.7 验收

- [ ] 关 autoDownload：行为 ≈ 1.1.6  
- [ ] 开 autoDownload：有新版本则后台下完 → ready  
- [ ] 一点安装：确认 → 打开 NSIS → 可升级  
- [ ] 进度 / 取消 / 失败中文  
- [ ] `silentInstall` 即使写入也 **不** 自动装（留给 1.1.8）  

---

## 6. 1.1.8 — 完整 L3（最迟必须）

### 6.1 产品语义

用户在 Settings 打开 **「下载完成后自动安装更新」**（`silentInstall`）：

1. 展示风险说明：将退出应用、使用已下载安装包静默升级、自签/SmartScreen/UAC 可能仍出现  
2. 二次确认（checkbox 或独立 Confirm）→ 写入 `silentInstall: true` + `silentInstallAcceptedAt`  
3. 之后当状态进入 **ready** 且 channel 为 **NSIS 安装版**（非 portable 运行）：  
   - **立即**：提供「马上安装并重启」；或  
   - **空闲策略**（可选）：空闲 N 分钟 / 下次退出时自动 schedule  
4. **默认推荐路径**：「马上安装并重启」= 写 marker → `app.quit()` → 分离进程拉起安装包  

### 6.2 技术路径（仍基于 D3 文件，不引入 electron-updater）

当前 1.1.6：`shell.openPath(exe)` → 交互式向导。  

L3 改为（概念）：

```text
1. 校验 filePath ∈ updates/ 且 .exe
2. 可选：对照 Release asset 的 size / SHA256SUMS（有则校验，无则跳过但记 warning）
3. 写 %userData%/updates/pending-install.json
   { version, filePath, scheduledAt, mode: "silent" }
4. app.quit()（尽量 flush session）
5. 分离进程（detached）：
   - 优先：spawn installer with electron-builder NSIS silent 兼容参数
     例：`HFQ Code-1.1.8-x64.exe /S` （以实际 NSIS 为准；需在 1.1.8 实现时用真包装验证）
   - perMachine + elevation：允许 **一次 UAC**（算 OS 边界，不算产品「安装确认框」）
6. 安装成功后 NSIS `runAfterFinish` 或显式 start 新 `HFQ Code.exe`
7. 新版本启动：读 pending marker → 成功则清 marker + toast「已更新到 x.y.z」；
   失败则保留 marker + Settings 红字 + 回退「打开安装包」L2 路径
```

**实现注意：**

| 点 | 要求 |
|----|------|
| 旧进程锁文件 | 必须先 quit 再装，避免 NSIS 覆盖失败 |
| 参数 | 以 electron-builder 生成的 NSIS 实测为准；文档化最终 flags |
| 失败 | 任何 spawn 失败 → 不死循环；回退 L2 `openPath` |
| Portable | `silentInstall` UI 禁用或强制 false + 说明 |
| 并发 | downloading 时不 schedule install |

### 6.3 L3 验收（1.1.8 发布门槛）

- [ ] `silentInstall=false`：永不自动装（回归 L1/L2）  
- [ ] 首次开启必须二次确认并写入 `silentInstallAcceptedAt`  
- [ ] ready + silentInstall → 「马上安装并重启」可完成 **无 NSIS 向导页** 的升级（UAC 可有）  
- [ ] 升级后数据目录 `%APPDATA%/HFQ-Code` 保留（config/sessions）  
- [ ] 新版本号 StatusBar / Settings 正确  
- [ ] 失败可从 Settings 手动 L2 安装  
- [ ] 安全：路径沙箱 / allowlist / 无任意路径安装  
- [ ] 自动化或半自动测：至少 mock spawn + pending marker 单测；真包手工冒烟一条  
- [ ] 文档：`UPDATE-D3.md` 或本文件标注 L3 shipped；`PACKAGING.md` 删除「禁止一切自动装」的绝对表述，改为「默认关闭 + opt-in L3」  

---

## 7. UI 草图（Settings · 更新卡片）

```
当前版本 1.1.7
状态：已就绪 1.1.8 · 下载完成
[ 立即检查 ]  [ 安装更新 ]  [ 安装并重启 ]   ← L2 / L3

[x] 自动检查更新
[x] 有新版本时后台下载          ← L1
[ ] 下载完成后自动安装更新      ← L3 opt-in（1.1.8 生效；1.1.7 可灰显「下版」）
    需确认：将退出应用并静默运行已下载的安装包…
来源：ghproxy | direct
```

全局：StatusBar 小点或 toast「更新已就绪」。

---

## 8. 安全与签名

- 继续 **HFQ-ClodBreeze 自签**；不承诺消灭 SmartScreen  
- L3 静默装 **不** 等于绕过 SmartScreen/UAC  
- 若未来上 OV/EV，L3 体验会更好，但 **1.1.8 不以 OV 为前置**  
- Release 资产继续发 SHA256SUMS；L3 有 SUMS 则优先校验  

---

## 9. 列车切分

| 版本 | 交付 | Prompt |
|------|------|--------|
| **1.1.7** | L1+L2 + `updatePolicy` 字段（含 silentInstall 占位） | `docs/prompts/1.1.7-handoff.md` |
| **1.1.8** | 完整 L3 + 文档/PACKAGING 决策落地 | `docs/prompts/1.1.8-l3-handoff.md` |

**禁止**：1.1.7 声称 L3 完成；1.1.8 再砍掉 silent 路径只做 openPath。

---

## 10. 风险（已知）

| 风险 | 缓解 |
|------|------|
| NSIS `/S` 与 `oneClick:false` 行为差异 | 1.1.8 用真包矩阵测；flags 写死进代码注释与本文 |
| perMachine UAC | 文案说明；失败回退 L2 |
| 用户正在跑 agent turn | 安装前若 running → 提示先停；L3 schedule 可延到 idle/quit |
| 镜像劫持 | 维持 allowlist；优先 https GitHub/镜像 |

---

**产品钉死：最迟 tag `v1.1.8` 必须能演示完整 L3 升级故事。**
