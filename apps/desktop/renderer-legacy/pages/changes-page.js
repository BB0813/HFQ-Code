/**
 * Changes multi-file review layout (R4).
 * window.HFQChangesPage.render(ctx)
 */
(function (global) {
  /**
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   kindLabel: (k: string) => string,
   *   formatSessionTime: (t: any) => string,
   *   renderDiffHtml: (change: any) => string,
   *   icons: Record<string, string>,
   *   state: any,
   * }} ctx
   */
  function render(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const state = ctx.state;
    const icons = ctx.icons || {};

    if (!state.changes.length) {
      return `<div class="panel"><div class="empty-state"><div class="empty-icon">${
        icons.changes || ""
      }</div><h3>还没有文件写入</h3><p>智能体写入文件后，这里会显示路径与行级 diff。可在会话中尝试 <code>write demo to hfq-demo.txt</code>。</p></div></div>`;
    }

    const q = String(state.changeFilter || "")
      .trim()
      .toLowerCase();
    const filtered = q
      ? state.changes.filter((c) => String(c.path || "").toLowerCase().includes(q))
      : state.changes;
    const selected =
      filtered.find((c) => c.path === state.selectedChangePath) ||
      filtered[0] ||
      state.changes[0];
    const acceptedN = state.changes.filter((c) => c.accepted && !c.rejected).length;
    const rejectedN = state.changes.filter((c) => c.rejected).length;
    const pendingN = state.changes.length - acceptedN - rejectedN;

    const list = filtered.length
      ? filtered
          .map((c) => {
            const active = c.path === selected.path ? "active" : "";
            let badgeClass = "info";
            let badgeText = ctx.kindLabel(c.kind);
            if (c.rejected) {
              badgeClass = "bad";
              badgeText = "已回滚";
            } else if (c.accepted) {
              badgeClass = "ok";
              badgeText = "已接受";
            }
            return `<button type="button" class="change-item ${active}" data-change-path="${escapeHtml(
              c.path,
            )}">
        <span class="path" title="${escapeHtml(c.path)}">${escapeHtml(c.path)}</span>
        <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      </button>`;
          })
          .join("")
      : `<div class="empty-state" style="padding:12px"><p>无匹配路径</p></div>`;

    const note = state.changeActionNote
      ? `<div class="change-note">${escapeHtml(state.changeActionNote)}</div>`
      : "";
    const locked = selected.rejected;
    const acceptLabel = selected.accepted ? "已接受" : "全部接受";

    return `<div class="change-layout change-layout-review">
      <div class="panel change-sidebar">
        <div class="panel-head">
          <div>
            <h2>变更</h2>
            <p>多文件审阅 · 路径过滤 · 按块接受/回滚</p>
          </div>
          <span class="badge">${filtered.length}/${state.changes.length}</span>
        </div>
        <div class="change-summary-chips">
          <span class="badge warn">待处理 ${pendingN}</span>
          <span class="badge ok">已接受 ${acceptedN}</span>
          <span class="badge bad">已回滚 ${rejectedN}</span>
        </div>
        <div class="row" style="gap:8px;margin:0 0 10px;padding:0 2px">
          <input id="changeFilterInput" class="input" type="search" placeholder="过滤路径…" value="${escapeHtml(
            state.changeFilter || "",
          )}" style="flex:1" />
        </div>
        <div class="change-list">${list}</div>
      </div>
      <div class="panel diff-pane">
        <div class="panel-head">
          <div>
            <h2 class="mono" style="font-size:15px">${escapeHtml(selected.path)}</h2>
            <p>${escapeHtml(ctx.kindLabel(selected.kind))}${
              selected.at ? ` · ${escapeHtml(ctx.formatSessionTime(selected.at))}` : ""
            } · 勾选 diff 块后可部分应用</p>
          </div>
          <div class="change-actions">
            <button type="button" class="btn sm" id="openChangeBtn" data-path="${escapeHtml(
              selected.path,
            )}">打开文件</button>
            <button type="button" class="btn sm" id="openEditorBtn" data-path="${escapeHtml(
              selected.path,
            )}">在编辑器打开</button>
            <button type="button" class="btn sm primary" id="applyHunksBtn" data-path="${escapeHtml(
              selected.path,
            )}" ${locked ? "disabled" : ""}>应用所选块</button>
            <button type="button" class="btn sm" id="acceptChangeBtn" data-path="${escapeHtml(
              selected.path,
            )}" ${locked || selected.accepted ? "disabled" : ""}>${acceptLabel}</button>
            <button type="button" class="btn ghost sm" id="rejectChangeBtn" data-path="${escapeHtml(
              selected.path,
            )}" ${locked ? "disabled" : ""}>全部回滚</button>
          </div>
        </div>
        ${note}
        <div class="diff-view">${ctx.renderDiffHtml(selected)}</div>
      </div>
    </div>`;
  }

  global.HFQChangesPage = { render };
})(typeof window !== "undefined" ? window : globalThis);
