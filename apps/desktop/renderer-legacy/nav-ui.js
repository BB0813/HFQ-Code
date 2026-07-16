/**
 * Nav shell: vertical rail with Shoelace icons + product tokens (R8.1).
 * NOT sl-menu (dropdown semantics collapse labels into one line).
 * Loaded before app.js; attaches to window.HFQNavUI.
 */
(function (global) {
  /** Bootstrap Icons names (vendor/shoelace/dist/assets/icons) */
  const ICON_NAMES = {
    home: "house",
    chat: "chat-dots",
    changes: "file-earmark-diff",
    terminal: "terminal",
    tasks: "list-check",
    skills: "stars",
    mcp: "plug",
    memory: "journal-text",
    import: "download",
    models: "cpu",
    usage: "bar-chart-line",
    permissions: "shield-check",
    audit: "clipboard-data",
    settings: "gear",
  };

  const ICONS = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>`,
    changes: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l3 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v4h8"/><path d="M9 13h6M9 17h4"/></svg>`,
    terminal: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m7 10 3 2-3 2M12 14h5"/></svg>`,
    tasks: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17"/></svg>`,
    skills: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 14.5 8.5 20.5 9.3 16.2 13.4 17.4 19.4 12 16.5 6.6 19.4 7.8 13.4 3.5 9.3 9.5 8.5z"/></svg>`,
    mcp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8v3H8zM8 14h8v3H8z"/><path d="M12 10v4"/><path d="M6 8.5H4M6 15.5H4M20 8.5h-2M20 15.5h-2"/></svg>`,
    models: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5-8 4.5z"/><path d="m4 12 8 4.5 8-4.5"/><path d="m4 15.5 8 4.5 8-4.5"/></svg>`,
    permissions: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.9 7.8 7 9 4.1-1.2 7-4.5 7-9V6z"/><path d="m9.5 12 1.8 1.8L15 10"/></svg>`,
    audit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7z"/><path d="M10 8h4M10 12h4M10 16h2"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6"/></svg>`,
    memory: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
    usage: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M6 16V9M11 16V6M16 16v-4"/></svg>`,
    import: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 18h14"/></svg>`,
  };

  const NAV_META = {
    home: { label: "首页", group: "工作区" },
    chat: { label: "会话", group: "工作区" },
    changes: { label: "变更", group: "工作区" },
    terminal: { label: "终端", group: "工作区" },
    tasks: { label: "任务", group: "工作区" },
    skills: { label: "技能", group: "扩展" },
    mcp: { label: "MCP", group: "扩展" },
    memory: { label: "记忆", group: "扩展" },
    import: { label: "导入", group: "扩展" },
    models: { label: "模型", group: "系统" },
    usage: { label: "用量", group: "系统" },
    permissions: { label: "权限", group: "系统" },
    audit: { label: "审计", group: "系统" },
    settings: { label: "设置", group: "系统" },
  };

  /**
   * Vertical nav rail: one button per page (not dropdown menu).
   * @param {{
   *   navEl: HTMLElement,
   *   pages: Array<{ id: string, label?: string }>,
   *   escapeHtml: (s: string) => string,
   *   onNavigate: (id: string) => void,
   * }} opts
   */
  const GROUP_ORDER = ["工作区", "扩展", "系统"];

  function buildNav(opts) {
    const nav = opts.navEl;
    const escapeHtml = opts.escapeHtml || global.HFQSharedUI?.escapeHtml || ((s) => String(s));
    const pages = Array.isArray(opts.pages) ? opts.pages.slice() : [];
    nav.innerHTML = "";
    nav.classList.add("nav-rail");

    // Keep sections contiguous (listPages order is not group-sorted)
    pages.sort((a, b) => {
      const ga = NAV_META[a.id]?.group || "工作区";
      const gb = NAV_META[b.id]?.group || "工作区";
      const ia = GROUP_ORDER.indexOf(ga);
      const ib = GROUP_ORDER.indexOf(gb);
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      const order = Object.keys(NAV_META);
      return order.indexOf(a.id) - order.indexOf(b.id);
    });

    let lastGroup = "";
    for (const page of pages) {
      const meta = NAV_META[page.id] || { label: page.label, group: "工作区" };
      if (meta.group && meta.group !== lastGroup) {
        lastGroup = meta.group;
        const sec = document.createElement("div");
        sec.className = "nav-section";
        sec.textContent = meta.group;
        nav.appendChild(sec);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-item";
      btn.dataset.id = page.id;
      btn.setAttribute("aria-label", meta.label || page.label || page.id);

      const iconName = ICON_NAMES[page.id] || "gear";
      // Prefer sl-icon when design system ready; keep inline SVG fallback
      btn.innerHTML = `
        <span class="nav-ico" aria-hidden="true">
          <sl-icon name="${escapeHtml(iconName)}" class="nav-sl-icon"></sl-icon>
          <span class="nav-svg-fallback">${ICONS[page.id] || ICONS.settings}</span>
        </span>
        <span class="nav-label">${escapeHtml(meta.label || page.label || page.id)}</span>
      `;

      btn.addEventListener("click", () => opts.onNavigate?.(page.id));
      nav.appendChild(btn);
    }
  }

  /**
   * @param {string} activeId
   * @param {ParentNode | Document} [root]
   */
  function setActiveNav(activeId, root) {
    const scope = root || document;
    scope.querySelectorAll(".nav-item, .nav button[data-id]").forEach((el) => {
      const id = el.dataset?.id;
      const on = id === activeId;
      el.classList.toggle("active", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }

  global.HFQNavUI = {
    ICONS,
    ICON_NAMES,
    NAV_META,
    buildNav,
    setActiveNav,
  };
})(typeof window !== "undefined" ? window : globalThis);
