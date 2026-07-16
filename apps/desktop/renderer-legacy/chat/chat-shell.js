/**
 * Chat shell HTML: toolbar + log host + composer (R1/R2).
 * Tool cards + windowed message list (R2).
 * window.HFQChatShell
 */
(function (global) {
  const DEFAULT_WINDOW = 80;

  function formatDetail(value, escapeHtml) {
    if (value == null || value === "") return "";
    if (typeof value === "string") return escapeHtml(value);
    try {
      return escapeHtml(JSON.stringify(value, null, 2));
    } catch {
      return escapeHtml(String(value));
    }
  }

  function detailPreview(value, max = 120) {
    let s = "";
    if (value == null) s = "";
    else if (typeof value === "string") s = value;
    else {
      try {
        s = JSON.stringify(value);
      } catch {
        s = String(value);
      }
    }
    s = String(s).replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  }

  /**
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   truncateLabel: (text: string, max?: number) => string,
   *   statusLabel: (s: string) => string,
   *   sessionStatusClass: () => string,
   *   permissionModeMeta: (mode: string) => { id: string, short: string, hint: string },
   *   renderGoalBannerHtml: () => string,
   *   renderMessagesHtml: () => string,
   *   renderSlashPaletteHtml: () => string,
   *   renderAccessModeMenuHtml: (mode: any, opts?: any) => string,
   *   renderModelMenuHtml: (provider: string, model: string) => string,
   *   icons?: Record<string, string>,
   *   roleLabel?: (role: string) => string,
   *   state: any,
   * }} ctx
   */
  function renderPage(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const truncateLabel = ctx.truncateLabel;
    const state = ctx.state;
    const provider = state.config?.activeProviderId || "mock";
    const model = state.session?.model || state.config?.activeModel || "mock-hfq";
    const rawTitle = state.session?.title || "";
    const title = rawTitle ? truncateLabel(rawTitle, 42) : state.session ? "未命名会话" : "未创建会话";
    const titleFull = rawTitle || title;
    const statusText = state.session
      ? ctx.statusLabel(state.session.status || "idle")
      : "无会话";
    const statusCls = ctx.sessionStatusClass();
    const usageText = `入 ${state.usage?.inputTokens || 0} · 出 ${state.usage?.outputTokens || 0}`;
    const mode = ctx.permissionModeMeta(state.permissionMode);
    const sessionIdShort = state.session?.id ? state.session.id.slice(0, 8) : "";

    return `
    <div class="chat-layout">
      <div class="chat-toolbar">
        <div class="chat-toolbar-left">
          <button type="button" class="btn primary sm" id="startSessionBtn">新建</button>
          <button type="button" class="btn ghost sm" id="stopSessionBtn" ${state.busy ? "" : "disabled"}>停止</button>
          <button type="button" class="btn ghost sm" id="clearChatBtn">清空</button>
          <button type="button" class="btn ghost sm" id="renameSessionBtn" ${
            state.session?.id ? "" : "disabled"
          }>重命名</button>
          <button type="button" class="btn ghost sm" id="spawnExploreBtn" ${
            state.session?.id && !state.busy ? "" : "disabled"
          }>子代理</button>
        </div>
        <div class="chat-toolbar-meta">
          <div class="session-meta-card" title="${escapeHtml(titleFull)}">
            <div class="pill session-status-pill ${statusCls}">
              <span class="dot"></span>
              <span id="sessionStatusLabel">${escapeHtml(statusText)}</span>
            </div>
            <div class="session-title-line" id="sessionTitleLabel">${escapeHtml(title)}</div>
            ${
              sessionIdShort
                ? `<span class="session-id mono" title="${escapeHtml(state.session.id)}">${escapeHtml(
                    sessionIdShort,
                  )}</span>`
                : ""
            }
            <span class="session-provider-chip" title="模型提供方">${escapeHtml(provider)}</span>
            <span class="session-model-chip mono" title="${escapeHtml(`${provider} / ${model}`)}">${escapeHtml(
              truncateLabel(model, 28),
            )}</span>
            <span class="faint mono" id="sessionUsage">${escapeHtml(usageText)}</span>
          </div>
        </div>
      </div>
      ${ctx.renderGoalBannerHtml()}
      <div id="chatLog" class="chat-log" data-chat-log="1">${ctx.renderMessagesHtml()}</div>
      <div class="composer-shell composer-shell-sticky" data-island="composer-focus">
        ${ctx.renderSlashPaletteHtml()}
        <textarea id="chatInput" placeholder="描述任务，或 /goal … · / 命令 · $ 技能" ${
          state.busy ? "disabled" : ""
        }></textarea>
        <div class="composer-bar">
          <div class="composer-controls">
            ${ctx.renderAccessModeMenuHtml(mode)}
            ${ctx.renderModelMenuHtml(provider, model)}
            <button type="button" class="btn ghost sm composer-ctl" id="slashToggleBtn" title="命令与技能" ${
              state.busy ? "disabled" : ""
            }>
              <span class="composer-ctl-value">/ 命令</span>
            </button>
          </div>
          <div class="composer-actions">
            <span class="composer-hint faint">Enter 发送</span>
            <button type="button" class="btn primary" id="sendBtn" ${state.busy ? "disabled" : ""}>发送</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  /**
   * @param {any} m
   * @param {(s: string) => string} escapeHtml
   * @param {(role: string) => string} roleLabel
   * @param {Set<string>} expandedIds
   * @param {number} index
   */
  function renderOneMessage(m, escapeHtml, roleLabel, expandedIds, index) {
    const role = m.role || "system";
    if (role === "tool") {
      return renderToolCard(m, escapeHtml, expandedIds, index);
    }
    const body = escapeHtml(m.text || "");
    return `<div class="msg ${role}${m.streaming ? " streaming" : ""}" data-msg-idx="${index}"><div class="msg-role">${escapeHtml(
      roleLabel(role),
    )}${m.name ? ` · ${escapeHtml(m.name)}` : ""}${
      m.streaming ? " · 输出中" : ""
    }</div><div class="msg-body">${body}</div></div>`;
  }

  /**
   * @param {any} m
   * @param {(s: string) => string} escapeHtml
   * @param {Set<string>} expandedIds
   * @param {number} index
   */
  function renderToolCard(m, escapeHtml, expandedIds, index) {
    const name = m.name || "tool";
    const callId = m.callId ? String(m.callId) : "";
    const key = callId || `idx-${index}`;
    const phase = m.phase || (String(m.text || "").startsWith("开始") ? "running" : "done");
    const ok = m.ok;
    const running = phase === "running";
    const failed = phase === "done" && ok === false;
    const statusBadge = running
      ? `<span class="badge info">运行中</span>`
      : failed
        ? `<span class="badge bad">失败</span>`
        : `<span class="badge ok">完成</span>`;
    const inputVal = m.input !== undefined ? m.input : phase === "running" ? m.detail : m.input;
    const outputVal =
      m.output !== undefined ? m.output : phase === "done" ? m.detail : undefined;
    // Legacy rows: single detail field without phase split.
    const legacyOnly =
      m.input === undefined && m.output === undefined && m.detail !== undefined
        ? m.detail
        : null;

    const hasBody =
      inputVal != null ||
      outputVal != null ||
      legacyOnly != null ||
      (m.text && !/^开始执行|^完成 |^失败 /.test(String(m.text)));

    const expanded = expandedIds.has(key) || (running && !expandedIds.has(`collapsed:${key}`));
    const previewSrc = outputVal ?? legacyOnly ?? inputVal ?? m.text ?? "";
    const preview = escapeHtml(detailPreview(previewSrc, 100));

    let bodyHtml = "";
    if (expanded && hasBody) {
      if (legacyOnly != null && inputVal == null && outputVal == null) {
        bodyHtml = `<div class="tool-card-section">
          <div class="tool-card-section-label">详情</div>
          <pre class="tool-card-pre mono">${formatDetail(legacyOnly, escapeHtml)}</pre>
        </div>`;
      } else {
        if (inputVal != null) {
          bodyHtml += `<div class="tool-card-section">
            <div class="tool-card-section-label">输入</div>
            <pre class="tool-card-pre mono">${formatDetail(inputVal, escapeHtml)}</pre>
          </div>`;
        }
        if (outputVal != null) {
          bodyHtml += `<div class="tool-card-section">
            <div class="tool-card-section-label">输出</div>
            <pre class="tool-card-pre mono">${formatDetail(outputVal, escapeHtml)}</pre>
          </div>`;
        }
      }
    } else if (hasBody && preview) {
      bodyHtml = `<div class="tool-card-preview faint mono">${preview}</div>`;
    }

    const titleLine = running
      ? `执行 ${name}`
      : failed
        ? `失败 ${name}`
        : `完成 ${name}`;

    return `<div class="msg tool tool-card${running ? " tool-running" : ""}${
      failed ? " tool-failed" : ""
    }" data-msg-idx="${index}" data-tool-key="${escapeHtml(key)}">
      <button type="button" class="tool-card-head" data-tool-toggle="${escapeHtml(
        key,
      )}" aria-expanded="${expanded ? "true" : "false"}">
        <span class="tool-card-caret">${expanded ? "▾" : "▸"}</span>
        <span class="tool-card-title mono">${escapeHtml(titleLine)}</span>
        ${statusBadge}
        ${callId ? `<span class="tool-card-id faint mono">${escapeHtml(callId.slice(0, 8))}</span>` : ""}
      </button>
      <div class="tool-card-body${expanded ? "" : " is-collapsed"}">${bodyHtml}</div>
    </div>`;
  }

  /**
   * Empty / message list HTML for #chatLog.
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   roleLabel: (role: string) => string,
   *   icons: Record<string, string>,
   *   messages: any[],
   *   expandedToolKeys?: Set<string> | string[],
   *   windowSize?: number,
   *   showAll?: boolean,
   * }} ctx
   */
  function renderMessagesHtml(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const roleLabel = ctx.roleLabel;
    const icons = ctx.icons || {};
    const messages = Array.isArray(ctx.messages) ? ctx.messages : [];
    const expandedIds = new Set(
      ctx.expandedToolKeys instanceof Set
        ? ctx.expandedToolKeys
        : Array.isArray(ctx.expandedToolKeys)
          ? ctx.expandedToolKeys
          : [],
    );
    const windowSize = Math.max(20, Number(ctx.windowSize) || DEFAULT_WINDOW);
    const showAll = !!ctx.showAll;

    if (!messages.length) {
      return `<div class="empty-state">
      <div class="empty-icon">${icons.chat || ""}</div>
      <h3>开始一次编码会话</h3>
      <p>打开工作区并创建会话后，可让智能体检查、编辑文件或执行命令。输入 <code>/</code> 打开命令；长运行目标用 <code>/goal …</code>（见任务页）。</p>
      <div class="chips" style="justify-content:center">
        <button type="button" class="chip" data-fill="/goal ">长运行 /goal</button>
        <button type="button" class="chip" data-fill="list">列出文件</button>
        <button type="button" class="chip" data-fill="read README.md">读取 README</button>
        <button type="button" class="chip" data-fill="write demo to hfq-demo.txt">写入演示文件</button>
      </div>
    </div>`;
    }

    const total = messages.length;
    const hidden = !showAll && total > windowSize ? total - windowSize : 0;
    const start = hidden;
    const slice = messages.slice(start);
    const olderBtn = hidden
      ? `<div class="chat-window-bar">
          <button type="button" class="btn ghost sm" id="chatShowOlderBtn" data-chat-show-older="1">
            显示更早 ${hidden} 条（共 ${total}）
          </button>
        </div>`
      : showAll && total > windowSize
        ? `<div class="chat-window-bar">
          <button type="button" class="btn ghost sm" id="chatShowRecentBtn" data-chat-show-recent="1">
            仅显示最近 ${windowSize} 条
          </button>
        </div>`
        : "";

    const rows = slice
      .map((m, i) => renderOneMessage(m, escapeHtml, roleLabel, expandedIds, start + i))
      .join("");
    return `${olderBtn}${rows}`;
  }

  global.HFQChatShell = {
    renderPage,
    renderMessagesHtml,
    DEFAULT_WINDOW,
  };
})(typeof window !== "undefined" ? window : globalThis);
