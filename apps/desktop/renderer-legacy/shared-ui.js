/**
 * Shared layout / pure HTML helpers (R1 + R8 Shoelace).
 * Loaded before page modules; attaches to window.HFQSharedUI.
 */
(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function shortPath(p) {
    if (!p) return "";
    const parts = String(p).replaceAll("/", "\\").split("\\").filter(Boolean);
    if (parts.length <= 3) return p;
    return `…\\${parts.slice(-3).join("\\")}`;
  }

  /**
   * @param {{ title: string, subtitle?: string, actionsHtml?: string }} opts
   */
  function panelHead(opts) {
    const title = opts?.title || "";
    const subtitle = opts?.subtitle || "";
    const actionsHtml = opts?.actionsHtml || "";
    return `<div class="panel-head">
      <div>
        <h2>${title}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
      ${actionsHtml}
    </div>`;
  }

  /**
   * @param {{ iconHtml?: string, icon?: string, title: string, body?: string, style?: string }} opts
   */
  function emptyState(opts) {
    let icon = "";
    if (opts?.iconHtml) {
      icon = `<div class="empty-icon">${opts.iconHtml}</div>`;
    } else if (opts?.icon) {
      icon = `<div class="empty-icon"><sl-icon name="${escapeHtml(opts.icon)}" style="font-size:20px"></sl-icon></div>`;
    }
    const style = opts?.style ? ` style="${opts.style}"` : "";
    const body = opts?.body ? `<p>${opts.body}</p>` : "";
    return `<div class="empty-state"${style}>${icon}<h3>${opts?.title || ""}</h3>${body}</div>`;
  }

  /**
   * Segmented tabs — Shoelace button-group look (keeps data-* for existing handlers).
   * @param {{ tabs: Array<{ id: string, label: string, badgeHtml?: string }>, active: string, dataAttr?: string, style?: string }} opts
   */
  function segTabs(opts) {
    const dataAttr = opts?.dataAttr || "data-tab";
    const active = opts?.active || "";
    const style = opts?.style || "margin-bottom:12px";
    const tabs = Array.isArray(opts?.tabs) ? opts.tabs : [];
    const buttons = tabs
      .map((t) => {
        const id = String(t.id || "");
        const badge = t.badgeHtml || "";
        const isActive = active === id;
        return `<sl-button size="small" variant="${isActive ? "primary" : "default"}" class="seg-tab ${
          isActive ? "active" : ""
        }" ${dataAttr}="${escapeHtml(id)}">${t.label || escapeHtml(id)}${badge}</sl-button>`;
      })
      .join("");
    return `<sl-button-group class="seg-tabs" label="分段" role="tablist" style="${style}">${buttons}</sl-button-group>`;
  }

  /**
   * Small helper HTML for page CTAs.
   * @param {{ id?: string, label: string, variant?: string, size?: string, icon?: string, disabled?: boolean, attrs?: string }} opts
   */
  function slButton(opts) {
    const id = opts?.id ? ` id="${escapeHtml(opts.id)}"` : "";
    const variant = opts?.variant || "default";
    const size = opts?.size || "small";
    const disabled = opts?.disabled ? " disabled" : "";
    const attrs = opts?.attrs || "";
    const icon = opts?.icon
      ? `<sl-icon slot="prefix" name="${escapeHtml(opts.icon)}"></sl-icon>`
      : "";
    return `<sl-button${id} variant="${escapeHtml(variant)}" size="${escapeHtml(size)}"${disabled} ${attrs}>${icon}${
      opts?.label || ""
    }</sl-button>`;
  }

  global.HFQSharedUI = {
    escapeHtml,
    shortPath,
    panelHead,
    emptyState,
    segTabs,
    slButton,
  };
})(typeof window !== "undefined" ? window : globalThis);
