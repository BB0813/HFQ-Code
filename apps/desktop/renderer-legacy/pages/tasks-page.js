/**
 * Tasks tree page HTML (R4) — sub-agents + goal + tool steps.
 * window.HFQTasksPage.render(ctx)
 */
(function (global) {
  /**
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   statusLabel: (s: string) => string,
   *   taskStatusLabel: (s: string) => string,
   *   taskBadgeClass: (s: string) => string,
   *   icons: Record<string, string>,
   *   activeGoalTask?: (tasks: any[]) => any | null,
   *   state: any,
   * }} ctx
   */
  function render(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const state = ctx.state;
    const icons = ctx.icons || {};
    const children = Array.isArray(state.childSessions) ? state.childSessions : [];
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const goal =
      (ctx.activeGoalTask || global.HFQSkillsUI?.activeGoalTask)?.(tasks) || null;

    if (!tasks.length && !children.length && !goal) {
      return `<div class="panel"><div class="empty-state"><div class="empty-icon">${
        icons.tasks || ""
      }</div><h3>暂无任务</h3><p>工具调用会自动记为任务；<code>/goal …</code> 长运行目标也会出现在此。子代理会出现在本页树中。运行中可用会话「停止」取消 goal。</p></div></div>`;
    }

    const goalBlock = goal
      ? `<div class="task-tree-branch task-tree-goal">
          <div class="task-tree-node">
            <span class="task-tree-rail" aria-hidden="true"></span>
            <span class="badge info">/goal</span>
            <div class="task-tree-body">
              <div class="title">${escapeHtml(
                String(goal.title || "goal").replace(/^goal:\s*/i, ""),
              )}</div>
              <div class="detail mono faint">${escapeHtml(goal.detail || "长运行进行中")}</div>
            </div>
            <span class="badge ${ctx.taskBadgeClass(goal.status)}">${escapeHtml(
              ctx.taskStatusLabel(goal.status),
            )}</span>
          </div>
        </div>`
      : "";

    const childBlock = children.length
      ? `<div class="task-tree-branch">
          <div class="task-tree-section-label">子代理 · ${children.length}</div>
          ${children
            .map((c) => {
              const title = c.title || c.id?.slice(0, 8) || "child";
              const st = ctx.statusLabel(c.status);
              return `<div class="task-tree-node">
                <span class="task-tree-rail" aria-hidden="true"></span>
                <span class="badge info">子代理</span>
                <div class="task-tree-body">
                  <div class="title">${escapeHtml(title)}</div>
                  <div class="detail mono faint">${escapeHtml(c.id || "")} · ${escapeHtml(st)}</div>
                </div>
                <button type="button" class="btn sm" data-open-child-session="${escapeHtml(
                  c.id || "",
                )}">打开</button>
              </div>`;
            })
            .join("")}
        </div>`
      : "";

    if (!tasks.length) {
      return `<div class="panel">
        <div class="panel-head">
          <div><h2>任务树</h2><p>子代理与长目标 · 本会话尚无工具步骤</p></div>
        </div>
        <div class="task-tree">${goalBlock}${childBlock}
          <div class="empty-state" style="padding:16px 8px"><h3>暂无本会话工具任务</h3><p>子代理列表见上方。</p></div>
        </div>
      </div>`;
    }

    const counts = tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, /** @type {Record<string, number>} */ ({}));
    const summary = [
      ["进行中", counts.in_progress || 0, "info"],
      ["已完成", counts.completed || 0, "ok"],
      ["失败", counts.failed || 0, "bad"],
      ["取消", counts.cancelled || 0, "warn"],
    ]
      .map(
        ([label, n, cls]) =>
          `<span class="badge ${cls}">${escapeHtml(String(label))} ${n}</span>`,
      )
      .join(" ");

    const nonGoalTasks = tasks.filter((t) => {
      if (!goal) return true;
      return t.taskId !== goal.taskId;
    });

    const rows = nonGoalTasks
      .map((t) => {
        const canRetry =
          (t.status === "failed" || t.status === "cancelled") &&
          state.session &&
          !state.busy;
        const retryHint = t.title.startsWith("shell:")
          ? `shell ${t.title.slice("shell:".length).trim()}`
          : t.title.startsWith("grep ")
            ? `用 grep 搜索 ${t.title.slice(5).trim()}`
            : t.title.startsWith("fetch ")
              ? `fetch ${t.title.slice(6).trim()}`
              : t.title.startsWith("read ")
                ? `read ${t.title.slice(5).trim()}`
                : t.title.startsWith("list ")
                  ? `list ${t.title.slice(5).trim()}`
                  : t.title.startsWith("write ")
                    ? `write demo to ${t.title.slice(6).trim()}`
                    : t.detail || t.title;
        return `<div class="task-tree-node">
          <span class="task-tree-rail" aria-hidden="true"></span>
          <span class="badge ${ctx.taskBadgeClass(t.status)}">${escapeHtml(
            ctx.taskStatusLabel(t.status),
          )}</span>
          <div class="task-tree-body">
            <div class="title">${escapeHtml(t.title)}</div>
            ${t.detail ? `<div class="detail">${escapeHtml(t.detail)}</div>` : ""}
          </div>
          <div class="row" style="gap:6px;align-items:center">
            ${
              canRetry
                ? `<button type="button" class="btn sm" data-retry-task="${escapeHtml(
                    retryHint,
                  )}">重试</button>`
                : ""
            }
            <span class="faint mono">${escapeHtml(
              String(t.at || "")
                .replace("T", " ")
                .slice(11, 19),
            )}</span>
          </div>
        </div>`;
      })
      .join("");

    return `<div class="panel">
      <div class="panel-head">
        <div><h2>任务树</h2><p>长目标 · 子代理 · 工具步骤 · 失败/取消可「重试」回会话</p></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${summary}<span class="badge">${tasks.length}</span></div>
      </div>
      <div class="task-tree">
        ${goalBlock}
        ${childBlock}
        <div class="task-tree-branch">
          <div class="task-tree-section-label">工具步骤 · ${nonGoalTasks.length}</div>
          ${rows || `<div class="faint" style="padding:8px">无其它步骤</div>`}
        </div>
      </div>
    </div>`;
  }

  global.HFQTasksPage = { render };
})(typeof window !== "undefined" ? window : globalThis);
