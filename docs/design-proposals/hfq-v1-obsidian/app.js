/* HFQ Code v1.0 · Obsidian prototype shell */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const PAGE_META = {
    dashboard: { title: "Dashboard", section: "Workspace" },
    projects: { title: "Projects", section: "Workspace" },
    agent: { title: "AI Agent", section: "AI" },
    chat: { title: "AI Chat", section: "AI" },
    tasks: { title: "Autonomous Tasks", section: "AI" },
    editor: { title: "Editor", section: "Development" },
    files: { title: "File Explorer", section: "Development" },
    terminal: { title: "Terminal", section: "Development" },
    debugger: { title: "Debugger", section: "Development" },
    git: { title: "Git", section: "Development" },
    review: { title: "Code Review", section: "AI" },
    search: { title: "Search", section: "System" },
    plugins: { title: "Plugins", section: "Tools" },
    marketplace: { title: "Marketplace", section: "Tools" },
    settings: { title: "Settings", section: "System" },
    appearance: { title: "Appearance", section: "System" },
    models: { title: "AI Models", section: "System" },
    account: { title: "Account", section: "System" },
    notifications: { title: "Notifications", section: "System" },
    design: { title: "Design System", section: "System" },
  };

  function navigate(id) {
    if (!PAGE_META[id]) id = "dashboard";
    $$(".page").forEach((p) => p.classList.toggle("active", p.dataset.page === id));
    $$(".nav-item[data-nav]").forEach((n) =>
      n.classList.toggle("active", n.dataset.nav === id)
    );
    const meta = PAGE_META[id];
    const crumb = $("#status-page");
    if (crumb) crumb.textContent = meta.title;
    history.replaceState(null, "", `#${id}`);
    closeOverlays();
  }

  function openPalette() {
    const el = $("#palette");
    el.classList.add("open");
    const input = $("#palette-input");
    input.value = "";
    filterPalette("");
    setTimeout(() => input.focus(), 20);
  }

  function closeOverlays() {
    $("#palette")?.classList.remove("open");
    $("#notif-drawer")?.classList.remove("open");
  }

  function filterPalette(q) {
    const query = q.trim().toLowerCase();
    $$(".palette-item").forEach((item) => {
      const text = item.textContent.toLowerCase();
      item.style.display = !query || text.includes(query) ? "" : "none";
    });
  }

  function bind() {
    $$("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(el.dataset.nav);
      });
    });

    $("#cmd-search")?.addEventListener("click", openPalette);
    $("#btn-ai")?.addEventListener("click", () => navigate("agent"));
    $("#btn-notif")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const d = $("#notif-drawer");
      d.classList.toggle("open");
    });

    $("#palette-input")?.addEventListener("input", (e) => filterPalette(e.target.value));
    $("#palette")?.addEventListener("click", (e) => {
      if (e.target.id === "palette") closeOverlays();
    });

    $$(".palette-item[data-nav]").forEach((item) => {
      item.addEventListener("click", () => navigate(item.dataset.nav));
    });

    $$(".palette-item[data-action]").forEach((item) => {
      item.addEventListener("click", () => {
        const a = item.dataset.action;
        if (a === "new-chat") navigate("chat");
        else if (a === "commit") navigate("git");
        else if (a === "run-task") navigate("tasks");
        closeOverlays();
      });
    });

    document.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
      }
      if (e.key === "Escape") closeOverlays();
    });

    document.addEventListener("click", (e) => {
      const drawer = $("#notif-drawer");
      if (drawer?.classList.contains("open") && !drawer.contains(e.target) && e.target.id !== "btn-notif" && !e.target.closest("#btn-notif")) {
        drawer.classList.remove("open");
      }
    });

    // Settings sub-nav
    $$("[data-settings]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.settings;
        if (id === "appearance") navigate("appearance");
        else if (id === "models") navigate("models");
        else if (id === "account") navigate("account");
        else {
          navigate("settings");
          $$(".settings-nav .nav-item").forEach((n) =>
            n.classList.toggle("active", n.dataset.settings === id)
          );
        }
      });
    });

    // Toggle switches demo
    $$(".toggle").forEach((t) => {
      t.addEventListener("click", () => t.classList.toggle("on"));
    });

    // Terminal tabs
    $$("[data-term-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$("[data-term-tab]").forEach((t) => t.classList.toggle("active", t === tab));
      });
    });

    // Agent state cycle demo
    const states = ["Idle", "Thinking", "Planning", "Coding", "Reviewing"];
    let si = 2;
    const badge = $("#agent-state-badge");
    if (badge) {
      setInterval(() => {
        if (!$('[data-page="agent"]')?.classList.contains("active")) return;
        si = (si + 1) % states.length;
        const live = states[si] !== "Idle";
        badge.innerHTML = live
          ? `<i class="spin"></i> ${states[si]}`
          : states[si];
      }, 2800);
    }

    // Clock in status
    const clock = $("#status-clock");
    if (clock) {
      const tick = () => {
        const d = new Date();
        clock.textContent = d.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
      };
      tick();
      setInterval(tick, 30000);
    }
  }

  function boot() {
    bind();
    const hash = (location.hash || "#dashboard").slice(1);
    navigate(PAGE_META[hash] ? hash : "dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
