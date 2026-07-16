/**
 * Terminal page HTML — one-shot shell history (1.0) · PTY chrome later (1.1).
 * window.HFQTerminalPage.render(ctx)
 */
(function (global) {
  /**
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   icons?: Record<string, string>,
   *   state: any,
   * }} ctx
   */
  function render(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const state = ctx.state;
    const icons = ctx.icons || {};
    const blocks = state.terminal?.length
      ? state.terminal
          .map((t) => {
            const out = t.stdout ? `<div class="term-out">${escapeHtml(t.stdout)}</div>` : "";
            const err = t.stderr ? `<div class="term-err">${escapeHtml(t.stderr)}</div>` : "";
            return `<div class="term-block">
            <div class="term-cmd-row">
              <div class="term-cmd">${escapeHtml(t.command)}</div>
              <button type="button" class="btn sm ghost" data-rerun-shell="${escapeHtml(
                t.command,
              )}" ${state.busy || !state.session ? "disabled" : ""}>送回会话</button>
              <button type="button" class="btn sm" data-run-shell="${escapeHtml(
                t.command,
              )}" ${!state.workspacePath ? "disabled" : ""}>直跑</button>
            </div>
            ${out}${err}
            <div class="term-meta">${t.ok ? "成功" : "失败"} · exit ${t.code ?? "?"} · ${escapeHtml(
              String(t.at || "").replace("T", " ").slice(0, 19),
            )}</div>
          </div>`;
          })
          .join("")
      : `<div class="empty-state"><div class="empty-icon">${icons.terminal || ""}</div>
          <h3>尚无终端输出</h3>
          <p>在下方运行工作区内命令（一次性）。交互式 PTY 见 1.1 预研 · 布局挂载点随方案 A/B/C 而定。</p>
        </div>`;

    return `<div class="term-layout">
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>会话终端</h2>
          <p>工作区一次性命令 · 「直跑」不经模型 · 「送回会话」走 Agent shell · PTY 预研中</p>
        </div>
        <span class="badge">${state.terminal?.length || 0}</span>
      </div>
      <div class="row" style="gap:8px;margin-top:10px;align-items:stretch">
        <input id="termCommandInput" class="input" type="text" placeholder="例如: echo HFQ-Code  或  git status" value="${escapeHtml(
          state.terminalDraft || "",
        )}" style="flex:1" ${!state.workspacePath ? "disabled" : ""} />
        <button type="button" class="btn primary sm" id="termRunBtn" ${
          !state.workspacePath ? "disabled" : ""
        }>运行</button>
      </div>
    </div>
    <div class="term-log">${blocks}</div>
  </div>`;
  }

  global.HFQTerminalPage = { render };
})(typeof window !== "undefined" ? window : globalThis);
