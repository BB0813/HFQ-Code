/**
 * Settings page HTML (R1). Pure render; handlers stay in app.js.
 * window.HFQSettingsUI.render(ctx)
 */
(function (global) {
  /**
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   statusLabel: (s: string) => string,
   *   formatSessionTime: (t: any) => string,
   *   normalizePermissionMode: (m: string) => string,
   *   permissionModes: Array<{ id: string, label: string, warn?: boolean }>,
   *   formatUpdateStatus: (result: any, currentVersionFallback?: string) => string,
   *   renderUpdateAssetsHtml: (result: any) => string,
   *   state: any,
   * }} ctx
   */
  function render(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const state = ctx.state;
    const paths = state.appPaths || {};
    const prefs = state.config?.prefs || {
      theme: "dark",
      proxyUrl: "",
      memoryEnabled: true,
      compactMaxChars: 48000,
      usageInputPerMillion: 0,
      usageOutputPerMillion: 0,
      planModeDefault: false,
      permissionMode: "confirm_before_change",
      checkUpdatesOnStartup: true,
      updateSource: "ghproxy",
      updateProxyBase: "https://ghproxy.com/",
    };
    const updateSource = prefs.updateSource === "direct" ? "direct" : "ghproxy";
    const updateProxyBase = prefs.updateProxyBase || "https://ghproxy.com/";
    const prefPermissionMode = ctx.normalizePermissionMode(
      prefs.permissionMode || (prefs.planModeDefault ? "plan" : "confirm_before_change"),
    );
    const prefModeOptions = (ctx.permissionModes || [])
      .map(
        (m) =>
          `<option value="${m.id}" ${prefPermissionMode === m.id ? "selected" : ""}>${escapeHtml(
            m.label,
          )}${m.warn ? " ⚠" : ""}</option>`,
      )
      .join("");
    const encLabel = {
      missing: "文件缺失",
      plaintext: "明文 JSON",
      "dpapi-current-user": "DPAPI (CurrentUser)",
      unknown: "未知",
    };
    const encRaw = paths.credentialsEncoding || "unknown";
    const encText = encLabel[encRaw] || String(encRaw);
    const dpapiText =
      paths.credentialsDpapi === true
        ? "启用（保存时加密）"
        : paths.credentialsDpapi === false
          ? "关闭（明文保存）"
          : "—";
    const pathDefs = [
      ["数据根目录", paths.root || "%APPDATA%/HFQ-Code", paths.root, "dir"],
      ["会话 JSONL", paths.sessions || "…/sessions", paths.sessions, "dir"],
      ["技能目录", paths.skills || "…/skills", paths.skills, "dir"],
      [
        "记忆笔记",
        paths.memoryPath || paths.memory || "…/memory/notes.json",
        paths.memory || paths.memoryPath,
        "dir",
      ],
      ["配置文件", paths.configPath || "…/config.json", paths.configPath, "file"],
      ["密钥文件", paths.credentialsPath || "…/credentials.json", paths.credentialsPath, "file"],
      ["密钥编码", encText, null, null],
      ["DPAPI 写入", dpapiText, null, null],
      ["工作区", state.workspacePath || "(未绑定)", state.workspacePath, "dir"],
      ["平台", paths.platform || "win32", null, null],
      ["用户主目录", paths.homedir || "", paths.homedir, "dir"],
      ["应用版本", paths.version || "1.0.0", null, null],
    ];
    const pathHtml = pathDefs
      .map(([label, value, openTarget]) => {
        const openBtn = openTarget
          ? `<button type="button" class="btn ghost sm" data-open-path="${escapeHtml(
              String(openTarget),
            )}">打开</button>`
          : "";
        return `<div class="path-row">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(value || "—")}</div>
        <div class="path-actions">${openBtn}</div>
      </div>`;
      })
      .join("");

    const provider = state.config?.activeProviderId || "mock";
    const model = state.config?.activeModel || "mock-hfq";
    const sessionMeta = state.session
      ? `${state.session.id.slice(0, 8)} · ${ctx.statusLabel(state.session.status)} · ${escapeHtml(
          state.session.title || "",
        )}`
      : "无活动会话";
    const sessions = state.recentSessions || [];
    const sessionManage = sessions.length
      ? sessions
          .slice(0, 10)
          .map((s) => {
            const title = s.title || s.id.slice(0, 8);
            return `<div class="session-item">
            <button type="button" class="session-item-main" data-open-session="${escapeHtml(s.id)}">
              <div>
                <div class="title">${escapeHtml(title)}</div>
                <div class="meta">${escapeHtml(s.id.slice(0, 8))} · ${escapeHtml(
                  ctx.statusLabel(s.status),
                )} · ${escapeHtml(ctx.formatSessionTime(s.updatedAt))}</div>
              </div>
              <span class="badge info">打开</span>
            </button>
            <div class="session-actions">
              <button type="button" class="btn ghost sm" data-rename-session="${escapeHtml(
                s.id,
              )}" data-session-title="${escapeHtml(title)}">改名</button>
              <button type="button" class="btn ghost sm session-delete" data-delete-session="${escapeHtml(
                s.id,
              )}">删除</button>
            </div>
          </div>`;
          })
          .join("")
      : `<div class="empty-state" style="padding:14px 8px"><p>暂无历史会话</p></div>`;

    return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>设置</h2>
          <p>本机路径、偏好、会话管理与运行摘要</p>
        </div>
        <button type="button" class="btn ghost sm" id="settingsRefreshBtn">刷新</button>
      </div>
      ${paths.error ? `<p class="form-status">${escapeHtml(paths.error)}</p>` : ""}
      <div class="path-grid">${pathHtml}</div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <h2>偏好</h2>
          <p>主题、代理与上下文压缩（写入 config.json）</p>
        </div>
        <button type="button" class="btn sm" id="prefsSaveBtn">保存偏好</button>
      </div>
      <div class="grid-2">
        <label class="field"><span>主题</span>
          <select id="prefTheme">
            <option value="dark" ${prefs.theme === "dark" ? "selected" : ""}>深色</option>
            <option value="light" ${prefs.theme === "light" ? "selected" : ""}>浅色</option>
          </select>
        </label>
        <label class="field"><span>HTTP 代理（可选）</span>
          <input id="prefProxy" type="text" placeholder="http://127.0.0.1:7890" value="${escapeHtml(
            prefs.proxyUrl || "",
          )}" />
        </label>
        <label class="field"><span>上下文压缩阈值（字符）</span>
          <input id="prefCompact" type="number" min="8000" max="200000" step="1000" value="${escapeHtml(
            String(prefs.compactMaxChars || 48000),
          )}" />
        </label>
        <label class="field row" style="align-items:center;gap:10px;margin-top:22px">
          <input id="prefMemory" type="checkbox" ${prefs.memoryEnabled !== false ? "checked" : ""} />
          <span>将会话提示注入本机记忆笔记</span>
        </label>
        <label class="field"><span>默认访问模式</span>
          <select id="prefPermissionMode">${prefModeOptions}</select>
        </label>
        <p class="faint" style="grid-column:1/-1;margin:0">完全访问会自动允许危险 Shell（如删除命令），仅在你信任工作区时使用。会话工具栏可临时切换，不影响默认值。</p>
        <label class="field"><span>用量单价 · Input $/1M</span>
          <input id="prefInPrice" type="number" min="0" step="0.01" value="${escapeHtml(
            String(prefs.usageInputPerMillion ?? 0),
          )}" />
        </label>
        <label class="field"><span>用量单价 · Output $/1M</span>
          <input id="prefOutPrice" type="number" min="0" step="0.01" value="${escapeHtml(
            String(prefs.usageOutputPerMillion ?? 0),
          )}" />
        </label>
      </div>
      <p class="faint" style="margin-top:10px">代理字段已持久化；模型请求是否走代理取决于运行时环境变量（HTTP_PROXY/HTTPS_PROXY）。记忆：memory_search / memory_save · 子代理：spawn_subagent。</p>
      <p class="form-status" id="prefsStatus"></p>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <h2>检查更新</h2>
          <p>查询 GitHub Releases 最新版；默认经 <strong>ghproxy</strong>，失败时自动回退备用镜像 / ungh / 直连。仅提示/打开下载页，不会自动安装</p>
        </div>
        <div class="row" style="gap:6px">
          <button type="button" class="btn sm" id="updateCheckBtn">检查新版本</button>
          <button type="button" class="btn sm primary" id="updateOpenBtn">打开发布页</button>
        </div>
      </div>
      <div class="form-grid" style="margin:4px 0 8px">
        <label class="field"><span>更新源</span>
          <select id="prefUpdateSource">
            <option value="ghproxy" ${updateSource === "ghproxy" ? "selected" : ""}>ghproxy 镜像（推荐）</option>
            <option value="direct" ${updateSource === "direct" ? "selected" : ""}>直连 api.github.com</option>
          </select>
        </label>
        <label class="field"><span>ghproxy 基址</span>
          <input id="prefUpdateProxyBase" type="url" placeholder="https://ghproxy.com/" value="${escapeHtml(
            updateProxyBase,
          )}" />
        </label>
      </div>
      <p class="faint" style="margin:0 0 8px">API 请求形态：<code>{基址}https://api.github.com/repos/BB0813/HFQ-Code/releases/latest</code>。若 <code>ghproxy.com</code> 返回 HTML，程序会自动换源；也可把基址改成 <code>https://gh-proxy.com/</code> 后点「保存更新源」。</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" class="btn sm ghost" id="updateSourceSaveBtn">保存更新源</button>
        <label class="field row" style="align-items:center;gap:10px;margin:0">
          <input id="prefCheckUpdates" type="checkbox" ${
            prefs.checkUpdatesOnStartup !== false ? "checked" : ""
          } />
          <span>启动时自动检查（有新版本才提示）</span>
        </label>
      </div>
      <p class="form-status" id="updateStatus">${escapeHtml(
        ctx.formatUpdateStatus(state.updateCheck, paths.version),
      )}</p>
      ${ctx.renderUpdateAssetsHtml(state.updateCheck)}
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <h2>诊断与发版</h2>
          <p>导出脱敏配置与会话索引；安装包见 <code>pnpm pack:win</code>（需本机 electron-builder）</p>
        </div>
        <button type="button" class="btn sm" id="diagExportBtn">导出诊断包</button>
      </div>
      <p class="form-status" id="diagStatus"></p>
      <div class="steps" style="margin-top:10px">
        <div class="step"><div class="step-n">1</div><div><strong>打包</strong><span><code>pnpm pack:win</code> → NSIS + portable（apps/desktop/release）</span></div></div>
        <div class="step"><div class="step-n">2</div><div><strong>更新策略</strong><span>设置页可检查 GitHub 新版本；手动下载 NSIS/portable 覆盖安装（无静默自动安装）</span></div></div>
        <div class="step"><div class="step-n">3</div><div><strong>校验</strong><span><code>pnpm release:check</code> · <code>pnpm pack:verify</code>（解包冒烟）</span></div></div>
        <div class="step"><div class="step-n">4</div><div><strong>签名</strong><span>SmartScreen 需代码签名证书（可选）</span></div></div>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <h2>工作区规则 · AGENTS.md</h2>
          <p>项目级 Agent 规则（工作区根目录）；保存后新回合会读入上下文</p>
        </div>
        <div class="row" style="gap:6px">
          <button type="button" class="btn sm ghost" id="agentsReloadBtn" ${
            state.workspacePath ? "" : "disabled"
          }>重新加载</button>
          <button type="button" class="btn sm primary" id="agentsSaveBtn" ${
            state.workspacePath ? "" : "disabled"
          }>保存</button>
        </div>
      </div>
      ${
        !state.workspacePath
          ? `<p class="faint">请先打开工作区</p>`
          : `<textarea id="agentsEditor" class="input" rows="12" style="width:100%;font-family:ui-monospace,monospace;font-size:12px;line-height:1.45;resize:vertical">${escapeHtml(
              state.agentsEditor?.content ?? "",
            )}</textarea>
          <p class="form-status" id="agentsStatus">${
            state.agentsEditor?.exists === false
              ? "文件尚不存在，保存将创建 AGENTS.md"
              : state.agentsEditor?.error
                ? escapeHtml(state.agentsEditor.error)
                : "已加载工作区 AGENTS.md"
          }</p>`
      }
    </div>
    <div class="grid-3" style="margin-top:14px">
      <div class="metric">
        <div class="metric-label">活动提供方</div>
        <div class="metric-value">${escapeHtml(provider)}</div>
        <div class="metric-meta">${escapeHtml(model)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">活动会话</div>
        <div class="metric-value">${state.session ? "已连接" : "无"}</div>
        <div class="metric-meta">${sessionMeta}</div>
      </div>
      <div class="metric">
        <div class="metric-label">历史会话</div>
        <div class="metric-value">${sessions.length}</div>
        <div class="metric-meta">磁盘 + 内存合并列表</div>
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <h2>会话管理</h2>
          <p>打开或删除 JSONL 转录（删除不可恢复）</p>
        </div>
        <span class="badge">${sessions.length}</span>
      </div>
      <div class="session-list">${sessionManage}</div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <h2>说明</h2>
          <p>敏感配置请在「模型」页管理；权限矩阵见「权限」页</p>
        </div>
      </div>
      <div class="steps">
        <div class="step"><div class="step-n">A</div><div><strong>会话持久化</strong><span>每条事件写入 JSONL，重启后可从首页恢复或在此删除</span></div></div>
        <div class="step"><div class="step-n">B</div><div><strong>变更回滚</strong><span>「变更」页可全部或按块接受，或回滚到写入前内容</span></div></div>
        <div class="step"><div class="step-n">C</div><div><strong>工作区边界</strong><span>工具路径解析会拒绝逃逸出工作区根目录</span></div></div>
      </div>
    </div>`;
  }

  global.HFQSettingsUI = { render };
})(typeof window !== "undefined" ? window : globalThis);
