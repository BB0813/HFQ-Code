/**
 * Home / resume workbench (R8.3 visual pass from live screenshot).
 * Hierarchy: one primary action · flat status · lists without nested chrome.
 * Keeps all bindable IDs / data-* attributes.
 */
(function (global) {
  function pathEquals(a, b) {
    return (
      String(a || "")
        .replaceAll("/", "\\")
        .toLowerCase() ===
      String(b || "")
        .replaceAll("/", "\\")
        .toLowerCase()
    );
  }

  /**
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   shortPath: (p: string) => string,
   *   statusLabel: (s: string) => string,
   *   formatSessionTime: (t: any) => string,
   *   activeGoalTask?: (tasks: any[]) => any | null,
   *   state: any,
   * }} ctx
   */
  function render(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const shortPath = ctx.shortPath;
    const state = ctx.state;
    const ws = state.workspacePath;
    const provider = state.config?.activeProviderId || "mock";
    const model = state.config?.activeModel || "mock-hfq";
    const sessions = state.recentSessions || [];
    const goal =
      (ctx.activeGoalTask || global.HFQSkillsUI?.activeGoalTask)?.(state.tasks) || null;

    const resumeCard = (() => {
      if (goal) {
        const title = String(goal.title || "goal").replace(/^goal:\s*/i, "");
        return `<div class="resume-card resume-card-goal">
          <div class="resume-kicker">进行中的目标</div>
          <div class="resume-title">${escapeHtml(title)}</div>
          <p class="resume-meta">${escapeHtml(goal.detail || "长运行进行中")}</p>
          <div class="resume-actions">
            <button type="button" class="btn primary sm" id="homeResumeGoalBtn">回到会话</button>
            <button type="button" class="btn ghost sm" id="homeGoTasks">任务</button>
          </div>
        </div>`;
      }
      if (state.session?.id) {
        const title = state.session.title || state.session.id.slice(0, 8);
        return `<div class="resume-card">
          <div class="resume-kicker">当前会话</div>
          <div class="resume-title">${escapeHtml(title)}</div>
          <p class="resume-meta">${escapeHtml(statusLabelSafe(ctx, state.session.status))} · ${escapeHtml(
          state.session.id.slice(0, 8),
        )}</p>
          <div class="resume-actions">
            <button type="button" class="btn primary sm" id="homeGoSession">继续会话</button>
          </div>
        </div>`;
      }
      if (sessions[0]) {
        const s = sessions[0];
        const title = s.title || s.id.slice(0, 8);
        return `<div class="resume-card">
          <div class="resume-kicker">最近可恢复</div>
          <div class="resume-title">${escapeHtml(title)}</div>
          <p class="resume-meta">${escapeHtml(statusLabelSafe(ctx, s.status))} · ${escapeHtml(
          ctx.formatSessionTime(s.updatedAt),
        )}</p>
          <div class="resume-actions">
            <button type="button" class="btn primary sm" data-open-session="${escapeHtml(s.id)}">恢复此会话</button>
            <button type="button" class="btn ghost sm" id="homeGoSession" ${ws ? "" : "disabled"}>新建会话</button>
          </div>
        </div>`;
      }
      return `<div class="resume-card resume-card-empty">
        <div class="resume-kicker">开始工作</div>
        <div class="resume-title">${ws ? "新建一次编码会话" : "先绑定项目文件夹"}</div>
        <p class="resume-meta">${
          ws
            ? "在会话页创建会话后，可让智能体读改代码并审阅差异。"
            : "工具调用限制在工作区根目录内；危险 shell 默认先确认。"
        }</p>
        <div class="resume-actions">
          ${
            ws
              ? `<button type="button" class="btn primary sm" id="homeGoSession">进入会话</button>`
              : `<button type="button" class="btn primary sm" id="homeOpenWs">打开工作区</button>
                 <button type="button" class="btn ghost sm" id="homeGoSession" disabled>进入会话</button>`
          }
        </div>
      </div>`;
    })();

    const sessionRows = sessions.length
      ? sessions
          .slice(0, 12)
          .map((s) => {
            const active = state.session?.id === s.id ? "active" : "";
            const title = s.title || s.id.slice(0, 8);
            const meta = `${statusLabelSafe(ctx, s.status)} · ${ctx.formatSessionTime(s.updatedAt)}`;
            const wsHint = s.workspacePath ? shortPath(s.workspacePath) : "";
            return `<div class="session-item ${active}">
            <button type="button" class="session-item-main" data-open-session="${escapeHtml(s.id)}">
              <div class="session-item-copy">
                <div class="title">${escapeHtml(title)}</div>
                <div class="meta">${escapeHtml(meta)}${wsHint ? ` · ${escapeHtml(wsHint)}` : ""}</div>
              </div>
            </button>
            <div class="session-actions">
              <button type="button" class="btn ghost sm" data-rename-session="${escapeHtml(
                s.id,
              )}" data-session-title="${escapeHtml(title)}" title="重命名">改名</button>
              <button type="button" class="btn ghost sm session-delete" data-delete-session="${escapeHtml(
                s.id,
              )}" title="删除会话转录">删除</button>
            </div>
          </div>`;
          })
          .join("")
      : `<div class="list-empty">暂无历史会话 · 创建后会写入本地转录</div>`;

    const recentWs = state.config?.recentWorkspaces || [];
    const wsRows = recentWs.length
      ? recentWs
          .slice(0, 8)
          .map((p) => {
            const active = ws && pathEquals(ws, p) ? "active" : "";
            return `<button type="button" class="session-item session-item-ws ${active}" data-open-workspace="${escapeHtml(
              p,
            )}">
            <div class="session-item-copy">
              <div class="title">${escapeHtml(shortPath(p))}</div>
              <div class="meta mono">${escapeHtml(p)}</div>
            </div>
            <span class="session-item-hint">${active ? "当前" : "打开"}</span>
          </button>`;
          })
          .join("")
      : `<div class="list-empty">暂无最近工作区</div>`;

    return `
    <div class="home-hero">
      <div class="panel home-resume-panel">
        <div class="panel-head panel-head-plain">
          <div>
            <h2>继续工作</h2>
            <p>从上次会话或目标直接接上</p>
          </div>
        </div>
        ${resumeCard}
      </div>
      <div class="panel home-status-panel">
        <div class="panel-head panel-head-plain">
          <div>
            <h2>状态</h2>
            <p>本地工作台摘要</p>
          </div>
        </div>
        <dl class="status-strip">
          <div class="status-strip-row">
            <dt>工作区</dt>
            <dd>
              <strong>${ws ? "已绑定" : "未绑定"}</strong>
              <span class="meta mono">${escapeHtml(ws ? shortPath(ws) : "选择项目目录")}</span>
            </dd>
          </div>
          <div class="status-strip-row">
            <dt>模型</dt>
            <dd>
              <strong class="mono">${escapeHtml(provider)}</strong>
              <span class="meta mono">${escapeHtml(model)}</span>
            </dd>
          </div>
          <div class="status-strip-row">
            <dt>会话</dt>
            <dd>
              <strong>${state.session ? "进行中" : "待命"}</strong>
              <span class="meta mono">${
                state.session ? escapeHtml(state.session.id.slice(0, 8)) : "尚未创建"
              }</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
    <div class="home-split">
      <div class="panel">
        <div class="panel-head panel-head-plain">
          <div>
            <h2>最近工作区</h2>
            <p>${recentWs.length} 条</p>
          </div>
        </div>
        <div class="session-list">${wsRows}</div>
      </div>
      <div class="panel">
        <div class="panel-head panel-head-plain">
          <div>
            <h2>最近会话</h2>
            <p>${sessions.length} 条</p>
          </div>
          <button type="button" class="btn ghost sm" id="homeRefreshSessions">刷新</button>
        </div>
        <div class="session-list">${sessionRows}</div>
      </div>
    </div>`;
  }

  function statusLabelSafe(ctx, s) {
    return ctx.statusLabel ? ctx.statusLabel(s) : s || "空闲";
  }

  global.HFQHomePage = { render, pathEquals };
})(typeof window !== "undefined" ? window : globalThis);
