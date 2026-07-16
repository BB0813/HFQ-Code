/**
 * Skills page HTML (installed + store) — R1.
 * window.HFQSkillsPage.render(ctx)
 */
(function (global) {
  /**
   * @param {{
   *   escapeHtml: (s: string) => string,
   *   icons: Record<string, string>,
   *   collectTags?: (items: any[]) => string[],
   *   filterItems?: (items: any[], q: string, tag: string) => any[],
   *   state: any,
   * }} ctx
   */
  function render(ctx) {
    const escapeHtml = ctx.escapeHtml;
    const state = ctx.state;
    const icons = ctx.icons || {};
    const collectTags =
      ctx.collectTags || global.HFQSkillsUI?.collectTags || (() => []);
    const filterItems =
      ctx.filterItems || global.HFQSkillsUI?.filterItems || ((items) => items || []);

    const paths = state.appPaths || {};
    const tab = state.skillsTab === "store" ? "store" : "installed";
    const tabBar = `<sl-button-group class="seg-tabs" label="技能页签" role="tablist" style="margin-bottom:12px">
    <sl-button size="small" variant="${tab === "installed" ? "primary" : "default"}" class="seg-tab ${tab === "installed" ? "active" : ""}" data-skills-tab="installed">已安装</sl-button>
    <sl-button size="small" variant="${tab === "store" ? "primary" : "default"}" class="seg-tab ${tab === "store" ? "active" : ""}" data-skills-tab="store">技能商店</sl-button>
  </sl-button-group>`;

    if (tab === "store") {
      const cat = state.skillsCatalog;
      const items = Array.isArray(cat?.items) ? cat.items : [];
      const allTags = collectTags(items);
      const filtered = filterItems(items, state.skillsCatalogFilter, state.skillsCatalogTag);
      const tagChips = [
        `<button type="button" class="chip-filter ${
          !state.skillsCatalogTag ? "active" : ""
        }" data-skills-tag="">全部</button>`,
        ...allTags.map(
          (t) =>
            `<button type="button" class="chip-filter ${
              state.skillsCatalogTag === t ? "active" : ""
            }" data-skills-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`,
        ),
      ].join("");
      const cards = filtered.length
        ? filtered
            .map((it) => {
              const tags = Array.isArray(it.tags)
                ? it.tags
                    .slice(0, 4)
                    .map(
                      (t) =>
                        `<span class="skill-card-tag">${escapeHtml(String(t))}</span>`,
                    )
                    .join("")
                : "";
              const installed = it.installed
                ? `<span class="badge ok">已安装</span>`
                : `<span class="badge">未安装</span>`;
              const origin =
                it.origin === "remote"
                  ? "remote"
                  : it.origin === "local_preview"
                    ? "local"
                    : "curated";
              const originClass =
                origin === "remote" ? "origin-remote" : origin === "local" ? "origin-local" : "origin-curated";
              const hint = it.installed
                ? "已在本地 · 可预览 SKILL.md"
                : it.packageUrl
                  ? "https 包 · 安全解压 · 可选 SHA-256"
                  : it.tags?.includes?.("planned") || /planned|coming/i.test(it.description || "")
                    ? "规划中 · 可本地文件夹安装同类技能"
                    : "从本地文件夹安装 SKILL.md 包";
              return `<article class="skill-card ${it.installed ? "is-installed" : ""}">
              <div class="skill-card-head">
                <strong class="mono skill-card-name">${escapeHtml(it.name)}</strong>
                ${installed}
                <span class="badge skill-origin ${originClass}">${escapeHtml(origin)}</span>
              </div>
              <p class="skill-card-desc">${escapeHtml(it.description || "")}</p>
              <div class="skill-card-tags">${tags}</div>
              <div class="skill-card-actions">
                <button type="button" class="btn sm" data-preview-skill-name="${escapeHtml(
                  it.name,
                )}">预览</button>
                ${
                  it.homepage
                    ? `<button type="button" class="btn ghost sm" data-open-skill-home="${escapeHtml(
                        it.homepage,
                      )}">主页</button>`
                    : ""
                }
                ${
                  it.packageUrl
                    ? `<button type="button" class="btn sm primary" data-install-package-url="${escapeHtml(
                        it.packageUrl,
                      )}" data-package-sha="${escapeHtml(
                        it.packageSha256 || "",
                      )}" data-skill-name="${escapeHtml(it.name || "")}" ${
                        it.installed ? "disabled" : ""
                      }>远程安装</button>
                    <button type="button" class="btn ghost sm" data-open-skill-home="${escapeHtml(
                      it.packageUrl,
                    )}">包地址</button>`
                    : ""
                }
              </div>
              <div class="skill-card-hint faint">${escapeHtml(hint)}</div>
            </article>`;
            })
            .join("")
        : `<div class="empty-state skill-store-empty">
            <div class="empty-icon">${icons.skills || ""}</div>
            <h3>${cat ? "无匹配技能" : "正在加载目录…"}</h3>
            <p>${
              cat
                ? "试试清空筛选，或换一个标签；也可从本地文件夹安装。"
                : "正在拉取策展目录，也可点「刷新目录」重试。"
            }</p>
            <div class="row" style="gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">
              <button type="button" class="btn sm" id="skillsCatalogRefreshBtn">刷新目录</button>
              <button type="button" class="btn sm primary" id="skillsInstallDirBtn">从文件夹安装</button>
            </div>
          </div>`;

      const preview = state.skillPreview;
      const drawer = preview
        ? `<aside class="skill-drawer" id="skillDrawer">
          <div class="skill-drawer-head">
            <div>
              <h3 class="mono">${escapeHtml(preview.name || "预览")}</h3>
              <p class="faint" style="margin:4px 0 0">${escapeHtml(preview.description || preview.path || "")}</p>
            </div>
            <button type="button" class="btn ghost sm" id="skillDrawerCloseBtn">关闭</button>
          </div>
          ${
            preview.error
              ? `<p class="form-status">${escapeHtml(preview.error)}</p>`
              : `<pre class="skill-preview-body mono">${escapeHtml(preview.body || "")}</pre>`
          }
        </aside>`
        : "";

      const countLabel = cat
        ? `显示 ${filtered.length} / 共 ${items.length}`
        : "加载中…";

      return `<div class="panel skill-store-panel">
      <div class="panel-head">
        <div>
          <h2>技能 · ClawHub 商店</h2>
          <p>策展目录 + 本地 / 远程包安装 · 标签分类条 · SKILL.md 预览（不执行安装脚本）</p>
        </div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button type="button" class="btn ghost sm" id="skillsCatalogRefreshBtn">刷新目录</button>
          <button type="button" class="btn ghost sm" id="skillsPreviewPickBtn">预览文件夹</button>
          <button type="button" class="btn sm primary" id="skillsInstallDirBtn">从文件夹安装</button>
          <button type="button" class="btn sm" id="skillsOpenUserDir" ${
            paths.skills || cat?.userSkillsDir ? "" : "disabled"
          }>用户技能目录</button>
        </div>
      </div>
      ${tabBar}
      <div class="skill-store-toolbar">
        <input id="skillsCatalogFilter" class="input skill-store-search" placeholder="筛选名称 / 描述 / 标签…" value="${escapeHtml(
          state.skillsCatalogFilter || "",
        )}" />
        <span class="skill-store-meta faint mono">${escapeHtml(countLabel)}${
          cat
            ? ` · source=${cat.source || "—"}${cat.remoteError ? ` · ${cat.remoteError}` : ""}`
            : ""
        }</span>
      </div>
      <div class="skill-category-rail" data-island="skill-tag-rail" role="toolbar" aria-label="技能分类标签">
        <div class="chip-filter-row skill-category-chips">${tagChips}</div>
      </div>
      <p class="faint skill-store-note">安装仅复制到用户技能目录；若已存在会询问是否覆盖。不会执行远程脚本。</p>
      <div class="skill-store-layout">
        <div class="skill-store-grid">${cards}</div>
        ${drawer}
      </div>
      <p class="form-status" id="skillsStoreStatus"></p>
    </div>`;
    }

    if (!state.skills.length) {
      return `<div class="panel">
      <div class="panel-head">
        <div><h2>技能</h2><p>AgentSkills SKILL.md，附带轻量 OpenClaw 门控</p></div>
        <div class="row" style="gap:8px">
          <button type="button" class="btn ghost sm" id="skillsRefreshBtn">刷新</button>
          <button type="button" class="btn sm primary" id="skillsInstallDirBtn">从文件夹安装</button>
        </div>
      </div>
      ${tabBar}
      <div class="empty-state"><div class="empty-icon">${icons.skills || ""}</div><h3>暂无已安装技能</h3><p>扫描工作区、用户与内置技能目录；也可在「技能商店」安装。</p></div>
    </div>`;
    }
    const rows = state.skills
      .map(
        (s) => `<tr>
        <td><code>${escapeHtml(s.name)}</code></td>
        <td>${escapeHtml(s.description)}</td>
        <td><span class="badge">${escapeHtml(s.source)}</span></td>
        <td>${
          s.eligible
            ? '<span class="badge ok">可用</span>'
            : `<span class="badge bad">${escapeHtml(s.ineligibleReason || "已拦截")}</span>`
        }</td>
        <td class="row" style="gap:4px">
          ${
            s.dir
              ? `<button type="button" class="btn sm" data-preview-skill-dir="${escapeHtml(
                  s.dir,
                )}">预览</button>
            <button type="button" class="btn ghost sm" data-open-skill-dir="${escapeHtml(
              s.dir,
            )}">目录</button>`
              : "—"
          }
        </td>
      </tr>`,
      )
      .join("");
    const preview = state.skillPreview;
    const drawer = preview
      ? `<aside class="skill-drawer" id="skillDrawer" style="margin-top:12px">
        <div class="skill-drawer-head">
          <div>
            <h3 class="mono">${escapeHtml(preview.name || "预览")}</h3>
            <p class="faint" style="margin:4px 0 0">${escapeHtml(preview.description || preview.path || "")}</p>
          </div>
          <button type="button" class="btn ghost sm" id="skillDrawerCloseBtn">关闭</button>
        </div>
        ${
          preview.error
            ? `<p class="form-status">${escapeHtml(preview.error)}</p>`
            : `<pre class="skill-preview-body mono">${escapeHtml(preview.body || "")}</pre>`
        }
      </aside>`
      : "";
    return `<div class="panel">
    <div class="panel-head">
      <div>
        <h2>技能</h2>
        <p>AgentSkills SKILL.md，附带轻量 OpenClaw 门控</p>
      </div>
      <div class="row" style="gap:8px">
        <button type="button" class="btn ghost sm" id="skillsRefreshBtn">刷新</button>
        <button type="button" class="btn sm primary" id="skillsInstallDirBtn">从文件夹安装</button>
        <button type="button" class="btn sm" id="skillsOpenUserDir" ${
          paths.skills ? "" : "disabled"
        }>用户技能目录</button>
      </div>
    </div>
    ${tabBar}
    <div class="table-wrap"><table class="table"><thead><tr><th>名称</th><th>描述</th><th>来源</th><th>门控</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    ${drawer}
  </div>`;
  }

  global.HFQSkillsPage = { render };
})(typeof window !== "undefined" ? window : globalThis);
