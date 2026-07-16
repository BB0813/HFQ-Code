/**
 * Skills store pure helpers (R1 extract — no DOM).
 * Loaded before app.js; attaches to window.HFQSkillsUI.
 */
(function (global) {
  function collectTags(items) {
    const set = new Set();
    for (const it of items || []) {
      if (!Array.isArray(it.tags)) continue;
      for (const t of it.tags) {
        const s = String(t || "").trim();
        if (s) set.add(s);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  function filterItems(items, query, tag) {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    const tagKey = String(tag || "")
      .trim()
      .toLowerCase();
    return (items || []).filter((it) => {
      if (tagKey) {
        const tags = Array.isArray(it.tags) ? it.tags.map((t) => String(t).toLowerCase()) : [];
        if (!tags.includes(tagKey)) return false;
      }
      if (!q) return true;
      return (
        String(it.name || "")
          .toLowerCase()
          .includes(q) ||
        String(it.description || "")
          .toLowerCase()
          .includes(q) ||
        (Array.isArray(it.tags) && it.tags.some((t) => String(t).toLowerCase().includes(q)))
      );
    });
  }

  function activeGoalTask(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    return (
      list.find(
        (t) =>
          t &&
          t.status === "in_progress" &&
          (String(t.taskId || "").startsWith("goal_") ||
            String(t.title || "").toLowerCase().startsWith("goal:")),
      ) || null
    );
  }

  global.HFQSkillsUI = {
    collectTags,
    filterItems,
    activeGoalTask,
  };
})(typeof window !== "undefined" ? window : globalThis);
