/**
 * R5 — Progressive islands bootstrap (no React/Vue).
 *
 * Decision (2026-07-15): R1–R4 modules + vanilla DOM are enough for maintainability.
 * Do **not** big-bang rewrite to React. Instead, register optional page islands that
 * enhance a host element after `app.js` paints HTML.
 *
 * Contract:
 *   HFQIslands.register(name, { mount(el, api), unmount?(el) })
 *   HFQIslands.mountAll(root, api)  — called from app after renderPage
 *   HFQIslands.unmountAll(root)
 *
 * Page modules remain pure HTML string renderers; islands attach behavior only.
 */
(function (global) {
  /** @type {Map<string, { mount: Function, unmount?: Function }>} */
  const registry = new Map();
  /** @type {WeakMap<Element, string>} */
  const mounted = new WeakMap();

  /**
   * @param {string} name
   * @param {{ mount: (el: Element, api: any) => void | (() => void), unmount?: (el: Element) => void }} def
   */
  function register(name, def) {
    if (!name || typeof def?.mount !== "function") return;
    registry.set(name, def);
  }

  /**
   * @param {ParentNode | null | undefined} root
   * @param {any} api app helpers (optional)
   */
  function mountAll(root, api) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    root.querySelectorAll("[data-island]").forEach((el) => {
      const name = el.getAttribute("data-island");
      if (!name || mounted.get(el) === name) return;
      const def = registry.get(name);
      if (!def) return;
      try {
        const cleanup = def.mount(el, api || {});
        if (typeof cleanup === "function") {
          el.__hfqIslandCleanup = cleanup;
        }
        mounted.set(el, name);
      } catch (err) {
        console.warn("[HFQIslands] mount failed:", name, err);
      }
    });
  }

  /**
   * @param {ParentNode | null | undefined} root
   */
  function unmountAll(root) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    root.querySelectorAll("[data-island]").forEach((el) => {
      const name = mounted.get(el);
      if (!name) return;
      const def = registry.get(name);
      try {
        if (typeof el.__hfqIslandCleanup === "function") {
          el.__hfqIslandCleanup();
          delete el.__hfqIslandCleanup;
        }
        def?.unmount?.(el);
      } catch (err) {
        console.warn("[HFQIslands] unmount failed:", name, err);
      }
      mounted.delete(el);
    });
  }

  /** Built-in island: sticky focus restore for chat composer after repaint. */
  register("composer-focus", {
    mount(el) {
      const ta = el.querySelector("#chatInput") || el;
      if (!(ta instanceof HTMLTextAreaElement)) return;
      // Do not steal focus if user is elsewhere.
      if (document.activeElement && document.activeElement !== document.body) return;
      try {
        ta.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    },
  });

  /** Built-in island: skill tag rail scroll fade hint. */
  register("skill-tag-rail", {
    mount(el) {
      if (!(el instanceof HTMLElement)) return;
      const update = () => {
        const max = el.scrollWidth - el.clientWidth;
        el.classList.toggle("has-overflow", max > 4);
        el.classList.toggle("at-end", el.scrollLeft >= max - 2);
      };
      update();
      el.addEventListener("scroll", update, { passive: true });
      return () => el.removeEventListener("scroll", update);
    },
  });

  global.HFQIslands = {
    register,
    mountAll,
    unmountAll,
    /** @returns {string[]} */
    list() {
      return [...registry.keys()];
    },
    /** Product decision recorded for docs / boot banner */
    strategy: "vanilla-islands",
    decision:
      "R5: keep vanilla modules; progressive islands only. No React full rewrite.",
  };
})(typeof window !== "undefined" ? window : globalThis);
