/** @typedef {{ id: string, label: string, group?: string }} NavPage */

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

const STATUS_MAP = {
  idle: "空闲",
  running: "运行中",
  waiting_permission: "等待授权",
  completed: "已完成",
  failed: "失败",
};

const TASK_STATUS_LABEL = {
  pending: "待办",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
  failed: "失败",
};

const DECISION_LABEL = {
  allow: "允许",
  deny: "拒绝",
  ask: "询问",
};

const state = {
	  page: "home",
	  workspacePath: null,
	  session: null,
	  busy: false,
	  messages: /** @type {Array<any>} */ ([]),
	  /** @type {Array<{ path: string, kind?: string, before?: string, after?: string, at?: string, accepted?: boolean, rejected?: boolean }>} */
  changes: [],
		  selectedChangePath: /** @type {string | null} */ (null),
		  /** @type {string} filter paths in Changes page */
		  changeFilter: "",
		  /** @type {Array<{ callId: string, command: string, stdout?: string, stderr?: string, code?: number | null, ok: boolean, at: string }>} */
		  terminal: [],
		  /** @type {string} draft command for Terminal page one-shot run */
		  terminalDraft: "",
		  /** @type {Array<{ taskId: string, title: string, status: string, detail?: string, at: string }>} */
		  tasks: [],
		  /** @type {{ path: string, content: string, exists: boolean, dirty?: boolean } | null} */
		  agentsEditor: null,
audit: /** @type {any[]} */ ([]),
  /** @type {string} all | tools | permissions | changes | terminal | session */
  auditFilter: "all",
  skills: /** @type {any[]} */ ([]),
  /** @type {"installed" | "store"} */
  skillsTab: "installed",
  /** @type {null | { items: any[], source?: string, remoteError?: string | null, fetchedAt?: string, catalogUrl?: string, userSkillsDir?: string }} */
  skillsCatalog: null,
  /** @type {string} */
  skillsCatalogFilter: "",
  /** @type {string} tag chip filter for store (empty = all) */
  skillsCatalogTag: "",
  /** @type {null | { name?: string, description?: string, body?: string, path?: string, error?: string }} */
  skillPreview: null,
  config: /** @type {any | null} */ (null),
policyMatrix: /** @type {any[] | null} */ (null),
  /** @type {string[]} */
  sessionAllows: [],
  mcp: /** @type {{ servers: any[], tools: any[] } | null} */ (null),
  pendingPermission: /** @type {null | any} */ (null),
  /** @type {any[]} */
  permissionQueue: [],
  /** @type {boolean} */
  permissionResolving: false,
/** @type {Array<any>} */
		  recentSessions: [],
		  /** @type {any | null} */
		  appPaths: null,
		  changeActionNote: /** @type {string | null} */ (null),
	/** @type {{ inputTokens: number, outputTokens: number }} */
			  usage: { inputTokens: 0, outputTokens: 0 },
			  planMode: false,
			  /** @type {"confirm_before_change"|"auto_edit"|"plan"|"full_access"} */
			  permissionMode: "confirm_before_change",
			  /** @type {any | null} last update:check result */
			  updateCheck: null,
			  memoryDocs: /** @type {any[]} */ ([]),
		  memoryHits: /** @type {any[]} */ ([]),
		  memoryQuery: "",
		  memoryScope: "all",
		  usageSummary: /** @type {any | null} */ (null),
		  importScan: /** @type {any | null} */ (null),
		  importSelected: /** @type {Record<string, boolean>} */ ({}),
		  importNote: /** @type {string | null} */ (null),
		  childSessions: /** @type {any[]} */ ([]),
		};

function el(id) {
  return document.getElementById(id);
}

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

function statusLabel(status) {
  return STATUS_MAP[status] || status || "空闲";
}

function riskLabel(risk) {
  if (risk === "high") return "高风险";
  if (risk === "medium") return "中风险";
  if (risk === "low") return "低风险";
  return `风险 ${risk || "?"}`;
}

function roleLabel(role) {
  const map = {
    user: "你",
    assistant: "助手",
    tool: "工具",
    system: "系统",
    error: "错误",
  };
  return map[role] || role;
}

function kindLabel(kind) {
  if (kind === "create") return "新建";
  if (kind === "modify") return "修改";
  if (kind === "delete") return "删除";
  return kind || "变更";
}

function decisionLabel(d) {
  return DECISION_LABEL[d] || d || "?";
}

function taskStatusLabel(s) {
  return TASK_STATUS_LABEL[s] || s || "待办";
}

function taskBadgeClass(s) {
  if (s === "completed") return "ok";
  if (s === "failed" || s === "cancelled") return "bad";
  if (s === "in_progress") return "info";
  return "warn";
}

/**
 * Minimal line-based diff for UI (not a full Myers diff).
 * @param {string} before
 * @param {string} after
 */
function buildLineDiff(before, after) {
  const a = String(before ?? "").split("\n");
  const b = String(after ?? "").split("\n");
  // Drop trailing empty from final newline for cleaner view
  if (a.length && a[a.length - 1] === "") a.pop();
  if (b.length && b[b.length - 1] === "") b.pop();

  const n = a.length;
  const m = b.length;
  /** @type {number[][]} */
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  /** @type {Array<{ type: 'ctx' | 'add' | 'del', text: string, lnA?: number, lnB?: number }>} */
  const lines = [];
  let i = 0;
  let j = 0;
  let lnA = 1;
  let lnB = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: "ctx", text: a[i], lnA: lnA++, lnB: lnB++ });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: "del", text: a[i], lnA: lnA++ });
      i++;
    } else {
      lines.push({ type: "add", text: b[j], lnB: lnB++ });
      j++;
    }
  }
  while (i < n) {
    lines.push({ type: "del", text: a[i++], lnA: lnA++ });
  }
  while (j < m) {
    lines.push({ type: "add", text: b[j++], lnB: lnB++ });
  }
  return lines;
}

/**
 * Group consecutive non-context lines into hunks (for partial accept).
 * @param {Array<{type:string,text:string,lnA?:number,lnB?:number}>} lines
 */
function groupDiffHunks(lines) {
  /** @type {Array<{ id: number, lines: typeof lines }>} */
  const hunks = [];
  let i = 0;
  let id = 0;
  while (i < lines.length) {
    if (lines[i].type === "ctx") {
      i++;
      continue;
    }
    const start = i;
    while (i < lines.length && lines[i].type !== "ctx") i++;
    hunks.push({ id: id++, lines: lines.slice(start, i) });
  }
  return hunks;
}

/**
 * Build file content from before by applying only selected hunks.
 * Unselected hunks keep the "before" side.
 */
function contentFromSelectedHunks(before, after, selectedIds) {
  const lines = buildLineDiff(before ?? "", after ?? "");
  const hunks = groupDiffHunks(lines);
  const selected = new Set(selectedIds.map(Number));
  // Map each non-ctx line index → hunk id
  const lineHunk = new Map();
  let cursor = 0;
  for (const h of hunks) {
    while (cursor < lines.length && lines[cursor].type === "ctx") cursor++;
    for (let k = 0; k < h.lines.length; k++) {
      lineHunk.set(cursor + k, h.id);
    }
    cursor += h.lines.length;
  }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.type === "ctx") {
      out.push(line.text);
      continue;
    }
    const hid = lineHunk.get(i);
    const takeChange = selected.has(hid);
    if (line.type === "del") {
      if (!takeChange) out.push(line.text);
    } else if (line.type === "add") {
      if (takeChange) out.push(line.text);
    }
  }
  return out.join("\n");
}

function renderDiffHtml(change) {
  if (!change) {
    return `<div class="empty-state"><div class="empty-icon">${ICONS.changes}</div><h3>选择一个文件</h3><p>左侧列表选择后可查看行级 diff。</p></div>`;
  }
  const before = change.before ?? "";
  const after = change.after ?? "";
  if (before === "" && after === "" && !change.kind) {
    return `<div class="empty-state"><h3>${escapeHtml(change.path)}</h3><p>暂无内容快照。新写入会附带 before/after。</p></div>`;
  }
  const lines = buildLineDiff(before, after);
  if (!lines.length) {
    return `<div class="empty-state"><h3>${escapeHtml(change.path)}</h3><p>内容为空或无差异。</p></div>`;
  }
  const hunks = groupDiffHunks(lines);
  if (!hunks.length) {
    return lines
      .map((line) => {
        const mark = line.type === "add" ? "+" : line.type === "del" ? "−" : " ";
        const num = line.type === "add" ? line.lnB : line.lnA;
        return `<div class="diff-line ${line.type}"><span class="ln">${num ?? ""}</span><span class="tx">${escapeHtml(
          mark + " " + line.text,
        )}</span></div>`;
      })
      .join("");
  }

  // Render with hunk headers + checkboxes for partial accept/reject.
  const selectedSet = new Set(
    (change.selectedHunks || hunks.map((h) => h.id)).map(Number),
  );
  let html = "";
  let li = 0;
  for (const h of hunks) {
    // emit leading ctx before this hunk
    while (li < lines.length && lines[li].type === "ctx") {
      const line = lines[li++];
      html += `<div class="diff-line ctx"><span class="ln">${line.lnA ?? ""}</span><span class="tx">${escapeHtml(
        "  " + line.text,
      )}</span></div>`;
    }
    const checked = selectedSet.has(h.id) ? "checked" : "";
    const summary = h.lines
      .filter((l) => l.type !== "ctx")
      .slice(0, 2)
      .map((l) => (l.type === "add" ? "+" : "−") + l.text)
      .join(" · ");
    html += `<div class="diff-hunk-head">
      <label class="hunk-check">
        <input type="checkbox" data-hunk-id="${h.id}" ${checked} ${
          change.rejected ? "disabled" : ""
        } />
        <span>块 ${h.id + 1}</span>
      </label>
      <span class="faint">${escapeHtml(summary.slice(0, 80))}</span>
    </div>`;
    for (const line of h.lines) {
      const mark = line.type === "add" ? "+" : line.type === "del" ? "−" : " ";
      const num = line.type === "add" ? line.lnB : line.lnA;
      html += `<div class="diff-line ${line.type}"><span class="ln">${num ?? ""}</span><span class="tx">${escapeHtml(
        mark + " " + line.text,
      )}</span></div>`;
      li++;
    }
  }
  while (li < lines.length) {
    const line = lines[li++];
    if (line.type !== "ctx") continue;
    html += `<div class="diff-line ctx"><span class="ln">${line.lnA ?? ""}</span><span class="tx">${escapeHtml(
      "  " + line.text,
    )}</span></div>`;
  }
  return html;
}

function upsertChange(event) {
	  const path = event.path;
	  if (!path) return;
	  const next = {
	    path,
	    kind: event.kind,
	    before: event.before,
	    after: event.after,
	    at: event.at,
	    accepted: false,
	    rejected: false,
	  };
	  const idx = state.changes.findIndex((c) => c.path === path);
	  if (idx >= 0) state.changes[idx] = { ...state.changes[idx], ...next, accepted: false, rejected: false };
	  else state.changes.unshift(next);
	  if (!state.selectedChangePath) state.selectedChangePath = path;
	}

	function formatSessionTime(iso) {
	  if (!iso) return "";
	  return String(iso).replace("T", " ").slice(0, 19);
	}

function resetLiveSurfaces() {
					  state.messages = [];
					  state.changes = [];
					  state.selectedChangePath = null;
					  state.changeFilter = "";
					  state.terminal = [];
					  state.tasks = [];
					  state.childSessions = [];
					  state.audit = [];
					  state.auditFilter = "all";
					  state.usage = { inputTokens: 0, outputTokens: 0 };
					  state.changeActionNote = null;
					  state.agentsEditor = null;
					  state.busy = false;
					  state.permissionQueue = [];
					  state.permissionResolving = false;
					  state.pendingPermission = null;
					  el("permModal")?.classList.add("hidden");
					}

		async function refreshChildSessions() {
		  try {
		    if (!state.session?.id || !window.hfq?.listChildSessions) {
		      state.childSessions = [];
		      return;
		    }
		    const list = await window.hfq.listChildSessions({ sessionId: state.session.id });
		    state.childSessions = Array.isArray(list) ? list : [];
		  } catch {
		    state.childSessions = [];
		  }
		}

		async function loadAgentsEditor() {
		  if (!state.workspacePath || !window.hfq?.readWorkspaceText) {
		    state.agentsEditor = null;
		    return;
		  }
		  try {
		    const res = await window.hfq.readWorkspaceText({
		      workspacePath: state.workspacePath,
		      path: "AGENTS.md",
		    });
		    state.agentsEditor = {
		      path: "AGENTS.md",
		      content: res?.content ?? "",
		      exists: Boolean(res?.exists),
		      dirty: false,
		    };
		  } catch (err) {
		    state.agentsEditor = {
		      path: "AGENTS.md",
		      content: "",
		      exists: false,
		      dirty: false,
		      error: err instanceof Error ? err.message : String(err),
		    };
		  }
		}

	/**
	 * Apply a session snapshot from open/resume into renderer state.
	 * @param {any} snap
	 * @param {{ providerId?: string }} [extra]
	 */
	function applySnapshot(snap, extra = {}) {
	  if (!snap?.info) return;
	  state.session = {
	    ...snap.info,
	    providerId: extra.providerId || snap.providerId || snap.info.providerId,
	  };
	  if (snap.info.workspacePath) {
	    state.workspacePath = snap.info.workspacePath;
	    const ws = el("wsPath");
	    if (ws) ws.textContent = snap.info.workspacePath;
	  }
	  state.messages = Array.isArray(snap.messages) ? [...snap.messages] : [];
	  state.changes = Array.isArray(snap.changes)
	    ? snap.changes.map((c) => ({
	        path: c.path,
	        kind: c.kind,
	        before: c.before,
	        after: c.after,
	        at: c.at,
	        accepted: !!c.accepted,
	        rejected: !!c.rejected,
	      }))
	    : [];
	  state.selectedChangePath = state.changes[0]?.path || null;
state.terminal = Array.isArray(snap.terminal) ? [...snap.terminal] : [];
			  state.tasks = Array.isArray(snap.tasks) ? [...snap.tasks] : [];
			  state.usage = {
			    inputTokens: Number(snap.usage?.inputTokens) || 0,
			    outputTokens: Number(snap.usage?.outputTokens) || 0,
			  };
			  // Snapshot events are chronological (oldest first); audit UI is newest-first.
			  const restored = Array.isArray(snap.events)
			    ? snap.events.filter((e) => e && e.type && e.type !== "message.delta")
			    : [];
			  state.audit = restored.slice().reverse().slice(0, 200);
			  state.auditFilter = "all";
  state.changeActionNote = null;
					  state.busy = false;
					  clearPermissionQueue();
					  const snapMode =
					    snap.permissionMode ||
					    snap.info?.permissionMode ||
					    (snap.info?.planMode || snap.planMode ? "plan" : null);
					  applyPermissionModeState(
					    snapMode || state.permissionMode,
					    snap.planMode ?? snap.info?.planMode,
					  );
					  setSessionBadge();
					  setCrumb();
					  void refreshChildSessions();
					  // Best-effort live mode from worker after open.
					  if (state.session?.id && window.hfq?.getPermissionMode) {
					    void window.hfq
					      .getPermissionMode({ sessionId: state.session.id })
					      .then((r) => {
					        if (r?.permissionMode) {
					          applyPermissionModeState(r.permissionMode, r.planMode);
					          if (state.page === "chat") renderPage("chat");
					        }
					      })
					      .catch(() => {});
					  }
					}

	async function refreshSessions() {
	  try {
	    if (!window.hfq?.listSessions) {
	      state.recentSessions = [];
	      return;
	    }
	    const list = await window.hfq.listSessions({
	      workspacePath: state.workspacePath || undefined,
	    });
	    state.recentSessions = Array.isArray(list) ? list : [];
	  } catch {
	    state.recentSessions = [];
	  }
	}

	async function refreshAppPaths() {
	  try {
	    state.appPaths = (await window.hfq?.getAppPaths?.()) || null;
	  } catch (err) {
	    state.appPaths = {
	      error: err instanceof Error ? err.message : String(err),
	    };
	  }
	}

	/**
	 * Open an existing session from disk into the live agent + UI.
	 * @param {string} sessionId
	 */
async function openRecentSession(sessionId) {
		  if (!sessionId) return;
		  setStatus("正在恢复会话…", "busy");
		  try {
		    const snap = await window.hfq.openSession({
		      sessionId,
		      workspacePath: state.workspacePath || undefined,
		    });
		    applySnapshot(snap, { providerId: snap.providerId });
		    const providerLabel =
		      state.session?.providerId || state.config?.activeProviderId || "mock";
		    setStatus(`已恢复 · ${providerLabel}`, "live");
		    await refreshSessions();
		    renderPage("chat");
		  } catch (err) {
		    setStatus("恢复失败", "warn");
		    pushMessage({
		      role: "error",
		      text: err instanceof Error ? err.message : String(err),
		    });
		    if (state.page !== "chat") renderPage("chat");
		  }
		}

		async function deleteRecentSession(sessionId) {
		  if (!sessionId) return;
		  const short = sessionId.slice(0, 8);
		  if (!window.confirm(`删除会话 ${short}…？\n将移除内存状态与 JSONL 转录，不可恢复。`)) {
		    return;
		  }
		  setStatus("正在删除会话…", "busy");
		  try {
		    const res = await window.hfq.deleteSession({ sessionId });
		    if (state.session?.id === sessionId) {
		      state.session = null;
		      resetLiveSurfaces();
		      setSessionBadge();
		      setCrumb();
		    }
		    await refreshSessions();
		    const where = res?.removedFile ? "磁盘+内存" : res?.wasLive ? "内存" : "无记录";
		    setStatus(`已删除会话 ${short}（${where}）`, "live");
		    if (state.page === "home" || state.page === "settings" || state.page === "chat") {
		      renderPage(state.page);
		    }
		  } catch (err) {
		    setStatus(err instanceof Error ? err.message : String(err), "warn");
		  }
		}

		async function renameRecentSession(sessionId, currentTitle) {
		  if (!sessionId) return;
		  const next = window.prompt("会话标题", currentTitle || sessionId.slice(0, 8));
		  if (next == null) return;
		  const title = String(next).trim();
		  if (!title) {
		    setStatus("标题不能为空", "warn");
		    return;
		  }
		  try {
		    const res = await window.hfq.renameSession({ sessionId, title });
		    const info = res?.info;
		    if (state.session?.id === sessionId && info) {
		      state.session = { ...state.session, ...info };
		      setSessionBadge();
		      setCrumb();
		    }
		    await refreshSessions();
		    setStatus(`已重命名 · ${title}`, "live");
		    if (state.page === "home" || state.page === "settings" || state.page === "chat") {
		      renderPage(state.page);
		    }
		  } catch (err) {
		    setStatus(err instanceof Error ? err.message : String(err), "warn");
		  }
		}

async function createFreshSession() {
			  if (!state.workspacePath) throw new Error("请先打开工作区");
			  setStatus("正在创建会话…", "busy");
			  const prefMode = normalizePermissionMode(
			    state.config?.prefs?.permissionMode ||
			      (state.config?.prefs?.planModeDefault ? "plan" : "confirm_before_change"),
			  );
			  const info = await window.hfq.createSession({
			    workspacePath: state.workspacePath,
			    permissionMode: prefMode,
			  });
			  resetLiveSurfaces();
			  clearPermissionQueue();
			  state.session = info;
			  applyPermissionModeState(
			    info.permissionMode || prefMode,
			    info.planMode,
			  );
			  setSessionBadge();
			  const providerLabel = info.providerId || state.config?.activeProviderId || "mock";
			  const modeMeta = permissionModeMeta(state.permissionMode);
			  setStatus(`就绪 · ${providerLabel}`, "live");
			  pushMessage({
			    role: "system",
			    text: `会话 ${info.id.slice(0, 8)}\n工作区: ${info.workspacePath}\n提供方: ${providerLabel}\n模型: ${info.model || "mock"}\n访问模式: ${modeMeta.label}`,
			  });
			  void refreshSessions();
			  return info;
			}

function collectSelectedHunkIds(path) {
		  const change = state.changes.find((c) => c.path === path);
		  if (!change) return [];
		  const boxes = el("content")?.querySelectorAll(`[data-hunk-id]`) || [];
		  if (!boxes.length) {
		    const lines = buildLineDiff(change.before ?? "", change.after ?? "");
		    return groupDiffHunks(lines).map((h) => h.id);
		  }
		  return [...boxes]
		    .filter((b) => b.checked)
		    .map((b) => Number(b.getAttribute("data-hunk-id")));
		}

		async function acceptChange(path) {
		  const change = state.changes.find((c) => c.path === path);
		  if (!change || change.rejected) return;
		  change.accepted = true;
		  change.rejected = false;
		  state.changeActionNote = `已接受 ${path}（保留工作区当前内容）`;
		  if (state.page === "changes") renderPage("changes");
		}

		async function applySelectedHunks(path) {
		  const change = state.changes.find((c) => c.path === path);
		  if (!change || change.rejected) return;
		  if (!state.workspacePath) {
		    state.changeActionNote = "请先打开工作区";
		    if (state.page === "changes") renderPage("changes");
		    return;
		  }
		  const selectedIds = collectSelectedHunkIds(path);
		  const lines = buildLineDiff(change.before ?? "", change.after ?? "");
		  const allHunks = groupDiffHunks(lines);
		  if (!allHunks.length) {
		    await acceptChange(path);
		    return;
		  }
		  if (!selectedIds.length) {
		    // No hunks selected → same as full reject
		    await rejectChange(path);
		    return;
		  }
		  if (selectedIds.length === allHunks.length) {
		    // All selected → keep after as-is
		    change.accepted = true;
		    change.rejected = false;
		    change.after = change.after ?? "";
		    state.changeActionNote = `已应用全部 ${allHunks.length} 个块 · ${path}`;
		    if (state.page === "changes") renderPage("changes");
		    return;
		  }
		  try {
		    setStatus("正在应用所选块…", "busy");
		    const next = contentFromSelectedHunks(change.before ?? "", change.after ?? "", selectedIds);
		    await window.hfq.writeChangeContent({
		      workspacePath: state.workspacePath,
		      path: change.path,
		      content: next,
		    });
		    change.after = next;
		    change.accepted = true;
		    change.rejected = false;
		    change.selectedHunks = selectedIds;
		    state.changeActionNote = `已应用 ${selectedIds.length}/${allHunks.length} 个块 · ${path}`;
		    setStatus("部分变更已写入", "live");
		    pushMessage({
		      role: "system",
		      text: `部分接受变更: ${path} · ${selectedIds.length}/${allHunks.length} 块`,
		    });
		  } catch (err) {
		    state.changeActionNote = err instanceof Error ? err.message : String(err);
		    setStatus("应用块失败", "warn");
		  }
		  if (state.page === "changes") renderPage("changes");
		}

		async function rejectChange(path) {
		  const change = state.changes.find((c) => c.path === path);
		  if (!change || change.rejected) return;
		  if (!state.workspacePath) {
		    state.changeActionNote = "请先打开工作区再回滚";
		    if (state.page === "changes") renderPage("changes");
		    return;
		  }
		  try {
		    setStatus("正在回滚…", "busy");
		    const res = await window.hfq.revertChange({
		      workspacePath: state.workspacePath,
		      path: change.path,
		      kind: change.kind,
		      before: change.before,
		    });
		    change.rejected = true;
		    change.accepted = false;
		    const action = res?.action === "deleted" ? "已删除新建文件" : "已还原为写入前内容";
		    state.changeActionNote = `已回滚 ${path} · ${action}`;
		    setStatus("回滚完成", "live");
		    pushMessage({
		      role: "system",
		      text: `变更回滚: ${path} · ${action}`,
		    });
		  } catch (err) {
		    state.changeActionNote = err instanceof Error ? err.message : String(err);
		    setStatus("回滚失败", "warn");
		  }
		  if (state.page === "changes") renderPage("changes");
		}

function upsertTask(event) {
  const idx = state.tasks.findIndex((t) => t.taskId === event.taskId);
  const next = {
    taskId: event.taskId,
    title: event.title,
    status: event.status,
    detail: event.detail,
    at: event.at,
  };
  if (idx >= 0) state.tasks[idx] = next;
  else state.tasks.unshift(next);
  if (state.tasks.length > 100) state.tasks.length = 100;
}

function setStatus(text, kind = "") {
  const pill = el("status");
  const label = el("statusText");
  if (label) label.textContent = text;
  if (pill) {
    pill.classList.remove("live", "warn", "busy");
    if (kind) pill.classList.add(kind);
  }
}

function getActiveProviderMeta() {
  const providerId =
    state.session?.providerId || state.config?.activeProviderId || "mock";
  const providers = Array.isArray(state.config?.providers) ? state.config.providers : [];
  const hit = providers.find((p) => p.id === providerId);
  const model =
    state.session?.model || state.config?.activeModel || hit?.defaultModel || "mock-hfq";
  return {
    providerId,
    providerName: hit?.name || providerId,
    model,
  };
}

/** Topbar: 提供方 / 模型 — always visible above page content. */
function updateModelProviderBadge() {
  const badge = el("modelProviderBadge");
  const text = el("modelProviderBadgeText");
  if (!text) return;
  const { providerId, providerName, model } = getActiveProviderMeta();
  const label = `${providerName} · ${model}`;
  text.textContent = truncateLabel(label, 42);
  if (badge) {
    badge.title = `提供方 ${providerName}（${providerId}）\n模型 ${model}\n点击打开模型页`;
    badge.dataset.providerId = providerId;
    badge.dataset.model = model;
  }
}

function setSessionBadge() {
		  const pill = el("sessionBadge");
		  const label = el("sessionBadgeText");
		  if (label && pill) {
		    pill.classList.remove("live", "warn", "busy");
		    if (!state.session) {
		      label.textContent = "无会话";
		    } else {
		      const st = state.session.status || "idle";
		      label.textContent = `${statusLabel(st)} · ${state.session.id.slice(0, 8)}`;
		      if (st === "running") pill.classList.add("busy");
		      else if (st === "waiting_permission") pill.classList.add("warn");
		      else if (st === "idle" || st === "completed") pill.classList.add("live");
		      else if (st === "failed") pill.classList.add("warn");
		    }
		  }
		  // Chat toolbar status chip (separate from topbar badge).
		  const statusNode = el("sessionStatusLabel");
		  const statusPill = statusNode?.closest(".session-status-pill");
		  if (statusNode) {
		    statusNode.textContent = state.session
		      ? statusLabel(state.session.status || "idle")
		      : "无会话";
		  }
		  if (statusPill) {
		    statusPill.classList.remove("live", "warn", "busy");
		    const cls = sessionStatusClass();
		    if (cls) statusPill.classList.add(cls);
		  }
		  updateModelProviderBadge();
		}

function setCrumb() {
  const node = el("crumb");
  if (!node) return;
  if (state.workspacePath) node.textContent = shortPath(state.workspacePath);
  else node.textContent = "未绑定工作区";
}

function pushMessage(msg) {
	  state.messages.push(msg);
	  if (state.page === "chat") {
	    if (el("chatLog")) updateChatLogIfPresent();
	    else renderPage("chat");
	  }
	}

	function appendStreamDelta(event) {
	  const messageId = event.messageId;
	  const chunk = event.text || "";
	  if (!messageId || !chunk) return;
	  const idx = state.messages.findIndex((m) => m.messageId === messageId && m.streaming);
	  if (idx >= 0) {
	    state.messages[idx] = {
	      ...state.messages[idx],
	      text: String(state.messages[idx].text || "") + chunk,
	    };
	  } else {
	    state.messages.push({
	      role: event.role || "assistant",
	      text: chunk,
	      messageId,
	      streaming: true,
	    });
	  }
	  if (state.page === "chat") {
	    if (el("chatLog")) updateChatLogIfPresent();
	    else renderPage("chat");
	  }
	}

	function finalizeStreamMessage(event) {
	  const messageId = event.messageId;
	  const idx = messageId
	    ? state.messages.findIndex((m) => m.messageId === messageId && m.streaming)
	    : -1;
	  if (idx >= 0) {
	    state.messages[idx] = {
	      role: event.role || "assistant",
	      text: event.text || "",
	      messageId,
	    };
	    if (state.page === "chat") {
	      if (el("chatLog")) updateChatLogIfPresent();
	      else renderPage("chat");
	    }
	    return;
	  }
	  pushMessage({ role: event.role, text: event.text, messageId });
	}

function updateChatLogIfPresent() {
  const log = el("chatLog");
  if (!log) return;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.innerHTML = renderMessagesHtml();
  if (nearBottom) log.scrollTop = log.scrollHeight;
}

function renderMessagesHtml() {
if (!state.messages.length) {
	    return `<div class="empty-state">
	      <div class="empty-icon">${ICONS.chat}</div>
	      <h3>开始一次编码会话</h3>
	      <p>打开工作区并创建会话后，可让智能体检查、编辑文件或执行命令。输入 <code>/</code> 打开命令；长运行目标用 <code>/goal …</code>（见任务页）。</p>
	      <div class="chips" style="justify-content:center">
	        <button type="button" class="chip" data-fill="/goal ">长运行 /goal</button>
	        <button type="button" class="chip" data-fill="list">列出文件</button>
	        <button type="button" class="chip" data-fill="read README.md">读取 README</button>
	        <button type="button" class="chip" data-fill="write demo to hfq-demo.txt">写入演示文件</button>
	      </div>
	    </div>`;
	  }

  return state.messages
    .map((m) => {
      const role = m.role || "system";
      const body =
        role === "tool"
          ? escapeHtml(m.text || "") +
            (m.detail
              ? `<pre>${escapeHtml(
                  typeof m.detail === "string" ? m.detail : JSON.stringify(m.detail, null, 2),
                )}</pre>`
              : "")
          : escapeHtml(m.text || "");
return `<div class="msg ${role}${m.streaming ? " streaming" : ""}"><div class="msg-role">${escapeHtml(roleLabel(role))}${
	        m.name ? ` · ${escapeHtml(m.name)}` : ""
	      }${m.streaming ? " · 输出中" : ""}</div><div class="msg-body">${body}</div></div>`;
	    })
	    .join("");
	}

const PERMISSION_MODES = [
	  {
	    id: "confirm_before_change",
	    label: "变更前确认",
	    short: "确认",
	    hint: "写入、补丁、Shell、网络等变更前询问",
	  },
	  {
	    id: "auto_edit",
	    label: "自动编辑",
	    short: "自动编辑",
	    hint: "自动允许写文件/补丁；Shell 与网络仍询问",
	  },
	  {
	    id: "plan",
	    label: "计划模式",
	    short: "计划",
	    hint: "只读规划；禁止写文件、补丁与 Shell",
	  },
	  {
	    id: "full_access",
	    label: "完全访问",
	    short: "完全访问",
	    hint: "全部放行（含危险 Shell）· 真·YOLO",
	    warn: true,
	  },
	];

/** Slash / skill palette items (ZCode-style). */
const SLASH_COMMANDS = [
  {
    id: "help",
    kind: "command",
    trigger: "/help",
    label: "/help",
    hint: "列出常用命令与技能用法",
    insert: "help",
  },
  {
    id: "list",
    kind: "command",
    trigger: "/list",
    label: "/list",
    hint: "列出工作区文件",
    insert: "list",
  },
  {
    id: "read",
    kind: "command",
    trigger: "/read",
    label: "/read",
    hint: "读取指定文件",
    insert: "read README.md",
  },
  {
    id: "search",
    kind: "command",
    trigger: "/search",
    label: "/search",
    hint: "用 grep 搜索代码",
    insert: "用 grep 搜索 HFQ",
  },
  {
    id: "git",
    kind: "command",
    trigger: "/git",
    label: "/git",
    hint: "查看 git status",
    insert: "git status",
  },
  {
    id: "write",
    kind: "command",
    trigger: "/write",
    label: "/write",
    hint: "写入演示文件（会走权限）",
    insert: "write demo to hfq-demo.txt",
  },
  {
    id: "patch",
    kind: "command",
    trigger: "/patch",
    label: "/patch",
    hint: "应用补丁演示",
    insert: "apply_patch demo",
  },
  {
    id: "fetch",
    kind: "command",
    trigger: "/fetch",
    label: "/fetch",
    hint: "发起网络请求（会走权限）",
    insert: "fetch https://example.com",
  },
  {
    id: "shell",
    kind: "command",
    trigger: "/shell",
    label: "/shell",
    hint: "执行 shell 命令（会走权限）",
    insert: "shell echo HFQ-Code",
  },
  {
    id: "goal",
    kind: "command",
    trigger: "/goal",
    label: "/goal",
    hint: "长运行目标：提高本轮轮次/工具预算，并记入任务页",
    insert: "/goal ",
  },
  {
    id: "compact",
    kind: "command",
    trigger: "/compact",
    label: "/compact",
    hint: "请求压缩上下文，只保留关键结论",
    insert: "/compact ",
  },
];

function skillPaletteItems() {
  const list = Array.isArray(state.skills) ? state.skills : [];
  return list
    .filter((s) => s && s.name && s.eligible !== false)
    .slice(0, 24)
    .map((s) => ({
      id: `skill:${s.name}`,
      kind: "skill",
      trigger: `$${s.name}`,
      label: `$${s.name}`,
      hint: String(s.description || s.source || "技能").slice(0, 80),
      insert: `使用技能 ${s.name}：`,
    }));
}

function paletteItems() {
  return [...SLASH_COMMANDS, ...skillPaletteItems()];
}

function truncateLabel(text, max = 36) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function sessionStatusClass() {
  if (!state.session) return "";
  const st = state.session.status || "idle";
  if (st === "running") return "busy";
  if (st === "waiting_permission" || st === "failed") return "warn";
  if (st === "idle" || st === "completed") return "live";
  return "";
}

function renderAccessModeMenuHtml(mode, opts = {}) {
  const { buttonId = "accessModeBtn", panelId = "accessModePanel", menuId = "accessModeMenu" } =
    opts;
  const modeBtnClass =
    mode.id === "full_access"
      ? "warn"
      : mode.id === "plan" || mode.id === "auto_edit"
        ? "primary"
        : "ghost";
  const modeMenu = PERMISSION_MODES.map((m) => {
    const active = m.id === mode.id;
    return `<button type="button" class="mode-menu-item${active ? " active" : ""}${
      m.warn ? " warn" : ""
    }" data-set-mode="${m.id}" role="menuitem">
      <span class="mode-menu-check">${active ? "✓" : ""}</span>
      <span class="mode-menu-text">
        <span class="mode-menu-label">${escapeHtml(m.label)}</span>
        <span class="mode-menu-hint">${escapeHtml(m.hint)}</span>
      </span>
    </button>`;
  }).join("");
  return `<div class="mode-menu mode-menu-up" id="${menuId}">
    <button type="button" class="btn ${modeBtnClass} sm composer-ctl" id="${buttonId}" title="${escapeHtml(
      mode.hint,
    )}" ${state.session?.id ? "" : "disabled"} aria-haspopup="menu" aria-expanded="false">
      <span class="composer-ctl-kicker">访问</span>
      <span class="composer-ctl-value">${escapeHtml(mode.short)}</span>
      <span class="composer-ctl-caret">▴</span>
    </button>
    <div class="mode-menu-panel mode-menu-panel-up hidden" id="${panelId}" role="menu">
      ${modeMenu}
      <div class="mode-menu-sep"></div>
      <button type="button" class="mode-menu-item" id="accessModeSetDefault" role="menuitem">
        <span class="mode-menu-check"></span>
        <span class="mode-menu-text">
          <span class="mode-menu-label">设为默认</span>
          <span class="mode-menu-hint">写入全局偏好，新建会话沿用当前模式</span>
        </span>
      </button>
    </div>
  </div>`;
}

function renderModelMenuHtml(provider, model) {
  const providers = Array.isArray(state.config?.providers) ? state.config.providers : [];
  const activeProvider =
    providers.find((p) => p.id === provider) || providers[0] || { id: provider, models: [model] };
  const models = Array.isArray(activeProvider.models) && activeProvider.models.length
    ? activeProvider.models
    : [model];
  const providerItems = providers
    .map((p) => {
      const active = p.id === activeProvider.id;
      return `<button type="button" class="mode-menu-item${active ? " active" : ""}" data-set-provider="${escapeHtml(
        p.id,
      )}" role="menuitem">
        <span class="mode-menu-check">${active ? "✓" : ""}</span>
        <span class="mode-menu-text">
          <span class="mode-menu-label">${escapeHtml(p.name || p.id)}</span>
          <span class="mode-menu-hint">${escapeHtml(p.id)} · ${(p.models || []).length} 模型</span>
        </span>
      </button>`;
    })
    .join("");
  const modelItems = models
    .map((m) => {
      const active = m === model;
      return `<button type="button" class="mode-menu-item${active ? " active" : ""}" data-set-model="${escapeHtml(
        m,
      )}" data-provider-id="${escapeHtml(activeProvider.id)}" role="menuitem">
        <span class="mode-menu-check">${active ? "✓" : ""}</span>
        <span class="mode-menu-text">
          <span class="mode-menu-label mono">${escapeHtml(m)}</span>
        </span>
      </button>`;
    })
    .join("");
  const providerLabel = activeProvider.name || activeProvider.id || provider;
  return `<div class="mode-menu mode-menu-up mode-menu-end" id="modelMenu">
    <button type="button" class="btn ghost sm composer-ctl" id="modelMenuBtn" title="${escapeHtml(
      `${providerLabel} / ${model}`,
    )}" aria-haspopup="menu" aria-expanded="false">
      <span class="composer-ctl-kicker">模型</span>
      <span class="composer-ctl-value mono" id="modelMenuLabel">${escapeHtml(truncateLabel(model, 28))}</span>
      <span class="composer-ctl-caret">▴</span>
    </button>
    <div class="mode-menu-panel mode-menu-panel-up mode-menu-panel-end hidden" id="modelMenuPanel" role="menu">
      <button type="button" class="mode-menu-item" id="openModelsPageBtn" role="menuitem">
        <span class="mode-menu-check"></span>
        <span class="mode-menu-text">
          <span class="mode-menu-label">打开模型页</span>
          <span class="mode-menu-hint">配置 API Key、baseURL 与模型列表</span>
        </span>
      </button>
      <div class="mode-menu-sep"></div>
      <div class="mode-menu-section">提供方</div>
      ${providerItems || `<div class="mode-menu-empty">无提供方</div>`}
      <div class="mode-menu-sep"></div>
      <div class="mode-menu-section">模型</div>
      ${modelItems}
    </div>
  </div>`;
}

function renderSlashPaletteHtml() {
  const items = paletteItems()
    .map(
      (item, idx) => `<button type="button" class="slash-item${idx === 0 ? " active" : ""}" data-palette-id="${escapeHtml(
        item.id,
      )}" data-palette-insert="${escapeHtml(item.insert)}" data-palette-kind="${escapeHtml(
        item.kind,
      )}" role="option">
        <span class="slash-item-main">
          <span class="slash-item-label">${escapeHtml(item.label)}</span>
          <span class="slash-item-hint">${escapeHtml(item.hint)}</span>
        </span>
        <span class="slash-item-kind">${item.kind === "skill" ? "技能" : "命令"}</span>
      </button>`,
    )
    .join("");
  return `<div class="slash-palette hidden" id="slashPalette" role="listbox" aria-label="命令与技能">
    <div class="slash-palette-head">
      <span>命令与技能</span>
      <span class="faint">输入 <code>/</code> 或 <code>$</code> 过滤 · Esc 关闭</span>
    </div>
    <div class="slash-palette-list" id="slashPaletteList">${items}</div>
  </div>`;
}

function normalizePermissionMode(mode) {
  const id = String(mode || "");
  if (PERMISSION_MODES.some((m) => m.id === id)) return id;
  return "confirm_before_change";
}

function permissionModeMeta(mode) {
  const id = normalizePermissionMode(mode);
  return PERMISSION_MODES.find((m) => m.id === id) || PERMISSION_MODES[0];
}

function applyPermissionModeState(mode, planMode) {
  const next = normalizePermissionMode(mode);
  state.permissionMode = next;
  state.planMode = planMode == null ? next === "plan" : Boolean(planMode);
  if (state.session) {
    state.session = {
      ...state.session,
      permissionMode: next,
      planMode: state.planMode,
    };
  }
}

function enqueuePermissionRequest(req) {
  if (!req?.requestId) return;
  const exists = state.permissionQueue.some((r) => r.requestId === req.requestId);
  if (exists) return;
  if (state.pendingPermission?.requestId === req.requestId) return;
  // Prefer active-session requests at the front of the queue.
  const isActive = state.session?.id && req.sessionId === state.session.id;
  if (isActive) state.permissionQueue.unshift(req);
  else state.permissionQueue.push(req);
  presentNextPermission();
}

function presentNextPermission() {
  if (state.permissionResolving) return;
  if (state.pendingPermission) return;
  const next = state.permissionQueue.shift();
  if (!next) {
    el("permModal")?.classList.add("hidden");
    return;
  }
  showPermissionModal(next);
}

function showPermissionModal(req) {
  state.pendingPermission = req;
  const summary = req.summary || "";
  const sessionHint =
    req.sessionId && state.session?.id && req.sessionId !== state.session.id
      ? `\n（来自会话 ${String(req.sessionId).slice(0, 8)}…）`
      : "";
  const queueHint =
    state.permissionQueue.length > 0 ? `\n队列中还有 ${state.permissionQueue.length} 项` : "";
  el("permSummary").textContent = summary + sessionHint + queueHint;
  el("permTool").textContent = req.toolName || "工具";
  el("permRisk").textContent = riskLabel(req.risk);
  el("permModal").classList.remove("hidden");
}

function hidePermissionModal() {
  state.pendingPermission = null;
  el("permModal").classList.add("hidden");
}

function clearPermissionQueue(reason) {
  state.permissionQueue = [];
  state.permissionResolving = false;
  if (state.pendingPermission) {
    hidePermissionModal();
    if (reason) {
      pushMessage({ role: "system", text: reason });
    }
  } else {
    el("permModal")?.classList.add("hidden");
  }
}

async function resolveCurrentPermission(decision) {
  const pending = state.pendingPermission;
  if (!pending?.requestId || state.permissionResolving) return;
  const requestId = pending.requestId;
  state.permissionResolving = true;
  const actions = el("permModal")?.querySelectorAll("[data-perm]");
  actions?.forEach((btn) => {
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
  });
  try {
    const res = await window.hfq.resolvePermission({ requestId, decision });
    const ok = res === true || res?.ok === true || res == null;
    // Main returns boolean; treat explicit false as failure.
    if (res === false || res?.ok === false) {
      throw new Error("授权请求已失效或会话已结束");
    }
    void ok;
    // Only hide after successful resolve — avoids orphaned waiter / stuck busy.
    if (state.pendingPermission?.requestId === requestId) {
      hidePermissionModal();
    }
    state.permissionResolving = false;
    actions?.forEach((btn) => {
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
    });
    presentNextPermission();
  } catch (err) {
    state.permissionResolving = false;
    actions?.forEach((btn) => {
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
    });
    // Keep modal visible so the user can retry or deny.
    pushMessage({
      role: "error",
      text: `授权提交失败: ${err instanceof Error ? err.message : String(err)}`,
    });
    setStatus("授权提交失败，请重试或拒绝", "warn");
    if (state.pendingPermission?.requestId === requestId) {
      el("permModal")?.classList.remove("hidden");
    }
  }
}

async function ensureSession() {
	  if (!state.workspacePath) throw new Error("请先打开工作区");
	  if (state.session?.workspacePath === state.workspacePath) return state.session;
	  return createFreshSession();
	}

function setComposerEnabled(enabled) {
	  const input = el("chatInput");
	  const btn = el("sendBtn");
	  const stop = el("stopSessionBtn");
	  if (input) input.disabled = !enabled;
	  if (btn) btn.disabled = !enabled;
	  if (stop) stop.disabled = enabled;
	}

	async function stopSession() {
	  if (!state.session?.id) return;
	  try {
	    setStatus("正在停止…", "warn");
	    await window.hfq.abortSession({ sessionId: state.session.id });
	  } catch (err) {
	    pushMessage({ role: "error", text: err instanceof Error ? err.message : String(err) });
	    setStatus("停止失败", "warn");
	  }
	}

async function sendChat(text) {
	  const content = text.trim();
	  if (!content || state.busy) return;
	  const isGoal = /^\/goal(?:\s|$)/i.test(content);
	  const isBareGoal = /^\/goal\s*$/i.test(content);
	  try {
	    state.busy = true;
	    setComposerEnabled(false);
	    await ensureSession();
	    pushMessage({ role: "user", text: content });
	    if (isGoal && !isBareGoal) {
	      setStatus("Goal 长运行中…（可停止）", "busy");
	      pushMessage({
	        role: "system",
	        text: "已进入 /goal 长运行模式：本轮提高轮次与工具预算，进度见「任务」页。可用停止中断。",
	      });
	    } else if (isBareGoal) {
	      setStatus("请补充 /goal 目标", "warn");
	    } else {
	      setStatus("智能体运行中…", "busy");
	    }
	    if (state.session) {
	      state.session = { ...state.session, status: "running" };
	      setSessionBadge();
	    }
	    await window.hfq.sendMessage({ sessionId: state.session.id, text: content });
	    // Bare /goal only returns a usage hint; unlock composer when idle event may not flip busy.
	    if (isBareGoal) {
	      state.busy = false;
	      setComposerEnabled(true);
	      if (state.session) {
	        state.session = { ...state.session, status: "idle" };
	        setSessionBadge();
	      }
	    }
	  } catch (err) {
	    pushMessage({ role: "error", text: err instanceof Error ? err.message : String(err) });
	    setStatus("出错", "warn");
	    state.busy = false;
	    setComposerEnabled(true);
	  }
	}

function handleSessionEvent(event) {
	  if (!event || !event.type) return;
	  // Deltas are high-frequency UI events; keep audit for durable steps only.
	  if (event.type !== "message.delta") {
	    state.audit.unshift(event);
	    if (state.audit.length > 200) state.audit.length = 200;
	  }

if (state.session && event.sessionId === state.session.id) {
	    if (
	      event.type === "session.completed" ||
	      event.type === "session.failed" ||
	      event.type === "session.aborted"
	    ) {
	      state.busy = false;
	      setComposerEnabled(true);
	      state.session = {
	        ...state.session,
	        status: event.type === "session.failed" ? "failed" : "idle",
	      };
	      setSessionBadge();
	      if (event.type === "session.failed") setStatus("失败", "warn");
	      else if (event.type === "session.aborted") setStatus("已停止", "warn");
	      else setStatus("空闲", "live");
	    }
if (event.type === "session.failed") {
		      clearPermissionQueue("会话失败，已取消待处理授权");
		      pushMessage({ role: "error", text: event.error || "会话失败" });
		    }
		    if (event.type === "session.aborted") {
		      clearPermissionQueue();
		      pushMessage({ role: "system", text: "会话已由用户停止" });
		    }
		  }

switch (event.type) {
	    case "message.delta":
	      if (event.role === "user") break;
	      appendStreamDelta(event);
	      break;
	    case "message.completed":
	      if (event.role === "user") break;
	      finalizeStreamMessage(event);
	      break;
	    case "tool.started":
      pushMessage({ role: "tool", name: event.name, text: `开始执行 ${event.name}`, detail: event.input });
      break;
case "tool.completed":
	      pushMessage({
	        role: "tool",
	        name: event.name,
	        text: event.ok ? `完成 ${event.name}` : `失败 ${event.name}`,
	        detail: event.output,
	      });
	      if (event.name === "spawn_subagent") {
	        void refreshChildSessions().then(() => {
	          if (state.page === "tasks") renderPage("tasks");
	        });
	      }
	      break;
    case "permission.requested":
      enqueuePermissionRequest(event);
      setStatus("等待授权…", "warn");
      if (state.session && event.sessionId === state.session.id) {
        state.session = { ...state.session, status: "waiting_permission" };
        setSessionBadge();
      }
      break;
    case "permission.resolved": {
      const pendingTool =
        state.pendingPermission?.requestId === event.requestId
          ? state.pendingPermission?.toolName
          : state.permissionQueue.find((r) => r.requestId === event.requestId)?.toolName;
      // Drop from queue if still waiting; only hide modal when this request is front.
      state.permissionQueue = state.permissionQueue.filter(
        (r) => r.requestId !== event.requestId,
      );
      if (state.pendingPermission?.requestId === event.requestId) {
        hidePermissionModal();
        state.permissionResolving = false;
        presentNextPermission();
      }
      const decisionMap = {
        allow: "允许一次",
        deny: "拒绝",
        allow_session: "本会话允许",
      };
      pushMessage({
        role: "system",
        text: `权限决策: ${decisionMap[event.decision] || event.decision} · ${String(event.requestId).slice(0, 8)}`,
      });
      if (event.decision === "allow_session" && pendingTool) {
        if (!state.sessionAllows.includes(pendingTool)) {
          state.sessionAllows = [...state.sessionAllows, pendingTool].sort();
        }
        void refreshPolicy().then(() => {
          if (state.page === "permissions") {
            el("content").innerHTML = pageHtml("permissions");
            bindPermissionsHandlers();
          }
        });
      }
      break;
    }
    case "diff.updated":
      upsertChange(event);
      if (state.page === "changes") renderPage("changes");
      break;
    case "terminal.output":
      state.terminal.unshift({
        callId: event.callId,
        command: event.command,
        stdout: event.stdout,
        stderr: event.stderr,
        code: event.code,
        ok: event.ok,
        at: event.at,
      });
      if (state.terminal.length > 80) state.terminal.length = 80;
      if (state.page === "terminal") renderPage("terminal");
      break;
    case "task.updated":
      upsertTask(event);
      if (state.page === "tasks") renderPage("tasks");
      // Refresh goal banner without full chat re-render when possible
      if (state.page === "chat") {
        const existing = el("goalBanner");
        const html = renderGoalBannerHtml();
        if (html) {
          if (existing) {
            existing.outerHTML = html;
          } else {
            const log = el("chatLog");
            if (log) log.insertAdjacentHTML("beforebegin", html);
          }
          el("goalBannerStopBtn")?.addEventListener("click", () => {
            void stopSession();
          });
          el("goalBannerTasksBtn")?.addEventListener("click", () => {
            renderPage("tasks");
          });
        } else if (existing) {
          existing.remove();
        }
      }
      break;
    case "usage.updated":
      state.usage = {
        inputTokens: (state.usage?.inputTokens || 0) + (Number(event.inputTokens) || 0),
        outputTokens: (state.usage?.outputTokens || 0) + (Number(event.outputTokens) || 0),
      };
      setStatus(
        `tokens 本轮 入 ${event.inputTokens} / 出 ${event.outputTokens} · 累计 入 ${state.usage.inputTokens} / 出 ${state.usage.outputTokens}`,
        "busy",
      );
if (state.page === "chat") {
	        const usageNode = el("sessionUsage");
	        if (usageNode) {
	          usageNode.textContent = `入 ${state.usage.inputTokens} · 出 ${state.usage.outputTokens}`;
	        }
	      }
	      break;
	    case "session.meta":
	      if (event.title && state.session?.id === event.sessionId) {
	        state.session = { ...state.session, title: event.title };
	        if (event.model) state.session.model = event.model;
	        setSessionBadge();
	        setCrumb();
	        if (state.page === "chat") {
	          const titleNode = el("sessionTitleLabel");
	          if (titleNode) {
	            titleNode.textContent = truncateLabel(event.title, 42);
	            titleNode.title = event.title;
	          }
	          const statusNode = el("sessionStatusLabel");
	          if (statusNode) statusNode.textContent = statusLabel(state.session.status || "idle");
	        }
	        void refreshSessions();
	      }
	      break;
    default:
      break;
  }

  if (state.page === "audit") renderPage("audit");
}

function pageHome() {
	  const ws = state.workspacePath;
	  const provider = state.config?.activeProviderId || "mock";
	  const model = state.config?.activeModel || "mock-hfq";
	  const sessions = state.recentSessions || [];
	  const sessionRows = sessions.length
	    ? sessions
	        .slice(0, 12)
	        .map((s) => {
	          const active = state.session?.id === s.id ? "active" : "";
	          const title = s.title || s.id.slice(0, 8);
	          const meta = `${s.id.slice(0, 8)} · ${statusLabel(s.status)} · ${formatSessionTime(s.updatedAt)}`;
	          const wsHint = s.workspacePath ? shortPath(s.workspacePath) : "";
return `<div class="session-item ${active}">
		            <button type="button" class="session-item-main" data-open-session="${escapeHtml(s.id)}">
		              <div>
		                <div class="title">${escapeHtml(title)}</div>
		                <div class="meta">${escapeHtml(meta)}${wsHint ? ` · ${escapeHtml(wsHint)}` : ""}</div>
		              </div>
		              <span class="badge ${s.id === state.session?.id ? "ok" : "info"}">${
		                s.id === state.session?.id ? "当前" : "打开"
		              }</span>
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
	: `<div class="empty-state" style="padding:18px 8px"><h3>暂无历史会话</h3><p>创建会话后会自动写入 %APPDATA%/HFQ-Code/sessions，可从这里一键恢复消息、变更与终端输出。</p></div>`;

	  const recentWs = state.config?.recentWorkspaces || [];
	  const wsRows = recentWs.length
	    ? recentWs
	        .slice(0, 8)
	        .map((p) => {
	          const active = ws && pathEquals(ws, p) ? "active" : "";
	          return `<button type="button" class="session-item ${active}" data-open-workspace="${escapeHtml(p)}">
	            <div>
	              <div class="title">${escapeHtml(shortPath(p))}</div>
	              <div class="meta">${escapeHtml(p)}</div>
	            </div>
	            <span class="badge ${active ? "ok" : "info"}">${active ? "当前" : "打开"}</span>
	          </button>`;
	        })
	        .join("")
	    : `<div class="empty-state" style="padding:18px 8px"><h3>暂无最近工作区</h3><p>打开文件夹后会记录在配置里，方便下次继续。</p></div>`;

	  return `
	    <div class="home-hero">
	      <div class="panel home-spotlight">
	        <div>
	          <div class="home-kicker">本地编码工作台</div>
	          <h2 class="home-title">在文件夹里直接开工</h2>
	          <p class="home-copy">绑定工作区、运行带工具的会话，写入与危险 shell 会先征求你的同意。可先用 mock 离线演示，再切换到任意 OpenAI 兼容接口。</p>
	        </div>
	        <div class="home-actions">
	          <button type="button" class="btn primary" id="homeOpenWs">打开工作区</button>
	          <button type="button" class="btn" id="homeGoSession" ${ws ? "" : "disabled"}>进入会话</button>
	        </div>
	      </div>
	      <div class="panel">
	        <div class="panel-head">
	          <div>
	            <h2>上手路径</h2>
	            <p>三步跑通完整循环</p>
	          </div>
	        </div>
	        <div class="steps">
	          <div class="step"><div class="step-n">1</div><div><strong>绑定项目文件夹</strong><span>工具调用限制在工作区根目录内</span></div></div>
	          <div class="step"><div class="step-n">2</div><div><strong>创建会话</strong><span>流式接收消息、工具与授权请求</span></div></div>
	          <div class="step"><div class="step-n">3</div><div><strong>复核变更</strong><span>写入会进入变更列表，并留下审计记录</span></div></div>
	        </div>
	      </div>
	    </div>
	    <div class="grid-3">
	      <div class="metric">
	        <div class="metric-label">工作区</div>
	        <div class="metric-value">${ws ? "已绑定" : "未绑定"}</div>
	        <div class="metric-meta">${escapeHtml(ws ? shortPath(ws) : "选择一个项目目录")}</div>
	      </div>
	      <div class="metric">
	        <div class="metric-label">提供方</div>
	        <div class="metric-value">${escapeHtml(provider)}</div>
	        <div class="metric-meta">${escapeHtml(model)}</div>
	      </div>
	      <div class="metric">
	        <div class="metric-label">会话</div>
	        <div class="metric-value">${state.session ? "进行中" : "待命"}</div>
	        <div class="metric-meta">${state.session ? escapeHtml(state.session.id.slice(0, 8)) : "在会话页创建"}</div>
	      </div>
	    </div>
	    <div class="panel" style="margin-top:14px">
	      <div class="panel-head">
	        <div>
	          <h2>最近工作区</h2>
	          <p>配置内记录 · 共 ${recentWs.length} 条</p>
	        </div>
	      </div>
	      <div class="session-list">${wsRows}</div>
	    </div>
	    <div class="panel" style="margin-top:14px">
	      <div class="panel-head">
	        <div>
	          <h2>最近会话</h2>
	          <p>从 JSONL 转录恢复上下文 · 共 ${sessions.length} 条</p>
	        </div>
	        <button type="button" class="btn ghost sm" id="homeRefreshSessions">刷新</button>
	      </div>
	      <div class="session-list">${sessionRows}</div>
	    </div>`;
	}

	function pathEquals(a, b) {
	  return String(a || "").replaceAll("/", "\\").toLowerCase() === String(b || "").replaceAll("/", "\\").toLowerCase();
	}

function pageChat() {
  const provider = state.config?.activeProviderId || "mock";
  const model = state.session?.model || state.config?.activeModel || "mock-hfq";
  const rawTitle = state.session?.title || "";
  const title = rawTitle ? truncateLabel(rawTitle, 42) : state.session ? "未命名会话" : "未创建会话";
  const titleFull = rawTitle || title;
  const statusText = state.session
    ? statusLabel(state.session.status || "idle")
    : "无会话";
  const statusCls = sessionStatusClass();
  const usageText = `入 ${state.usage?.inputTokens || 0} · 出 ${state.usage?.outputTokens || 0}`;
  const mode = permissionModeMeta(state.permissionMode);
  const sessionIdShort = state.session?.id ? state.session.id.slice(0, 8) : "";

  return `
    <div class="chat-layout">
      <div class="chat-toolbar">
        <div class="chat-toolbar-left">
          <button type="button" class="btn primary sm" id="startSessionBtn">新建会话</button>
          <button type="button" class="btn ghost sm" id="clearChatBtn">清空视图</button>
          <button type="button" class="btn ghost sm" id="stopSessionBtn" ${state.busy ? "" : "disabled"}>停止</button>
          <button type="button" class="btn ghost sm" id="renameSessionBtn" ${
            state.session?.id ? "" : "disabled"
          }>重命名</button>
          <button type="button" class="btn ghost sm" id="spawnExploreBtn" ${
            state.session?.id && !state.busy ? "" : "disabled"
          }>派生子代理</button>
        </div>
        <div class="chat-toolbar-meta">
          <div class="session-meta-card" title="${escapeHtml(titleFull)}">
            <div class="session-meta-top">
              <div class="pill session-status-pill ${statusCls}">
                <span class="dot"></span>
                <span id="sessionStatusLabel">${escapeHtml(statusText)}</span>
              </div>
              ${
                sessionIdShort
                  ? `<span class="session-id mono" title="${escapeHtml(state.session.id)}">${escapeHtml(
                      sessionIdShort,
                    )}</span>`
                  : ""
              }
            </div>
            <div class="session-title-line" id="sessionTitleLabel">${escapeHtml(title)}</div>
            <div class="session-meta-sub">
              <span class="session-provider-chip" title="模型提供方">${escapeHtml(provider)}</span>
              <span class="session-model-chip mono" title="${escapeHtml(`${provider} / ${model}`)}">${escapeHtml(
                truncateLabel(model, 32),
              )}</span>
              <span class="faint mono" id="sessionUsage">${escapeHtml(usageText)}</span>
            </div>
          </div>
        </div>
      </div>
      ${renderGoalBannerHtml()}
      <div id="chatLog" class="chat-log">${renderMessagesHtml()}</div>
      <div class="composer-shell">
        ${renderSlashPaletteHtml()}
        <textarea id="chatInput" placeholder="描述任务，或 /goal 长运行目标 · / 命令 · $ 技能…" ${
          state.busy ? "disabled" : ""
        }></textarea>
        <div class="composer-bar">
          <div class="composer-controls">
            ${renderAccessModeMenuHtml(mode)}
            ${renderModelMenuHtml(provider, model)}
            <button type="button" class="btn ghost sm composer-ctl" id="slashToggleBtn" title="命令与技能" ${
              state.busy ? "disabled" : ""
            }>
              <span class="composer-ctl-value">/ 命令</span>
            </button>
          </div>
          <div class="composer-actions">
            <span class="composer-hint faint">Enter 发送 · Shift+Enter 换行</span>
            <button type="button" class="btn primary" id="sendBtn" ${state.busy ? "disabled" : ""}>发送</button>
          </div>
        </div>
      </div>
    </div>`;
}

function pageChanges() {
		  if (!state.changes.length) {
		    return `<div class="panel"><div class="empty-state"><div class="empty-icon">${ICONS.changes}</div><h3>还没有文件写入</h3><p>智能体写入文件后，这里会显示路径与行级 diff。可在会话中尝试 <code>write demo to hfq-demo.txt</code>。</p></div></div>`;
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
		  const list = filtered.length
		    ? filtered
		        .map((c) => {
		          const active = c.path === selected.path ? "active" : "";
		          let badgeClass = "info";
		          let badgeText = kindLabel(c.kind);
		          if (c.rejected) {
		            badgeClass = "bad";
		            badgeText = "已回滚";
		          } else if (c.accepted) {
		            badgeClass = "ok";
		            badgeText = "已接受";
		          }
		          return `<button type="button" class="change-item ${active}" data-change-path="${escapeHtml(c.path)}">
		        <span class="path">${escapeHtml(c.path)}</span>
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
		  return `<div class="change-layout">
			    <div class="panel">
			      <div class="panel-head"><div><h2>变更</h2><p>本会话写入 · 可全部或按块接受/回滚 · 支持路径过滤</p></div><span class="badge">${filtered.length}/${state.changes.length}</span></div>
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
			          <h2>${escapeHtml(selected.path)}</h2>
			          <p>${escapeHtml(kindLabel(selected.kind))}${selected.at ? ` · ${escapeHtml(formatSessionTime(selected.at))}` : ""} · 勾选 diff 块后可部分应用</p>
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
			      <div class="diff-view">${renderDiffHtml(selected)}</div>
			    </div>
			  </div>`;
			}

function formatUpdateStatus(result, currentVersionFallback) {
  const current =
    result?.currentVersion || currentVersionFallback || state.appPaths?.version || "—";
  const via =
    result?.source === "direct"
      ? "直连 GitHub"
      : result?.source === "ungh"
        ? "ungh.cc 镜像"
        : result?.source === "ghproxy"
          ? `ghproxy${result.proxyBase ? ` · ${result.proxyBase}` : ""}`
          : "";
  const fallbackNote = result?.fallbackUsed
    ? result?.source === "direct"
      ? " · 已自动回退直连"
      : result?.source === "ungh"
        ? " · 已自动回退 ungh"
        : " · 已切换备用源"
    : "";
  const viaSuffix = via ? ` · 经由 ${via}${fallbackNote}` : fallbackNote;
  const apiNote =
    result?.apiUrl && !result.skipped
      ? ` · API ${String(result.apiUrl).length > 72 ? `${String(result.apiUrl).slice(0, 72)}…` : result.apiUrl}`
      : "";
  if (!result) {
    return `当前版本 ${current} · 尚未检查（默认 ghproxy；失败时依次尝试备用镜像 / ungh / 直连）`;
  }
  if (result.skipped && result.reason === "throttled") {
    return `当前版本 ${current} · 距上次检查不足 6 小时（可点「检查新版本」强制查询）${viaSuffix}`;
  }
  if (!result.ok) {
    return `当前版本 ${current} · 检查失败：${result.error || "网络错误"}${viaSuffix}${apiNote}`;
  }
  if (result.updateAvailable && result.latestVersion) {
    return `发现新版本 ${result.latestVersion}（当前 ${current}）· 请下载安装包覆盖安装${viaSuffix}${apiNote}`;
  }
  if (result.latestVersion) {
    return `已是最新 · 当前 ${current} · 远端 ${result.latestVersion}${viaSuffix}${apiNote}`;
  }
  return `当前版本 ${current} · ${result.message || "暂无远端版本信息"}${viaSuffix}${apiNote}`;
}

function getActiveGoalTask() {
  if (window.HFQSkillsUI?.activeGoalTask) {
    return window.HFQSkillsUI.activeGoalTask(state.tasks);
  }
  return (
    (state.tasks || []).find(
      (t) =>
        t?.status === "in_progress" &&
        (String(t.taskId || "").startsWith("goal_") ||
          String(t.title || "")
            .toLowerCase()
            .startsWith("goal:")),
    ) || null
  );
}

function renderGoalBannerHtml() {
  const goal = getActiveGoalTask();
  if (!goal) return "";
  const title = String(goal.title || "goal").replace(/^goal:\s*/i, "");
  const detail = goal.detail || "长运行进行中";
  return `<div class="goal-banner" id="goalBanner" role="status">
    <div class="goal-banner-main">
      <span class="badge info">/goal</span>
      <div>
        <div class="goal-banner-title">${escapeHtml(truncateLabel(title, 64))}</div>
        <div class="faint mono" style="font-size:11px">${escapeHtml(detail)}</div>
      </div>
    </div>
    <div class="row" style="gap:6px">
      <button type="button" class="btn ghost sm" id="goalBannerTasksBtn">任务页</button>
      <button type="button" class="btn sm warn" id="goalBannerStopBtn" ${
        state.busy ? "" : "disabled"
      }>停止</button>
    </div>
  </div>`;
}

function renderUpdateAssetsHtml(result) {
  if (!result?.updateAvailable || !Array.isArray(result.assets) || !result.assets.length) {
    return "";
  }
  const rows = result.assets
    .filter((a) => /\.exe$/i.test(a.name || ""))
    .slice(0, 6)
    .map((a) => {
      const mb = a.size ? `${(a.size / (1024 * 1024)).toFixed(1)} MB` : "";
      const mirror = a.mirrorUrl
        ? ` · <button type="button" class="btn ghost sm" data-open-update-url="${escapeHtml(
            a.mirrorUrl,
          )}">镜像下载</button>`
        : "";
      const direct = a.url
        ? ` <button type="button" class="btn ghost sm" data-open-update-url="${escapeHtml(
            a.url,
          )}">直链</button>`
        : "";
      return `<li class="faint mono" style="margin:6px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <span>${escapeHtml(a.name)}${mb ? ` · ${mb}` : ""}</span>${mirror}${direct}
      </li>`;
    })
    .join("");
  if (!rows) return "";
  return `<ul style="margin:8px 0 0;padding-left:18px;list-style:disc">${rows}</ul>
    <p class="faint" style="margin-top:6px">默认检查走 ghproxy；下载可用镜像或直链。也可「打开发布页」后手动选择 NSIS / portable。</p>`;
}

function pageSettings() {
			  const paths = state.appPaths || {};
const prefs = state.config?.prefs || {
					    theme: "dark",
					    proxyUrl: "",
					    memoryEnabled: true,
					    compactMaxChars: 48000,
					    usageInputPerMillion: 0,
					    usageOutputPerMillion: 0,
					    planModeDefault: false,
					    permissionMode: "confirm_before_change",
					    checkUpdatesOnStartup: true,
					    updateSource: "ghproxy",
					    updateProxyBase: "https://ghproxy.com/",
					  };
				  const updateSource =
				    prefs.updateSource === "direct" ? "direct" : "ghproxy";
				  const updateProxyBase = prefs.updateProxyBase || "https://ghproxy.com/";
				  const prefPermissionMode = normalizePermissionMode(
				    prefs.permissionMode || (prefs.planModeDefault ? "plan" : "confirm_before_change"),
				  );
				  const prefModeOptions = PERMISSION_MODES.map(
				    (m) =>
				      `<option value="${m.id}" ${prefPermissionMode === m.id ? "selected" : ""}>${escapeHtml(
				        m.label,
				      )}${m.warn ? " ⚠" : ""}</option>`,
				  ).join("");
  const pathDefs = [
				    ["数据根目录", paths.root || "%APPDATA%/HFQ-Code", paths.root, "dir"],
				    ["会话 JSONL", paths.sessions || "…/sessions", paths.sessions, "dir"],
				    ["技能目录", paths.skills || "…/skills", paths.skills, "dir"],
				    ["记忆笔记", paths.memoryPath || paths.memory || "…/memory/notes.json", paths.memory || paths.memoryPath, "dir"],
				    ["配置文件", paths.configPath || "…/config.json", paths.configPath, "file"],
				    ["密钥文件", paths.credentialsPath || "…/credentials.json", paths.credentialsPath, "file"],
				    ["工作区", state.workspacePath || "(未绑定)", state.workspacePath, "dir"],
				    ["平台", paths.platform || "win32", null, null],
				    ["用户主目录", paths.homedir || "", paths.homedir, "dir"],
				    ["应用版本", paths.version || "1.0.0", null, null],
				  ];
		  const pathHtml = pathDefs
		    .map(([label, value, openTarget]) => {
		      const openBtn = openTarget
		        ? `<button type="button" class="btn ghost sm" data-open-path="${escapeHtml(
		            String(openTarget),
		          )}">打开</button>`
		        : "";
		      return `<div class="path-row">
		        <div class="label">${escapeHtml(label)}</div>
		        <div class="value">${escapeHtml(value || "—")}</div>
		        <div class="path-actions">${openBtn}</div>
		      </div>`;
		    })
		    .join("");

		  const provider = state.config?.activeProviderId || "mock";
		  const model = state.config?.activeModel || "mock-hfq";
		  const sessionMeta = state.session
		    ? `${state.session.id.slice(0, 8)} · ${statusLabel(state.session.status)} · ${escapeHtml(
		        state.session.title || "",
		      )}`
		    : "无活动会话";
		  const sessions = state.recentSessions || [];
		  const sessionManage = sessions.length
		    ? sessions
		        .slice(0, 10)
		        .map((s) => {
		          const title = s.title || s.id.slice(0, 8);
		          return `<div class="session-item">
		            <button type="button" class="session-item-main" data-open-session="${escapeHtml(s.id)}">
		              <div>
		                <div class="title">${escapeHtml(title)}</div>
		                <div class="meta">${escapeHtml(s.id.slice(0, 8))} · ${escapeHtml(
		                  statusLabel(s.status),
		                )} · ${escapeHtml(formatSessionTime(s.updatedAt))}</div>
		              </div>
		              <span class="badge info">打开</span>
		            </button>
		            <div class="session-actions">
		              <button type="button" class="btn ghost sm" data-rename-session="${escapeHtml(
		                s.id,
		              )}" data-session-title="${escapeHtml(title)}">改名</button>
		              <button type="button" class="btn ghost sm session-delete" data-delete-session="${escapeHtml(
		                s.id,
		              )}">删除</button>
		            </div>
		          </div>`;
		        })
		        .join("")
		    : `<div class="empty-state" style="padding:14px 8px"><p>暂无历史会话</p></div>`;

return `
			    <div class="panel">
			      <div class="panel-head">
			        <div>
			          <h2>设置</h2>
			          <p>本机路径、偏好、会话管理与运行摘要</p>
			        </div>
			        <button type="button" class="btn ghost sm" id="settingsRefreshBtn">刷新</button>
			      </div>
			      ${paths.error ? `<p class="form-status">${escapeHtml(paths.error)}</p>` : ""}
			      <div class="path-grid">${pathHtml}</div>
			    </div>
			    <div class="panel" style="margin-top:14px">
			      <div class="panel-head">
			        <div>
			          <h2>偏好</h2>
			          <p>主题、代理与上下文压缩（写入 config.json）</p>
			        </div>
			        <button type="button" class="btn sm" id="prefsSaveBtn">保存偏好</button>
			      </div>
			      <div class="grid-2">
			        <label class="field"><span>主题</span>
			          <select id="prefTheme">
			            <option value="dark" ${prefs.theme === "dark" ? "selected" : ""}>深色</option>
			            <option value="light" ${prefs.theme === "light" ? "selected" : ""}>浅色</option>
			          </select>
			        </label>
			        <label class="field"><span>HTTP 代理（可选）</span>
			          <input id="prefProxy" type="text" placeholder="http://127.0.0.1:7890" value="${escapeHtml(
			            prefs.proxyUrl || "",
			          )}" />
			        </label>
			        <label class="field"><span>上下文压缩阈值（字符）</span>
			          <input id="prefCompact" type="number" min="8000" max="200000" step="1000" value="${escapeHtml(
			            String(prefs.compactMaxChars || 48000),
			          )}" />
			        </label>
<label class="field row" style="align-items:center;gap:10px;margin-top:22px">
					          <input id="prefMemory" type="checkbox" ${prefs.memoryEnabled !== false ? "checked" : ""} />
					          <span>将会话提示注入本机记忆笔记</span>
					        </label>
					        <label class="field"><span>默认访问模式</span>
					          <select id="prefPermissionMode">${prefModeOptions}</select>
					        </label>
					        <p class="faint" style="grid-column:1/-1;margin:0">完全访问会自动允许危险 Shell（如删除命令），仅在你信任工作区时使用。会话工具栏可临时切换，不影响默认值。</p>
					        <label class="field"><span>用量单价 · Input $/1M</span>
				          <input id="prefInPrice" type="number" min="0" step="0.01" value="${escapeHtml(
				            String(prefs.usageInputPerMillion ?? 0),
				          )}" />
				        </label>
				        <label class="field"><span>用量单价 · Output $/1M</span>
				          <input id="prefOutPrice" type="number" min="0" step="0.01" value="${escapeHtml(
				            String(prefs.usageOutputPerMillion ?? 0),
				          )}" />
				        </label>
				      </div>
				      <p class="faint" style="margin-top:10px">代理字段已持久化；模型请求是否走代理取决于运行时环境变量（HTTP_PROXY/HTTPS_PROXY）。记忆：memory_search / memory_save · 子代理：spawn_subagent。</p>
				      <p class="form-status" id="prefsStatus"></p>
				    </div>
<div class="panel" style="margin-top:14px">
								      <div class="panel-head">
								        <div>
								          <h2>检查更新</h2>
								          <p>查询 GitHub Releases 最新版；默认经 <strong>ghproxy</strong>，失败时自动回退备用镜像 / ungh / 直连。仅提示/打开下载页，不会自动安装</p>
								        </div>
								        <div class="row" style="gap:6px">
								          <button type="button" class="btn sm" id="updateCheckBtn">检查新版本</button>
								          <button type="button" class="btn sm primary" id="updateOpenBtn">打开发布页</button>
								        </div>
								      </div>
								      <div class="form-grid" style="margin:4px 0 8px">
								        <label class="field"><span>更新源</span>
								          <select id="prefUpdateSource">
								            <option value="ghproxy" ${updateSource === "ghproxy" ? "selected" : ""}>ghproxy 镜像（推荐）</option>
								            <option value="direct" ${updateSource === "direct" ? "selected" : ""}>直连 api.github.com</option>
								          </select>
								        </label>
								        <label class="field"><span>ghproxy 基址</span>
								          <input id="prefUpdateProxyBase" type="url" placeholder="https://ghproxy.com/" value="${escapeHtml(
								            updateProxyBase,
								          )}" />
								        </label>
								      </div>
								      <p class="faint" style="margin:0 0 8px">API 请求形态：<code>{基址}https://api.github.com/repos/BB0813/HFQ-Code/releases/latest</code>。若 <code>ghproxy.com</code> 返回 HTML，程序会自动换源；也可把基址改成 <code>https://gh-proxy.com/</code> 后点「保存更新源」。</p>
								      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
								        <button type="button" class="btn sm ghost" id="updateSourceSaveBtn">保存更新源</button>
								        <label class="field row" style="align-items:center;gap:10px;margin:0">
								          <input id="prefCheckUpdates" type="checkbox" ${
								            prefs.checkUpdatesOnStartup !== false ? "checked" : ""
								          } />
								          <span>启动时自动检查（有新版本才提示）</span>
								        </label>
								      </div>
								      <p class="form-status" id="updateStatus">${escapeHtml(formatUpdateStatus(state.updateCheck, paths.version))}</p>
								      ${renderUpdateAssetsHtml(state.updateCheck)}
								    </div>
	<div class="panel" style="margin-top:14px">
							      <div class="panel-head">
							        <div>
							          <h2>诊断与发版</h2>
							          <p>导出脱敏配置与会话索引；安装包见 <code>pnpm pack:win</code>（需本机 electron-builder）</p>
							        </div>
							        <button type="button" class="btn sm" id="diagExportBtn">导出诊断包</button>
							      </div>
							      <p class="form-status" id="diagStatus"></p>
							      <div class="steps" style="margin-top:10px">
							        <div class="step"><div class="step-n">1</div><div><strong>打包</strong><span><code>pnpm pack:win</code> → NSIS + portable（apps/desktop/release）</span></div></div>
							        <div class="step"><div class="step-n">2</div><div><strong>更新策略</strong><span>设置页可检查 GitHub 新版本；手动下载 NSIS/portable 覆盖安装（无静默自动安装）</span></div></div>
							        <div class="step"><div class="step-n">3</div><div><strong>校验</strong><span><code>pnpm release:check</code> · <code>pnpm pack:verify</code>（解包冒烟）</span></div></div>
							        <div class="step"><div class="step-n">4</div><div><strong>签名</strong><span>SmartScreen 需代码签名证书（可选）</span></div></div>
							      </div>
							    </div>

					    <div class="panel" style="margin-top:14px">
					      <div class="panel-head">
					        <div>
					          <h2>工作区规则 · AGENTS.md</h2>
					          <p>项目级 Agent 规则（工作区根目录）；保存后新回合会读入上下文</p>
					        </div>
					        <div class="row" style="gap:6px">
					          <button type="button" class="btn sm ghost" id="agentsReloadBtn" ${
					            state.workspacePath ? "" : "disabled"
					          }>重新加载</button>
					          <button type="button" class="btn sm primary" id="agentsSaveBtn" ${
					            state.workspacePath ? "" : "disabled"
					          }>保存</button>
					        </div>
					      </div>
					      ${
					        !state.workspacePath
					          ? `<p class="faint">请先打开工作区</p>`
					          : `<textarea id="agentsEditor" class="input" rows="12" style="width:100%;font-family:ui-monospace,monospace;font-size:12px;line-height:1.45;resize:vertical">${escapeHtml(
					              state.agentsEditor?.content ?? "",
					            )}</textarea>
					          <p class="form-status" id="agentsStatus">${
					            state.agentsEditor?.exists === false
					              ? "文件尚不存在，保存将创建 AGENTS.md"
					              : state.agentsEditor?.error
					                ? escapeHtml(state.agentsEditor.error)
					                : "已加载工作区 AGENTS.md"
					          }</p>`
					      }
					    </div>
				    <div class="grid-3" style="margin-top:14px">
		      <div class="metric">
		        <div class="metric-label">活动提供方</div>
		        <div class="metric-value">${escapeHtml(provider)}</div>
		        <div class="metric-meta">${escapeHtml(model)}</div>
		      </div>
		      <div class="metric">
		        <div class="metric-label">活动会话</div>
		        <div class="metric-value">${state.session ? "已连接" : "无"}</div>
		        <div class="metric-meta">${sessionMeta}</div>
		      </div>
		      <div class="metric">
		        <div class="metric-label">历史会话</div>
		        <div class="metric-value">${sessions.length}</div>
		        <div class="metric-meta">磁盘 + 内存合并列表</div>
		      </div>
		    </div>
		    <div class="panel" style="margin-top:14px">
		      <div class="panel-head">
		        <div>
		          <h2>会话管理</h2>
		          <p>打开或删除 JSONL 转录（删除不可恢复）</p>
		        </div>
		        <span class="badge">${sessions.length}</span>
		      </div>
		      <div class="session-list">${sessionManage}</div>
		    </div>
		    <div class="panel" style="margin-top:14px">
		      <div class="panel-head">
		        <div>
		          <h2>说明</h2>
		          <p>敏感配置请在「模型」页管理；权限矩阵见「权限」页</p>
		        </div>
		      </div>
		      <div class="steps">
		        <div class="step"><div class="step-n">A</div><div><strong>会话持久化</strong><span>每条事件写入 JSONL，重启后可从首页恢复或在此删除</span></div></div>
		        <div class="step"><div class="step-n">B</div><div><strong>变更回滚</strong><span>「变更」页可全部或按块接受，或回滚到写入前内容</span></div></div>
		        <div class="step"><div class="step-n">C</div><div><strong>工作区边界</strong><span>工具路径解析会拒绝逃逸出工作区根目录</span></div></div>
		      </div>
		    </div>`;
		}

function pageTerminal() {
  const blocks = state.terminal.length
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
    : `<div class="empty-state"><div class="empty-icon">${ICONS.terminal}</div><h3>尚无终端输出</h3><p>在下方直接运行命令，或在会话中使用 shell 工具（需授权）。非交互式；完整 PTY 不在 Phase-2 范围。</p></div>`;
  return `<div class="term-layout">
    <div class="panel">
      <div class="panel-head">
        <div><h2>会话终端</h2><p>工作区一次性命令 · 「直跑」不经模型 · 「送回会话」走 Agent shell</p></div>
        <span class="badge">${state.terminal.length}</span>
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

async function runTerminalCommand(command) {
  const cmd = String(command || "").trim();
  if (!cmd) {
    setStatus("请输入命令", "warn");
    return;
  }
  if (!state.workspacePath) {
    setStatus("请先打开工作区", "warn");
    return;
  }
  if (!window.hfq?.runShell) {
    setStatus("runShell 不可用", "warn");
    return;
  }
  state.terminalDraft = cmd;
  setStatus("运行中…", "live");
  try {
    const res = await window.hfq.runShell({
      workspacePath: state.workspacePath,
      command: cmd,
      timeoutMs: 60_000,
    });
    state.terminal.unshift({
      callId: `local-${Date.now()}`,
      command: cmd,
      stdout: res?.stdout || "",
      stderr: res?.stderr || "",
      code: res?.code ?? null,
      ok: Boolean(res?.ok),
      at: res?.at || new Date().toISOString(),
    });
    if (state.terminal.length > 80) state.terminal.length = 80;
    setStatus(res?.ok ? "命令完成" : "命令失败", res?.ok ? "live" : "warn");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "warn");
  }
  if (state.page === "terminal") renderPage("terminal");
}

function bindTerminalHandlers() {
  el("termCommandInput")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      const v = el("termCommandInput")?.value || "";
      void runTerminalCommand(v);
    }
  });
  el("termRunBtn")?.addEventListener("click", () => {
    const v = el("termCommandInput")?.value || "";
    void runTerminalCommand(v);
  });
  el("content")?.querySelectorAll("[data-run-shell]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const command = btn.getAttribute("data-run-shell");
      if (command) void runTerminalCommand(command);
    });
  });
  el("content")?.querySelectorAll("[data-rerun-shell]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const command = btn.getAttribute("data-rerun-shell");
      if (!command) return;
      if (!state.session?.id) {
        setStatus("请先新建会话", "warn");
        return;
      }
      if (state.busy) {
        setStatus("会话忙碌中", "warn");
        return;
      }
      renderPage("chat");
      const input = el("chatInput");
      if (input) input.value = `shell ${command}`;
      try {
        await sendChat(`shell ${command}`);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
}

function pageTasks() {
		  const children = Array.isArray(state.childSessions) ? state.childSessions : [];
		  const childBlock = children.length
		    ? `<div class="panel" style="margin-bottom:12px">
			      <div class="panel-head">
			        <div><h2>子代理</h2><p>本会话派发的子会话（explore / edit / shell）</p></div>
			        <span class="badge">${children.length}</span>
			      </div>
			      <div class="task-list">
			        ${children
			          .map((c) => {
			            const title = c.title || c.id?.slice(0, 8) || "child";
			            const st = statusLabel(c.status);
			            return `<div class="task-item">
			              <span class="badge info">子代理</span>
			              <div>
			                <div class="title">${escapeHtml(title)}</div>
			                <div class="detail mono faint">${escapeHtml(c.id || "")} · ${escapeHtml(st)}</div>
			              </div>
			              <button type="button" class="btn sm" data-open-child-session="${escapeHtml(
			                c.id || "",
			              )}">打开</button>
			            </div>`;
			          })
			          .join("")}
			      </div>
			    </div>`
		    : "";
if (!state.tasks.length && !children.length) {
			    return `<div class="panel"><div class="empty-state"><div class="empty-icon">${ICONS.tasks}</div><h3>暂无任务</h3><p>工具调用会自动记为任务；<code>/goal …</code> 长运行目标也会出现在此。子代理会出现在本页树中。运行中可用会话「停止」取消 goal。</p></div></div>`;
			  }
		  if (!state.tasks.length) {
		    return `${childBlock}<div class="panel"><div class="empty-state"><h3>暂无本会话工具任务</h3><p>子代理列表见上方。</p></div></div>`;
		  }
		  const counts = state.tasks.reduce((acc, t) => {
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
		        `<span class="badge ${cls}">${escapeHtml(label)} ${n}</span>`,
		    )
		    .join(" ");
		  const rows = state.tasks
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
			      return `<div class="task-item">
			        <span class="badge ${taskBadgeClass(t.status)}">${escapeHtml(taskStatusLabel(t.status))}</span>
			        <div>
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
	<span class="faint mono">${escapeHtml(String(t.at || "").replace("T", " ").slice(11, 19))}</span>
			        </div>
			      </div>`;
			    })
			    .join("");
			  return `${childBlock}<div class="panel">
			    <div class="panel-head">
			      <div><h2>任务</h2><p>本会话工具步骤 · 失败/取消可「重试」回会话 · 运行中可「停止」</p></div>
			      <div class="row" style="gap:6px;flex-wrap:wrap">${summary}<span class="badge">${state.tasks.length}</span></div>
			    </div>
			    <div class="task-list">${rows}</div>
			  </div>`;
			}

function bindTasksHandlers() {
  el("content")?.querySelectorAll("[data-open-child-session]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open-child-session");
      if (id) void openRecentSession(id);
    });
  });
  el("content")?.querySelectorAll("[data-retry-task]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-retry-task");
      if (!text) return;
      if (!state.session?.id) {
        setStatus("请先新建会话", "warn");
        return;
      }
      if (state.busy) {
        setStatus("会话忙碌中", "warn");
        return;
      }
      renderPage("chat");
      const input = el("chatInput");
      if (input) input.value = text;
      try {
        await sendChat(text);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
}

	function pagePermissions() {
  if (!state.policyMatrix) {
    return `<div class="panel"><div class="empty-state"><div class="empty-icon">${ICONS.permissions}</div><h3>正在加载权限矩阵…</h3><p>读取默认策略配置</p></div></div>`;
  }
  const hasSession = Boolean(state.session?.id);
  const allows = new Set(state.sessionAllows || []);
  const rows = state.policyMatrix
    .map((r) => {
      const sessionOn = allows.has(r.toolName) || r.sessionAllowed;
      const effective = sessionOn
        ? "allow"
        : r.effectiveDecision || r.decision;
      const isWildcard = String(r.toolName || "").includes("*");
	      const canToggle =
	        hasSession &&
	        !isWildcard &&
	        (r.decision === "ask" || r.decision === "deny" || sessionOn);
      let action = `<span class="faint">—</span>`;
      if (!hasSession && r.decision !== "allow") {
        action = `<span class="faint">需会话</span>`;
      } else if (canToggle) {
        action = sessionOn
          ? `<button type="button" class="btn sm" data-revoke-tool="${escapeHtml(r.toolName)}">撤销本会话</button>`
          : r.decision === "ask" || r.decision === "deny"
            ? `<button type="button" class="btn sm primary" data-grant-tool="${escapeHtml(r.toolName)}">本会话允许</button>`
            : `<span class="faint">—</span>`;
      }
      return `<tr>
        <td><code>${escapeHtml(r.toolName)}</code></td>
        <td><span class="badge ${r.risk === "high" ? "bad" : r.risk === "medium" ? "warn" : "ok"}">${escapeHtml(
          riskLabel(r.risk),
        )}</span></td>
        <td><span class="badge ${r.decision === "allow" ? "ok" : r.decision === "deny" ? "bad" : "info"}">${escapeHtml(
          decisionLabel(r.decision),
        )}</span></td>
        <td><span class="badge ${effective === "allow" ? "ok" : effective === "deny" ? "bad" : "info"}">${escapeHtml(
          decisionLabel(effective),
        )}${sessionOn ? " · 会话" : ""}</span></td>
        <td class="muted">${escapeHtml(r.note || "")}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join("");
  const allowChips = (state.sessionAllows || [])
    .map(
      (t) =>
        `<span class="badge ok">${escapeHtml(t)} <button type="button" class="linkish" data-revoke-tool="${escapeHtml(
          t,
        )}">×</button></span>`,
    )
    .join(" ");
  return `<div class="panel">
    <div class="panel-head">
      <div>
        <h2>权限策略</h2>
        <p>默认：读取允许 · 写入 / 补丁 / Shell 询问 · 危险 shell 始终询问。可在弹窗选「本会话允许」，或在此页预授权/撤销。</p>
      </div>
      <span class="badge ${hasSession ? "live" : ""}">${hasSession ? `会话 ${String(state.session.id).slice(0, 8)}` : "无活动会话"}</span>
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin:0 0 12px">
      <span class="muted">本会话已允许：</span>
      ${allowChips || `<span class="faint">无</span>`}
      <button type="button" class="btn ghost sm" id="permRefreshBtn">刷新</button>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>工具</th><th>风险</th><th>默认</th><th>当前生效</th><th>说明</th><th>会话覆盖</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

function bindPermissionsHandlers() {
  el("content")
    ?.querySelector("#permRefreshBtn")
    ?.addEventListener("click", () => {
      void refreshPolicy().then(() => {
        if (state.page === "permissions") {
          el("content").innerHTML = pageHtml("permissions");
          bindPermissionsHandlers();
        }
      });
    });
  el("content")?.querySelectorAll("[data-grant-tool]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const toolName = btn.getAttribute("data-grant-tool");
      if (!toolName || !state.session?.id) return;
      try {
        const res = await window.hfq.grantSessionAllow({
          sessionId: state.session.id,
          toolName,
        });
        state.sessionAllows = res?.sessionAllows || [];
        await refreshPolicy();
        if (state.page === "permissions") {
          el("content").innerHTML = pageHtml("permissions");
          bindPermissionsHandlers();
        }
        setStatus(`已本会话允许 ${toolName}`, "live");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
  el("content")?.querySelectorAll("[data-revoke-tool]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const toolName = btn.getAttribute("data-revoke-tool");
      if (!toolName || !state.session?.id) return;
      try {
        const res = await window.hfq.revokeSessionAllow({
          sessionId: state.session.id,
          toolName,
        });
        state.sessionAllows = res?.sessionAllows || [];
        await refreshPolicy();
        if (state.page === "permissions") {
          el("content").innerHTML = pageHtml("permissions");
          bindPermissionsHandlers();
        }
        setStatus(`已撤销 ${toolName} 会话允许`, "live");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
}

function pageMcp() {
  if (!state.mcp) {
    return `<div class="panel"><div class="empty-state"><div class="empty-icon">${ICONS.mcp}</div><h3>正在加载 MCP…</h3><p>读取服务器注册表</p></div></div>`;
  }
  const statusLabel = {
    disconnected: "未连接",
    connecting: "连接中",
    connected: "已连接",
    error: "错误",
  };
  const statusClass = {
    disconnected: "",
    connecting: "warn",
    connected: "ok",
    error: "bad",
  };
  const rows = state.mcp.servers
    .map((s) => {
      const st = statusLabel[s.status] || s.status;
      const cls = statusClass[s.status] || "";
      return `<tr>
        <td><code>${escapeHtml(s.id)}</code><div class="faint">${escapeHtml(s.name)}</div></td>
        <td>${escapeHtml(s.transport)}<div class="faint mono">${escapeHtml(
          s.transport === "http" ? s.url || "" : [s.command, ...(s.args || [])].filter(Boolean).join(" "),
        )}</div></td>
        <td><span class="badge ${cls}">${escapeHtml(st)}</span>${
          s.lastError ? `<div class="faint">${escapeHtml(s.lastError)}</div>` : ""
        }</td>
        <td>${s.toolCount ?? 0}</td>
<td class="row" style="gap:6px;flex-wrap:wrap">
	          <button type="button" class="btn sm" data-mcp-enable="${escapeHtml(s.id)}" data-enabled="${s.enabled ? "0" : "1"}">${
	            s.enabled ? "禁用" : "启用"
	          }</button>
	          ${
	            s.status === "connected"
	              ? `<button type="button" class="btn sm" data-mcp-disconnect="${escapeHtml(s.id)}">断开</button>`
	              : `<button type="button" class="btn sm primary" data-mcp-connect="${escapeHtml(s.id)}" ${
	                  s.enabled ? "" : "disabled"
	                }>连接</button>`
	          }
<button type="button" class="btn ghost sm" data-mcp-ping="${escapeHtml(s.id)}">Ping</button>
		          <button type="button" class="btn ghost sm" data-mcp-remove="${escapeHtml(s.id)}">删除</button>
		        </td>
		      </tr>`;
		    })
		    .join("");
const tools =
		    state.mcp.tools.length > 0
		      ? state.mcp.tools
		          .map((t) => {
		            const agentName = `mcp__${String(t.serverId || "").replace(/[^a-zA-Z0-9_-]/g, "_")}__${String(
		              t.name || "",
		            ).replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
		            return `<tr>
		              <td><code>${escapeHtml(t.serverId)}</code></td>
		              <td><code>${escapeHtml(t.name)}</code><div class="faint mono">${escapeHtml(agentName)}</div></td>
		              <td class="muted">${escapeHtml(t.description || "")}</td>
		            </tr>`;
		          })
		          .join("")
		      : `<tr><td colspan="3" class="muted">连接服务器后显示工具清单；stdio/HTTP 握手成功后会注入为可调用的 mcp__* 工具</td></tr>`;

		  return `
		    <div class="panel">
		      <div class="panel-head">
		        <div>
		          <h2>MCP 服务器</h2>
		          <p>stdio / HTTP 握手成功后：tools/list + tools/call 注入为 <code>mcp__server__tool</code>（默认中风险询问）。HTTP 可配置 Authorization 头。</p>
		        </div>
		        <span class="badge info">${state.mcp.servers.length}</span>
		      </div>
	      <div class="table-wrap"><table class="table"><thead><tr><th>服务器</th><th>传输</th><th>状态</th><th>工具数</th><th>操作</th></tr></thead><tbody>${
	        rows || '<tr><td colspan="5" class="muted">无服务器</td></tr>'
	      }</tbody></table></div>
	    </div>
	<div class="panel">
		      <div class="panel-head"><div><h2>添加工具服务器</h2><p>写入 %APPDATA%/HFQ-Code/config.json 的 mcpServers（重启保留；连接状态不持久化）</p></div></div>
	      <div class="grid-2">
        <label class="field"><span>ID</span><input id="mcpId" type="text" placeholder="my-server" /></label>
        <label class="field"><span>名称</span><input id="mcpName" type="text" placeholder="My MCP" /></label>
        <label class="field"><span>传输</span>
          <select id="mcpTransport"><option value="stdio">stdio</option><option value="http">http</option></select>
        </label>
        <label class="field"><span>命令 / URL</span><input id="mcpEndpoint" type="text" placeholder="npx 或 https://..." /></label>
<label class="field"><span>参数</span><input id="mcpArgs" type="text" placeholder="-y @scope/server" /><span class="hint">空格分隔，stdio 用</span></label>
	        <label class="field"><span>HTTP Authorization（可选）</span><input id="mcpAuth" type="text" placeholder="Bearer …" /><span class="hint">仅 HTTP；写入 config headers</span></label>
	        <label class="field"><span>说明</span><input id="mcpDesc" type="text" placeholder="可选" /></label>
	      </div>
	      <div class="row" style="margin-top:12px">
	        <button type="button" class="btn primary" id="mcpSaveBtn">保存服务器</button>
	        <span id="mcpStatus" class="muted"></span>
	      </div>
	    </div>
<div class="panel">
	      <div class="panel-head"><div><h2>已暴露工具</h2><p>远程名 + 会话内 agent 名（mcp__*）</p></div><span class="badge">${state.mcp.tools.length}</span></div>
	      <div class="table-wrap"><table class="table"><thead><tr><th>服务器</th><th>工具 / agent 名</th><th>描述</th></tr></thead><tbody>${tools}</tbody></table></div>
	    </div>`;
	}

function pageSkills() {
  const paths = state.appPaths || {};
  const tab = state.skillsTab === "store" ? "store" : "installed";
  const tabBar = `<div class="seg-tabs" role="tablist" style="margin-bottom:12px">
    <button type="button" class="seg-tab ${tab === "installed" ? "active" : ""}" data-skills-tab="installed">已安装</button>
    <button type="button" class="seg-tab ${tab === "store" ? "active" : ""}" data-skills-tab="store">技能商店 <span class="badge info">beta</span></button>
  </div>`;

  if (tab === "store") {
    const cat = state.skillsCatalog;
    const items = Array.isArray(cat?.items) ? cat.items : [];
    const allTags = window.HFQSkillsUI?.collectTags
      ? window.HFQSkillsUI.collectTags(items)
      : [];
    const filtered = window.HFQSkillsUI?.filterItems
      ? window.HFQSkillsUI.filterItems(items, state.skillsCatalogFilter, state.skillsCatalogTag)
      : items;
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
                  .map((t) => `<span class="badge">${escapeHtml(String(t))}</span>`)
                  .join(" ")
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
            return `<article class="skill-card">
              <div class="skill-card-head">
                <strong class="mono">${escapeHtml(it.name)}</strong>
                ${installed}
                <span class="badge">${escapeHtml(origin)}</span>
              </div>
              <p class="faint" style="margin:6px 0 8px">${escapeHtml(it.description || "")}</p>
              <div class="row" style="gap:6px;flex-wrap:wrap">${tags}</div>
              <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">
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
                    ? `<button type="button" class="btn ghost sm" data-open-skill-home="${escapeHtml(
                        it.packageUrl,
                      )}">包地址</button>`
                    : ""
                }
                <span class="faint" style="font-size:11px">${
                  it.installed
                    ? "已在本地 · 可预览 SKILL.md"
                    : it.tags?.includes?.("planned") || /planned|coming/i.test(it.description || "")
                      ? "规划中 · 可本地文件夹安装同类技能"
                      : "从本地文件夹安装 SKILL.md 包"
                }</span>
              </div>
            </article>`;
          })
          .join("")
      : `<div class="empty-state"><h3>${cat ? "无匹配技能" : "正在加载目录…"}</h3><p>可刷新远程目录，或从本地文件夹安装。</p></div>`;

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

    return `<div class="panel">
      <div class="panel-head">
        <div>
          <h2>技能 · ClawHub 商店</h2>
          <p>策展目录 + 本地安装 · 标签筛选 · SKILL.md 预览（远程 zip 安装见后续版本）</p>
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
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
        <input id="skillsCatalogFilter" class="input" style="max-width:280px" placeholder="筛选名称 / 描述…" value="${escapeHtml(
          state.skillsCatalogFilter || "",
        )}" />
        <span class="faint mono" style="font-size:11px">${escapeHtml(
          cat
            ? `source=${cat.source || "—"}${cat.remoteError ? ` · ${cat.remoteError}` : ""}`
            : "loading…",
        )}</span>
      </div>
      <div class="chip-filter-row" style="margin-bottom:12px">${tagChips}</div>
      <p class="faint" style="margin:0 0 10px">安装仅复制到用户技能目录；若已存在会询问是否覆盖。不会执行远程脚本。</p>
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
      <div class="empty-state"><div class="empty-icon">${ICONS.skills}</div><h3>暂无已安装技能</h3><p>扫描工作区、用户与内置技能目录；也可在「技能商店」安装。</p></div>
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

function auditTypeLabel(type) {
		  const map = {
		    "session.started": "会话开始",
		    "session.completed": "会话完成",
		    "session.failed": "会话失败",
		    "session.aborted": "会话停止",
		    "session.meta": "会话元数据",
		    "message.completed": "消息",
		    "tool.started": "工具开始",
		    "tool.completed": "工具完成",
		    "permission.requested": "请求授权",
		    "permission.resolved": "授权结果",
		    "diff.updated": "文件变更",
		    "terminal.output": "终端输出",
		    "task.updated": "任务更新",
		    "usage.updated": "用量",
		  };
		  return map[type] || type;
		}

		const AUDIT_FILTERS = [
		  { id: "all", label: "全部" },
		  { id: "tools", label: "工具" },
		  { id: "permissions", label: "授权" },
		  { id: "changes", label: "变更" },
		  { id: "terminal", label: "终端" },
		  { id: "session", label: "会话" },
		  { id: "messages", label: "消息" },
		];

		/**
		 * @param {string} type
		 * @param {string} filter
		 */
		function auditEventMatchesFilter(type, filter) {
		  if (!filter || filter === "all") return true;
		  const t = String(type || "");
		  if (filter === "tools") return t.startsWith("tool.");
		  if (filter === "permissions") return t.startsWith("permission.");
		  if (filter === "changes") return t === "diff.updated";
		  if (filter === "terminal") return t === "terminal.output";
		  if (filter === "session") {
		    return (
		      t.startsWith("session.") || t === "usage.updated" || t === "task.updated"
		    );
		  }
		  if (filter === "messages") return t.startsWith("message.");
		  return true;
		}

		/**
		 * @param {any} e
		 */
		function auditEventSummary(e) {
		  if (!e) return "";
		  if (e.type === "message.completed") {
		    return `${e.role}: ${String(e.text || "").slice(0, 90)}`;
		  }
		  if (e.type === "tool.started") return `${e.name} · 开始`;
		  if (e.type === "tool.completed") return `${e.name} · ${e.ok ? "成功" : "失败"}`;
		  if (e.type === "permission.requested") {
		    return `${e.toolName || ""} · ${e.summary || ""}`.trim();
		  }
		  if (e.type === "permission.resolved") return e.decision;
		  if (e.type === "diff.updated") return `${e.kind || "change"} ${e.path || ""}`;
		  if (e.type === "terminal.output") return e.command;
		  if (e.type === "task.updated") return `${e.title} · ${e.status}`;
		  if (e.type === "session.aborted") return e.reason || "user_stop";
		  if (e.type === "session.meta") return e.title || e.model || "";
		  if (e.type === "usage.updated") {
		    return `in ${e.inputTokens || 0} / out ${e.outputTokens || 0}`;
		  }
		  return e.error || e.path || e.decision || e.title || "";
		}

		function getFilteredAuditEvents() {
		  const filter = state.auditFilter || "all";
		  return (state.audit || []).filter((e) => auditEventMatchesFilter(e?.type, filter));
		}

		function pageAudit() {
		  const filter = state.auditFilter || "all";
		  const filtered = getFilteredAuditEvents();
		  const counts = state.audit.reduce((acc, e) => {
		    const key = e.type || "unknown";
		    acc[key] = (acc[key] || 0) + 1;
		    return acc;
		  }, /** @type {Record<string, number>} */ ({}));

		  const filterCount = (id) => {
		    if (id === "all") return state.audit.length;
		    return state.audit.filter((e) => auditEventMatchesFilter(e?.type, id)).length;
		  };

		  const chips = AUDIT_FILTERS.map((f) => {
		    const n = filterCount(f.id);
		    const active = filter === f.id ? "info" : n ? "" : "";
		    const pressed = filter === f.id ? "true" : "false";
		    return `<button type="button" class="badge audit-filter ${active}" data-audit-filter="${escapeHtml(
		      f.id,
		    )}" aria-pressed="${pressed}">${escapeHtml(f.label)} ${n}</button>`;
		  }).join(" ");

		  const rows = filtered
		    .slice(0, 120)
		    .map((e) => {
		      const summary = auditEventSummary(e);
		      return `<tr>
		        <td class="mono faint">${escapeHtml(String(e.at || "").replace("T", " ").slice(0, 19))}</td>
		        <td><code title="${escapeHtml(e.type)}">${escapeHtml(auditTypeLabel(e.type))}</code></td>
		        <td>${escapeHtml(String(summary || ""))}</td>
		      </tr>`;
		    })
		    .join("");

		  const toolN = counts["tool.completed"] || 0;
		  const permN = (counts["permission.requested"] || 0) + (counts["permission.resolved"] || 0);
		  const diffN = counts["diff.updated"] || 0;

		  return `<div class="panel">
		    <div class="panel-head">
		      <div>
		        <h2>审计</h2>
		        <p>会话事件时间线（内存环形缓冲 + JSONL 落盘；恢复会话会回填）</p>
		      </div>
		      <div class="row" style="gap:6px;flex-wrap:wrap">
		        <span class="badge">${filtered.length}${filter === "all" ? "" : ` / ${state.audit.length}`}</span>
		        <button type="button" class="btn ghost sm" id="auditCopyBtn" ${
		          filtered.length ? "" : "disabled"
		        }>复制 JSON</button>
		        <button type="button" class="btn ghost sm" id="auditExportBtn" ${
		          filtered.length ? "" : "disabled"
		        }>导出 JSONL</button>
		        <button type="button" class="btn ghost sm" id="auditClearBtn" ${
		          state.audit.length ? "" : "disabled"
		        }>清空视图</button>
		      </div>
		    </div>
		    <div class="row audit-filters" style="gap:6px;flex-wrap:wrap;margin:0 0 12px">${chips}</div>
		    <div class="grid-3" style="margin-bottom:12px">
		      <div class="metric">
		        <div class="metric-label">工具完成</div>
		        <div class="metric-value">${toolN}</div>
		        <div class="metric-meta">含成功与失败</div>
		      </div>
		      <div class="metric">
		        <div class="metric-label">授权事件</div>
		        <div class="metric-value">${permN}</div>
		        <div class="metric-meta">请求 + 决议</div>
		      </div>
		      <div class="metric">
		        <div class="metric-label">文件变更</div>
		        <div class="metric-value">${diffN}</div>
		        <div class="metric-meta">diff.updated</div>
		      </div>
		    </div>
		    <div class="table-wrap"><table class="table"><thead><tr><th>时间</th><th>事件</th><th>详情</th></tr></thead><tbody>${
		      rows ||
		      `<tr><td colspan="3" class="muted">${
		        state.audit.length ? "当前筛选无匹配事件" : "暂无事件 · 运行会话后出现"
		      }</td></tr>`
		    }</tbody></table></div>
		  </div>`;
		}

		function bindAuditHandlers() {
		  document.querySelectorAll("[data-audit-filter]").forEach((btn) => {
		    btn.addEventListener("click", () => {
		      const id = btn.getAttribute("data-audit-filter") || "all";
		      state.auditFilter = id;
		      if (state.page === "audit") renderPage("audit");
		    });
		  });
		  el("auditClearBtn")?.addEventListener("click", () => {
		    if (!state.audit.length) return;
		    if (!window.confirm("清空当前审计视图？（不影响磁盘 JSONL）")) return;
		    state.audit = [];
		    state.auditFilter = "all";
		    setStatus("审计视图已清空", "live");
		    if (state.page === "audit") renderPage("audit");
		  });
		  el("auditCopyBtn")?.addEventListener("click", async () => {
		    const events = getFilteredAuditEvents();
		    if (!events.length) return;
		    const text = JSON.stringify(events, null, 2);
		    try {
		      await navigator.clipboard.writeText(text);
		      setStatus(`已复制 ${events.length} 条审计事件`, "live");
		    } catch (err) {
		      setStatus(err instanceof Error ? err.message : String(err), "warn");
		    }
		  });
		  el("auditExportBtn")?.addEventListener("click", () => {
		    const events = getFilteredAuditEvents();
		    if (!events.length) return;
		    const body = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
		    const blob = new Blob([body], { type: "application/x-ndjson;charset=utf-8" });
		    const url = URL.createObjectURL(blob);
		    const a = document.createElement("a");
		    const sid = state.session?.id ? state.session.id.slice(0, 8) : "session";
		    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		    a.href = url;
		    a.download = `hfq-audit-${sid}-${stamp}.jsonl`;
		    a.click();
		    setTimeout(() => URL.revokeObjectURL(url), 2000);
		    setStatus(`已导出 ${events.length} 条（JSONL）`, "live");
		  });
		}

function pageStub(title, body) {
  return `<div class="panel"><div class="empty-state"><div class="empty-icon">${ICONS[state.page] || ICONS.settings}</div><h3>${title}</h3><p>${body}</p></div></div>`;
}

function pageModels() {
  const cfg = state.config;
  if (!cfg) {
    return `<div class="panel"><div class="empty-state"><div class="empty-icon">${ICONS.models}</div><h3>正在加载模型配置…</h3><p>读取 %APPDATA%/HFQ-Code/config.json</p></div></div>`;
  }

  const active = cfg.providers.find((p) => p.id === cfg.activeProviderId) || cfg.providers[0];
  const modelOptions = (active?.models || [])
    .map(
      (m) =>
        `<option value="${escapeHtml(m)}" ${m === cfg.activeModel ? "selected" : ""}>${escapeHtml(m)}</option>`,
    )
    .join("");

  const rows = cfg.providers
    .map((p) => {
      const activeBadge =
        p.id === cfg.activeProviderId ? '<span class="badge ok">当前</span>' : "";
      return `<tr>
        <td><code>${escapeHtml(p.id)}</code> ${activeBadge}</td>
        <td>${escapeHtml(p.name)}<div class="faint">${escapeHtml(p.kind)}</div></td>
        <td class="mono">${escapeHtml(p.baseURL || "—")}</td>
        <td class="mono">${escapeHtml(p.apiKey || "—")}</td>
        <td><button type="button" class="btn sm" data-activate="${escapeHtml(p.id)}">启用</button></td>
      </tr>`;
    })
    .join("");

  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>当前模型</h2>
          <p>新建会话会使用当前提供方与模型。密钥保存在本机，界面中已脱敏。</p>
        </div>
      </div>
      <div class="grid-2">
        <label class="field"><span>提供方</span>
          <select id="activeProviderSelect">
            ${cfg.providers
              .map(
                (p) =>
                  `<option value="${escapeHtml(p.id)}" ${
                    p.id === cfg.activeProviderId ? "selected" : ""
                  }>${escapeHtml(p.name)}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label class="field"><span>模型</span>
          <select id="activeModelSelect">
            ${modelOptions || '<option value="mock-hfq">mock-hfq</option>'}
          </select>
        </label>
      </div>
<div class="row" style="margin-top:12px">
	        <button type="button" class="btn primary" id="saveActiveBtn">保存当前配置</button>
	        <button type="button" class="btn" id="testModelBtn">测试连通</button>
	        <span id="modelsStatus" class="muted"></span>
	      </div>
	      <p class="hint" style="margin-top:10px">切换提供方后请<strong>新建会话</strong>再发消息；旧会话仍绑定创建时的 provider。</p>
	    </div>

    <div class="panel">
      <div class="panel-head"><div><h2>提供方列表</h2><p>mock · OpenAI 兼容 · Anthropic Messages</p></div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>名称</th><th>Base URL</th><th>API Key</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>

    <div class="panel">
      <div class="panel-head"><div><h2>编辑提供方</h2><p>OpenAI 兼容网关或 Anthropic 官方 / 代理</p></div></div>
      <div class="grid-2">
        <label class="field"><span>提供方 ID</span><input id="provId" type="text" value="openai-compatible" /></label>
        <label class="field"><span>显示名称</span><input id="provName" type="text" value="OpenAI Compatible" /></label>
        <label class="field"><span>类型</span>
          <select id="provKind">
            <option value="openai_compatible">openai_compatible</option>
            <option value="anthropic">anthropic</option>
            <option value="mock">mock</option>
          </select>
        </label>
        <label class="field"><span>Base URL</span><input id="provBase" type="text" placeholder="https://api.openai.com/v1 或 https://api.anthropic.com" /></label>
        <label class="field"><span>API Key</span><input id="provKey" type="password" placeholder="sk-… / sk-ant-… 留空则保留原值" /></label>
        <label class="field"><span>模型列表</span><input id="provModels" type="text" placeholder="gpt-4.1 或 claude-sonnet-4-20250514" /><span class="hint">逗号分隔</span></label>
        <label class="field"><span>默认模型</span><input id="provDefault" type="text" placeholder="默认模型 ID" /></label>
      </div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="btn primary" id="saveProviderBtn">保存提供方</button>
        <button type="button" class="btn" id="fillFromActiveBtn">填入已保存配置</button>
        <button type="button" class="btn ghost" id="fillAnthropicBtn">填入 Anthropic 模板</button>
      </div>
    </div>`;
}

function pageMemory() {
	  const docs = state.memoryDocs || [];
	  const hits = state.memoryHits || [];
	  const docHtml = docs.length
	    ? docs
	        .map(
	          (d) => `<div class="session-item">
	        <div class="session-item-main" style="cursor:default">
	          <div>
	            <div class="title">${escapeHtml((d.text || "").slice(0, 120))}</div>
	            <div class="meta">${escapeHtml(d.scope || "user")} · ${escapeHtml(
	              d.source || "",
	            )} · ${escapeHtml(formatSessionTime(d.updatedAt))}${
	              d.pinned ? " · 置顶" : ""
	            }</div>
	          </div>
	        </div>
	        <div class="session-actions">
	          <button type="button" class="btn ghost sm" data-del-mem="${escapeHtml(
	            d.id,
	          )}" data-mem-scope="${escapeHtml(d.scope || "")}">删除</button>
	        </div>
	      </div>`,
	        )
	        .join("")
	    : `<div class="empty-state"><p>暂无笔记。可在下方保存，或让助手使用 memory_save。</p></div>`;
	  const hitHtml = hits.length
	    ? hits
	        .map(
	          (h) => `<div class="metric" style="margin-bottom:8px">
	        <div class="metric-label">score ${Number(h.score || 0).toFixed(2)} · ${escapeHtml(
	          h.scope || "",
	        )}</div>
	        <div class="metric-meta">${escapeHtml((h.text || "").slice(0, 240))}</div>
	      </div>`,
	        )
	        .join("")
	    : `<p class="faint">输入查询后点「检索测试」</p>`;
	  return `
	    <div class="panel">
	      <div class="panel-head">
	        <div>
	          <h2>记忆</h2>
	          <p>用户级 + 项目级笔记；BM25 检索。路径：%APPDATA%/HFQ-Code/memory/</p>
	        </div>
	        <button type="button" class="btn ghost sm" id="memoryRefreshBtn">刷新</button>
	      </div>
	      <div class="grid-2">
	        <label class="field"><span>范围</span>
	          <select id="memScope">
	            <option value="all" ${state.memoryScope === "all" ? "selected" : ""}>全部</option>
	            <option value="user" ${state.memoryScope === "user" ? "selected" : ""}>用户</option>
	            <option value="project" ${state.memoryScope === "project" ? "selected" : ""}>项目</option>
	          </select>
	        </label>
	        <label class="field"><span>检索测试</span>
	          <div class="row" style="gap:8px">
	            <input id="memQuery" type="text" value="${escapeHtml(
	              state.memoryQuery || "",
	            )}" placeholder="关键词…" style="flex:1" />
	            <button type="button" class="btn sm" id="memSearchBtn">检索</button>
	          </div>
	        </label>
	      </div>
	      <div style="margin-top:12px">${hitHtml}</div>
	    </div>
	    <div class="panel" style="margin-top:14px">
	      <div class="panel-head"><div><h2>新建笔记</h2></div>
	        <button type="button" class="btn primary sm" id="memSaveBtn">保存</button>
	      </div>
	      <textarea id="memText" rows="3" placeholder="要长期记住的事实…"></textarea>
	      <div class="row" style="margin-top:8px;gap:12px;align-items:center">
	        <label class="field row" style="align-items:center;gap:8px;margin:0">
	          <input id="memPinned" type="checkbox" /> <span>置顶</span>
	        </label>
	        <label class="field row" style="align-items:center;gap:8px;margin:0">
	          <span>写入范围</span>
	          <select id="memWriteScope">
	            <option value="project">项目</option>
	            <option value="user">用户</option>
	          </select>
	        </label>
	      </div>
	      <p class="form-status" id="memStatus"></p>
	    </div>
	    <div class="panel" style="margin-top:14px">
	      <div class="panel-head"><div><h2>笔记列表</h2><p>${docs.length} 条</p></div></div>
	      <div class="session-list">${docHtml}</div>
	    </div>`;
	}

	function pageUsage() {
	  const s = state.usageSummary;
	  if (!s) {
	    return `<div class="panel"><div class="panel-head"><div><h2>用量</h2><p>从会话 JSONL 聚合 tokens</p></div>
	      <button type="button" class="btn sm" id="usageRefreshBtn">加载</button></div>
	      <div class="empty-state"><p>点击加载汇总</p></div></div>`;
	  }
	  const t = s.totals || {};
	  const daily = (s.daily || [])
	    .slice(0, 14)
	    .map(
	      (d) => `<tr>
	      <td>${escapeHtml(d.day)}</td>
	      <td>${d.sessions}</td>
	      <td>${d.inputTokens}</td>
	      <td>${d.outputTokens}</td>
	      <td>${d.totalTokens}</td>
	      <td>${d.estimatedCostUsd != null ? `$${Number(d.estimatedCostUsd).toFixed(4)}` : "—"}</td>
	    </tr>`,
	    )
	    .join("");
	  const sess = (s.sessions || [])
	    .slice(0, 20)
	    .map(
	      (r) => `<tr>
	      <td>${escapeHtml(r.title || r.sessionId.slice(0, 8))}</td>
	      <td>${escapeHtml(r.model || "")}</td>
	      <td>${r.inputTokens}</td>
	      <td>${r.outputTokens}</td>
	      <td>${r.totalTokens}</td>
	    </tr>`,
	    )
	    .join("");
	  return `
	    <div class="panel">
	      <div class="panel-head">
	        <div><h2>用量</h2><p>会话 / 日聚合 · 单价可在设置中配置</p></div>
	        <button type="button" class="btn ghost sm" id="usageRefreshBtn">刷新</button>
	      </div>
	      <div class="grid-3">
	        <div class="metric"><div class="metric-label">Input tokens</div><div class="metric-value">${
	          t.inputTokens || 0
	        }</div></div>
	        <div class="metric"><div class="metric-label">Output tokens</div><div class="metric-value">${
	          t.outputTokens || 0
	        }</div></div>
	        <div class="metric"><div class="metric-label">估算费用</div><div class="metric-value">${
	          t.estimatedCostUsd != null ? `$${Number(t.estimatedCostUsd).toFixed(4)}` : "—"
	        }</div>
	        <div class="metric-meta">${t.sessions || 0} 个会话</div></div>
	      </div>
	    </div>
	    <div class="panel" style="margin-top:14px">
	      <h3 style="margin:0 0 10px">按日</h3>
	      <div class="table-wrap"><table class="data-table">
	        <thead><tr><th>日期</th><th>会话</th><th>In</th><th>Out</th><th>Total</th><th>费用</th></tr></thead>
	        <tbody>${daily || `<tr><td colspan="6">无数据</td></tr>`}</tbody>
	      </table></div>
	    </div>
	    <div class="panel" style="margin-top:14px">
	      <h3 style="margin:0 0 10px">最近会话</h3>
	      <div class="table-wrap"><table class="data-table">
	        <thead><tr><th>标题</th><th>模型</th><th>In</th><th>Out</th><th>Total</th></tr></thead>
	        <tbody>${sess || `<tr><td colspan="5">无数据</td></tr>`}</tbody>
	      </table></div>
	    </div>`;
	}

	function pageImport() {
	  const scan = state.importScan;
	  const roots = (scan?.roots || [])
	    .map(
	      (r) =>
	        `<div class="path-row"><div class="label">${escapeHtml(r.label)}</div>
	        <div class="value">${escapeHtml(r.path)} ${r.exists ? "✓" : "—"}</div></div>`,
	    )
	    .join("");
	  const cands = (scan?.candidates || [])
	    .map((c) => {
	      const checked = state.importSelected[c.id] ? "checked" : "";
	      return `<label class="session-item" style="display:flex;gap:10px;align-items:flex-start;padding:10px">
	        <input type="checkbox" data-import-id="${escapeHtml(c.id)}" ${checked} />
	        <div>
	          <div class="title">${escapeHtml(c.name)} <span class="badge info">${escapeHtml(
	            c.kind,
	          )}</span></div>
	          <div class="meta">${escapeHtml(c.sourceLabel)} · ${escapeHtml(c.sourcePath)}</div>
	        </div>
	      </label>`;
	    })
	    .join("");
	  return `
	    <div class="panel">
	      <div class="panel-head">
	        <div>
	          <h2>导入向导</h2>
	          <p>只读扫描 OpenClaw / AgentSkills / Cursor 规则 → 复制到 HFQ 目录。默认不导入 API Key。</p>
	        </div>
	        <div class="row" style="gap:8px">
	          <button type="button" class="btn sm" id="importScanBtn">扫描</button>
	          <button type="button" class="btn primary sm" id="importApplyBtn">导入勾选项</button>
	        </div>
	      </div>
	      ${state.importNote ? `<p class="form-status">${escapeHtml(state.importNote)}</p>` : ""}
	      <div class="path-grid">${roots || "<p class='faint'>尚未扫描</p>"}</div>
	    </div>
	    <div class="panel" style="margin-top:14px">
	      <div class="panel-head"><div><h2>候选</h2><p>${
	        scan?.candidates?.length || 0
	      } 项</p></div></div>
	      <div class="session-list">${cands || `<div class="empty-state"><p>无候选，先扫描</p></div>`}</div>
	    </div>`;
	}

	function pageHtml(id) {
	  switch (id) {
	    case "home":
	      return pageHome();
	    case "chat":
	      return pageChat();
	    case "changes":
	      return pageChanges();
	    case "terminal":
	      return pageTerminal();
	    case "tasks":
	      return pageTasks();
	    case "skills":
	      return pageSkills();
	    case "mcp":
	      return pageMcp();
	    case "memory":
	      return pageMemory();
	    case "usage":
	      return pageUsage();
	    case "import":
	      return pageImport();
	    case "audit":
	      return pageAudit();
	    case "models":
	      return pageModels();
	    case "permissions":
	      return pagePermissions();
	    case "settings":
	      return pageSettings();
	    default:
	      return pageHome();
	  }
	}

function bindDropdownMenu(btn, panel, { requireSession = false } = {}) {
  if (!btn || !panel) {
    return { close: () => {}, open: () => {}, isOpen: () => false };
  }
  const close = () => {
    panel.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    panel.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
  };
  const isOpen = () => !panel.classList.contains("hidden");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (requireSession && !state.session?.id) {
      setStatus("请先创建会话", "warn");
      return;
    }
    if (isOpen()) close();
    else {
      // close sibling menus in composer
      document.querySelectorAll(".mode-menu-panel:not(.hidden)").forEach((p) => {
        if (p !== panel) p.classList.add("hidden");
      });
      document
        .querySelectorAll(".mode-menu [aria-expanded='true']")
        .forEach((b) => b.setAttribute("aria-expanded", "false"));
      open();
      const onDoc = (ev) => {
        if (panel.contains(ev.target) || btn.contains(ev.target)) return;
        close();
        document.removeEventListener("click", onDoc);
      };
      setTimeout(() => document.addEventListener("click", onDoc), 0);
    }
  });
  panel.addEventListener("click", (e) => e.stopPropagation());
  return { close, open, isOpen };
}

function filterPaletteItems(query) {
  const q = String(query || "").trim().toLowerCase();
  const all = paletteItems();
  if (!q || q === "/" || q === "$") return all;
  const needle = q.replace(/^[/$\s]+/, "");
  if (!needle) return all;
  return all.filter((item) => {
    const hay = `${item.label} ${item.hint} ${item.trigger}`.toLowerCase();
    return hay.includes(needle) || item.trigger.toLowerCase().startsWith(q);
  });
}

function setSlashPaletteVisible(show) {
  const panel = el("slashPalette");
  if (!panel) return;
  panel.classList.toggle("hidden", !show);
}

function renderSlashPaletteList(items, activeIdx = 0) {
  const list = el("slashPaletteList");
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div class="mode-menu-empty">无匹配命令 / 技能</div>`;
    return;
  }
  const safeIdx = Math.max(0, Math.min(activeIdx, items.length - 1));
  list.innerHTML = items
    .map(
      (item, idx) => `<button type="button" class="slash-item${idx === safeIdx ? " active" : ""}" data-palette-id="${escapeHtml(
        item.id,
      )}" data-palette-insert="${escapeHtml(item.insert)}" data-palette-kind="${escapeHtml(
        item.kind,
      )}" role="option">
        <span class="slash-item-main">
          <span class="slash-item-label">${escapeHtml(item.label)}</span>
          <span class="slash-item-hint">${escapeHtml(item.hint)}</span>
        </span>
        <span class="slash-item-kind">${item.kind === "skill" ? "技能" : "命令"}</span>
      </button>`,
    )
    .join("");
  list.querySelectorAll("[data-palette-insert]").forEach((btn) => {
    btn.addEventListener("click", () => applyPaletteInsert(btn.getAttribute("data-palette-insert") || ""));
  });
  const active = list.querySelector(".slash-item.active");
  active?.scrollIntoView({ block: "nearest" });
}

function applyPaletteInsert(text) {
  const input = el("chatInput");
  if (!input) return;
  input.value = text;
  setSlashPaletteVisible(false);
  input.focus();
  try {
    const len = input.value.length;
    input.setSelectionRange(len, len);
  } catch {
    /* ignore */
  }
  // Keep palette closed for slash prefixes that expect the user to type args.
  if (/^\/(goal|compact)\s*$/i.test(String(text || "").trim() + " ") || /^\/(goal|compact)\s$/i.test(text)) {
    setSlashPaletteVisible(false);
  }
}

function updateSlashPaletteFromInput() {
  const input = el("chatInput");
  if (!input) return;
  const value = input.value;
  const caret = typeof input.selectionStart === "number" ? input.selectionStart : value.length;
  const before = value.slice(0, caret);
  // open when current line starts with / or $ (ZCode-style)
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);
  if (line.startsWith("/") || line.startsWith("$")) {
    // stop filtering after first whitespace (command chosen, args follow)
    const token = line.split(/\s/, 1)[0];
    if (token !== line && line.includes(" ")) {
      setSlashPaletteVisible(false);
      return;
    }
    const items = filterPaletteItems(token);
    setSlashPaletteVisible(true);
    renderSlashPaletteList(items, 0);
    return;
  }
  // Keep palette if opened via button with empty input; otherwise close for normal text.
  if (value.trim() === "") return;
  setSlashPaletteVisible(false);
}

function bindChatHandlers() {
  el("goalBannerStopBtn")?.addEventListener("click", () => {
    void stopSession();
  });
  el("goalBannerTasksBtn")?.addEventListener("click", () => {
    renderPage("tasks");
  });
  el("startSessionBtn")?.addEventListener("click", async () => {
    try {
      state.session = null;
      await createFreshSession();
      renderPage("chat");
    } catch (err) {
      pushMessage({ role: "error", text: err instanceof Error ? err.message : String(err) });
    }
  });
  el("clearChatBtn")?.addEventListener("click", () => {
    state.messages = [];
    updateChatLogIfPresent();
  });
  el("stopSessionBtn")?.addEventListener("click", () => {
    void stopSession();
  });
  el("renameSessionBtn")?.addEventListener("click", () => {
    if (!state.session?.id) return;
    void renameRecentSession(state.session.id, state.session.title || "");
  });

  const modeBtn = el("accessModeBtn");
  const modePanel = el("accessModePanel");
  const modeMenuApi = bindDropdownMenu(modeBtn, modePanel, { requireSession: true });

  el("content")?.querySelectorAll("[data-set-mode]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.session?.id) return;
      const mode = btn.getAttribute("data-set-mode");
      if (!mode) return;
      if (
        mode === "full_access" &&
        !window.confirm(
          "开启「完全访问」？\n\n将自动允许全部工具，包括危险 Shell（如 rm / del）。仅在你完全信任当前工作区时继续。",
        )
      ) {
        modeMenuApi.close();
        return;
      }
      try {
        const res = await window.hfq.setPermissionMode({
          sessionId: state.session.id,
          mode,
        });
        applyPermissionModeState(res?.permissionMode || mode, res?.planMode);
        const meta = permissionModeMeta(state.permissionMode);
        setStatus(`访问模式 · ${meta.label}`, meta.warn ? "warn" : "live");
        modeMenuApi.close();
        renderPage("chat");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
  el("accessModeSetDefault")?.addEventListener("click", async () => {
    try {
      if (!window.hfq?.setPrefs) throw new Error("setPrefs unavailable");
      const next = await window.hfq.setPrefs({
        permissionMode: state.permissionMode,
      });
      state.config = next;
      const meta = permissionModeMeta(state.permissionMode);
      setStatus(`已设为默认 · ${meta.label}`, "live");
      modeMenuApi.close();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "warn");
    }
  });

  const modelBtn = el("modelMenuBtn");
  const modelPanel = el("modelMenuPanel");
  const modelMenuApi = bindDropdownMenu(modelBtn, modelPanel, { requireSession: false });

  el("content")?.querySelectorAll("[data-set-provider]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const providerId = btn.getAttribute("data-set-provider");
      if (!providerId || !window.hfq?.setActiveModel) return;
      try {
        const p = (state.config?.providers || []).find((x) => x.id === providerId);
        const model = p?.defaultModel || p?.models?.[0] || state.config?.activeModel;
        state.config = await window.hfq.setActiveModel({ providerId, model });
        updateModelProviderBadge();
        setStatus(`提供方 · ${providerId}`, "live");
        modelMenuApi.close();
        renderPage("chat");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
  el("content")?.querySelectorAll("[data-set-model]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const model = btn.getAttribute("data-set-model");
      const providerId =
        btn.getAttribute("data-provider-id") || state.config?.activeProviderId;
      if (!model || !providerId || !window.hfq?.setActiveModel) return;
      try {
        state.config = await window.hfq.setActiveModel({ providerId, model });
        updateModelProviderBadge();
        setStatus(`模型 · ${model}（新会话生效）`, "live");
        modelMenuApi.close();
        renderPage("chat");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
  el("openModelsPageBtn")?.addEventListener("click", () => {
    modelMenuApi.close();
    renderPage("models");
  });

  el("spawnExploreBtn")?.addEventListener("click", async () => {
    if (!state.session?.id) return;
    const goal = window.prompt("子代理调研目标", "梳理本仓库 packages 结构并摘要") || "";
    if (!goal.trim()) return;
    try {
      setStatus("子代理运行中…", "live");
      const res = await window.hfq.spawnSubagent({
        sessionId: state.session.id,
        goal: goal.trim(),
        profile: "explore",
      });
      pushMessage({
        role: "system",
        text: res?.summary || JSON.stringify(res),
      });
      setStatus(res?.ok ? "子代理完成" : "子代理失败", res?.ok ? "live" : "warn");
      updateChatLogIfPresent();
    } catch (err) {
      pushMessage({
        role: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    }
  });

  el("sendBtn")?.addEventListener("click", () => {
    const input = el("chatInput");
    if (!input) return;
    const text = input.value;
    input.value = "";
    setSlashPaletteVisible(false);
    void sendChat(text);
  });

  const input = el("chatInput");
  input?.addEventListener("input", () => {
    updateSlashPaletteFromInput();
  });
  input?.addEventListener("keydown", (e) => {
    const panel = el("slashPalette");
    const open = panel && !panel.classList.contains("hidden");
    if (open) {
      const items = [...(el("slashPaletteList")?.querySelectorAll(".slash-item") || [])];
      const activeIdx = items.findIndex((n) => n.classList.contains("active"));
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashPaletteVisible(false);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        const next =
          e.key === "ArrowDown"
            ? (activeIdx + 1) % items.length
            : (activeIdx - 1 + items.length) % items.length;
        items.forEach((n, i) => n.classList.toggle("active", i === next));
        items[next]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && activeIdx >= 0)) {
        const active = items[activeIdx] || items[0];
        if (active) {
          e.preventDefault();
          applyPaletteInsert(active.getAttribute("data-palette-insert") || "");
          return;
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      el("sendBtn")?.click();
    }
  });

  el("slashToggleBtn")?.addEventListener("click", () => {
    const panel = el("slashPalette");
    if (!panel) return;
    const willOpen = panel.classList.contains("hidden");
    if (willOpen) {
      renderSlashPaletteList(paletteItems(), 0);
      setSlashPaletteVisible(true);
      el("chatInput")?.focus();
    } else {
      setSlashPaletteVisible(false);
    }
  });

  el("slashPaletteList")?.querySelectorAll("[data-palette-insert]").forEach((btn) => {
    btn.addEventListener("click", () => applyPaletteInsert(btn.getAttribute("data-palette-insert") || ""));
  });

  // keep empty-state demo chips working
  document.querySelectorAll("[data-fill]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const node = el("chatInput");
      if (!node) return;
      node.value = chip.getAttribute("data-fill") || "";
      node.focus();
      setSlashPaletteVisible(false);
    });
  });
}

function bindHomeHandlers() {
			  el("homeOpenWs")?.addEventListener("click", () => el("openWs")?.click());
			  el("homeGoSession")?.addEventListener("click", () => renderPage("chat"));
			  el("homeRefreshSessions")?.addEventListener("click", async () => {
			    await Promise.all([refreshSessions(), refreshConfig()]);
			    if (state.page === "home") renderPage("home");
			  });
			  document.querySelectorAll("[data-open-session]").forEach((btn) => {
			    btn.addEventListener("click", () => {
			      const id = btn.getAttribute("data-open-session");
			      if (id) void openRecentSession(id);
			    });
			  });
document.querySelectorAll("[data-delete-session]").forEach((btn) => {
				    btn.addEventListener("click", (ev) => {
				      ev.preventDefault();
				      ev.stopPropagation();
				      const id = btn.getAttribute("data-delete-session");
				      if (id) void deleteRecentSession(id);
				    });
				  });
				  document.querySelectorAll("[data-rename-session]").forEach((btn) => {
				    btn.addEventListener("click", (ev) => {
				      ev.preventDefault();
				      ev.stopPropagation();
				      const id = btn.getAttribute("data-rename-session");
				      const title = btn.getAttribute("data-session-title") || "";
				      if (id) void renameRecentSession(id, title);
				    });
				  });
				  document.querySelectorAll("[data-open-workspace]").forEach((btn) => {
				    btn.addEventListener("click", async () => {
				      const p = btn.getAttribute("data-open-workspace");
				      if (!p) return;
				      try {
				        const res = await window.hfq.setWorkspace({ workspacePath: p });
				        if (res?.workspacePath) {
				          state.workspacePath = res.workspacePath;
				          state.session = null;
				          resetLiveSurfaces();
				          el("wsPath").textContent = res.workspacePath;
				          setStatus("工作区已打开", "live");
				          setSessionBadge();
				          setCrumb();
				          await Promise.all([refreshSessions(), refreshConfig()]);
				          renderPage("home");
				        }
				      } catch (err) {
				        setStatus(err instanceof Error ? err.message : String(err), "warn");
				      }
				    });
				  });
				}

async function refreshSkillsCatalog(opts = {}) {
  try {
    if (!window.hfq?.skillsCatalog) {
      state.skillsCatalog = {
        items: [],
        source: "curated",
        remoteError: "skillsCatalog IPC unavailable",
        fetchedAt: new Date().toISOString(),
      };
      return state.skillsCatalog;
    }
    const res = await window.hfq.skillsCatalog({
      workspacePath: state.workspacePath,
      remote: opts.remote !== false,
    });
    state.skillsCatalog = res;
    return res;
  } catch (err) {
    state.skillsCatalog = {
      items: [],
      source: "curated",
      remoteError: err instanceof Error ? err.message : String(err),
      fetchedAt: new Date().toISOString(),
    };
    return state.skillsCatalog;
  }
}

function bindSkillsHandlers() {
  el("skillsRefreshBtn")?.addEventListener("click", async () => {
    await refreshSkills();
    if (state.page === "skills") {
      el("content").innerHTML = pageHtml("skills");
      bindSkillsHandlers();
    }
  });
  el("skillsCatalogRefreshBtn")?.addEventListener("click", async () => {
    const status = el("skillsStoreStatus");
    if (status) status.textContent = "正在刷新目录…";
    await refreshSkillsCatalog({ remote: true });
    if (state.page === "skills") {
      el("content").innerHTML = pageHtml("skills");
      bindSkillsHandlers();
    }
    setStatus("技能目录已刷新", "live");
  });
  /**
   * @param {{ overwrite?: boolean, sourceDir?: string }} opts
   */
  async function runSkillInstall(opts = {}) {
    const status = el("skillsStoreStatus");
    if (!window.hfq?.installSkillFromDir) throw new Error("installSkillFromDir unavailable");
    const payload = {
      overwrite: Boolean(opts.overwrite),
    };
    if (opts.sourceDir) payload.sourceDir = opts.sourceDir;
    const res = await window.hfq.installSkillFromDir(payload);
    if (res?.cancelled || res?.code === "cancelled") {
      if (status) status.textContent = "已取消";
      return;
    }
    if (!res?.ok && res?.code === "already_exists") {
      const name = res.name || "该技能";
      const ok = window.confirm(
        `技能「${name}」已安装在用户目录。\n\n是否覆盖安装？\n${res.destDir || ""}`,
      );
      if (!ok) {
        if (status) status.textContent = "已取消覆盖";
        return;
      }
      return runSkillInstall({
        overwrite: true,
        sourceDir: res.sourceDir || opts.sourceDir,
      });
    }
    if (!res?.ok) {
      const msg = res?.error || "安装失败";
      if (status) status.textContent = msg;
      setStatus(msg, "warn");
      return;
    }
    await Promise.all([refreshSkills(), refreshSkillsCatalog({ remote: false })]);
    if (status) status.textContent = `已安装 ${res.name} → ${res.destDir || "用户技能目录"}`;
    setStatus(`技能已安装：${res.name}`, "live");
    if (state.page === "skills") {
      el("content").innerHTML = pageHtml("skills");
      bindSkillsHandlers();
    }
  }

  el("skillsInstallDirBtn")?.addEventListener("click", async () => {
    const status = el("skillsStoreStatus");
    try {
      await runSkillInstall({ overwrite: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (status) status.textContent = msg;
      setStatus(msg, "warn");
    }
  });

  async function showSkillPreview(payload) {
    const status = el("skillsStoreStatus");
    try {
      if (!window.hfq?.previewSkill) throw new Error("previewSkill unavailable");
      const res = await window.hfq.previewSkill({
        workspacePath: state.workspacePath,
        ...payload,
      });
      if (res?.cancelled) return;
      if (!res?.ok) {
        state.skillPreview = {
          name: payload.name || "预览",
          error: res?.error || "无法预览",
        };
      } else {
        state.skillPreview = {
          name: res.name,
          description: res.description,
          body: res.body,
          path: res.path,
        };
      }
      if (state.page === "skills") {
        el("content").innerHTML = pageHtml("skills");
        bindSkillsHandlers();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (status) status.textContent = msg;
      setStatus(msg, "warn");
    }
  }

  el("skillsPreviewPickBtn")?.addEventListener("click", () => {
    void showSkillPreview({ pick: true });
  });
  el("skillDrawerCloseBtn")?.addEventListener("click", () => {
    state.skillPreview = null;
    if (state.page === "skills") {
      el("content").innerHTML = pageHtml("skills");
      bindSkillsHandlers();
    }
  });
  document.querySelectorAll("[data-preview-skill-name]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-preview-skill-name");
      if (name) void showSkillPreview({ name });
    });
  });
  document.querySelectorAll("[data-preview-skill-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-preview-skill-dir");
      if (dir) void showSkillPreview({ skillDir: dir });
    });
  });
  document.querySelectorAll("[data-skills-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.skillsCatalogTag = btn.getAttribute("data-skills-tag") || "";
      if (state.page === "skills") {
        el("content").innerHTML = pageHtml("skills");
        bindSkillsHandlers();
      }
    });
  });
  el("skillsOpenUserDir")?.addEventListener("click", async () => {
    const dir = state.appPaths?.skills || state.skillsCatalog?.userSkillsDir;
    if (!dir) return;
    try {
      await window.hfq.openPath({ path: dir });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "warn");
    }
  });
  document.querySelectorAll("[data-skills-tab]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = btn.getAttribute("data-skills-tab") === "store" ? "store" : "installed";
      state.skillsTab = next;
      if (next === "store" && !state.skillsCatalog) {
        await refreshSkillsCatalog();
      }
      if (state.page === "skills") {
        el("content").innerHTML = pageHtml("skills");
        bindSkillsHandlers();
      }
    });
  });
  el("skillsCatalogFilter")?.addEventListener("input", (ev) => {
    state.skillsCatalogFilter = /** @type {HTMLInputElement} */ (ev.target).value || "";
    if (state.page === "skills" && state.skillsTab === "store") {
      el("content").innerHTML = pageHtml("skills");
      bindSkillsHandlers();
      const input = el("skillsCatalogFilter");
      if (input instanceof HTMLInputElement) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  });
  document.querySelectorAll("[data-open-skill-dir]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dir = btn.getAttribute("data-open-skill-dir");
      if (!dir) return;
      try {
        await window.hfq.openPath({ path: dir });
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
  document.querySelectorAll("[data-open-skill-home]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.getAttribute("data-open-skill-home");
      if (!url) return;
      try {
        if (window.hfq?.openExternal) {
          await window.hfq.openExternal({ url });
        } else if (window.hfq?.openReleasePage) {
          await window.hfq.openReleasePage({ url });
        } else {
          setStatus("无法打开链接", "warn");
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "warn");
      }
    });
  });
}

function bindChangesHandlers() {
			  const filterInput = el("changeFilterInput");
			  filterInput?.addEventListener("input", () => {
			    state.changeFilter = filterInput.value || "";
			  });
			  filterInput?.addEventListener("keydown", (ev) => {
			    if (ev.key === "Enter") {
			      ev.preventDefault();
			      state.changeFilter = filterInput.value || "";
			      renderPage("changes");
			    }
			  });
			  filterInput?.addEventListener("change", () => {
			    state.changeFilter = filterInput.value || "";
			    renderPage("changes");
			  });
			  document.querySelectorAll("[data-change-path]").forEach((btn) => {
			    btn.addEventListener("click", () => {
			      state.selectedChangePath = btn.getAttribute("data-change-path");
			      state.changeActionNote = null;
			      renderPage("changes");
			    });
			  });
			  el("openChangeBtn")?.addEventListener("click", async () => {
			    const rel = el("openChangeBtn")?.getAttribute("data-path");
			    if (!rel || !state.workspacePath) {
			      state.changeActionNote = "请先打开工作区";
			      renderPage("changes");
			      return;
			    }
			    try {
			      await window.hfq.openWorkspaceFile({
			        workspacePath: state.workspacePath,
			        path: rel,
			      });
			      state.changeActionNote = `已在系统中打开 ${rel}`;
			    } catch (err) {
			      state.changeActionNote = err instanceof Error ? err.message : String(err);
			    }
			    renderPage("changes");
			  });
			  el("openEditorBtn")?.addEventListener("click", async () => {
			    const rel = el("openEditorBtn")?.getAttribute("data-path");
			    if (!rel || !state.workspacePath) {
			      state.changeActionNote = "请先打开工作区";
			      renderPage("changes");
			      return;
			    }
			    try {
			      const res = await window.hfq.openInEditor({
			        workspacePath: state.workspacePath,
			        path: rel,
			      });
			      state.changeActionNote = `已用 ${res?.via || "编辑器"} 打开 ${rel}`;
			    } catch (err) {
			      state.changeActionNote = err instanceof Error ? err.message : String(err);
			    }
			    renderPage("changes");
			  });
	el("acceptChangeBtn")?.addEventListener("click", () => {
				    const path = el("acceptChangeBtn")?.getAttribute("data-path");
				    if (path) void acceptChange(path);
				  });
				  el("applyHunksBtn")?.addEventListener("click", () => {
				    const path = el("applyHunksBtn")?.getAttribute("data-path");
				    if (path) void applySelectedHunks(path);
				  });
				  el("rejectChangeBtn")?.addEventListener("click", () => {
				    const path = el("rejectChangeBtn")?.getAttribute("data-path");
				    if (path) void rejectChange(path);
				  });
				  // Persist checkbox selection on the change object so re-renders keep choices.
				  el("content")?.querySelectorAll("[data-hunk-id]").forEach((box) => {
			    box.addEventListener("change", () => {
			      const path = el("applyHunksBtn")?.getAttribute("data-path");
			      if (!path) return;
			      const change = state.changes.find((c) => c.path === path);
			      if (!change) return;
			      change.selectedHunks = collectSelectedHunkIds(path);
			    });
			  });
			}

function applyTheme(theme) {
			  const t = theme === "light" ? "light" : "dark";
			  document.documentElement.dataset.theme = t;
			  document.body?.setAttribute("data-theme", t);
			}

function bindSettingsHandlers() {
				  el("settingsRefreshBtn")?.addEventListener("click", async () => {
				    await Promise.all([
				      refreshAppPaths(),
				      refreshConfig(),
				      refreshSessions(),
				      loadAgentsEditor(),
				    ]);
				    if (state.page === "settings") renderPage("settings");
				  });
				  el("agentsReloadBtn")?.addEventListener("click", async () => {
				    await loadAgentsEditor();
				    if (state.page === "settings") renderPage("settings");
				  });
				  el("agentsSaveBtn")?.addEventListener("click", async () => {
				    const status = el("agentsStatus");
				    const ta = /** @type {HTMLTextAreaElement | null} */ (el("agentsEditor"));
				    if (!state.workspacePath || !ta) return;
				    try {
				      const content = ta.value ?? "";
				      await window.hfq.writeWorkspaceText({
				        workspacePath: state.workspacePath,
				        path: "AGENTS.md",
				        content,
				      });
				      state.agentsEditor = {
				        path: "AGENTS.md",
				        content,
				        exists: true,
				        dirty: false,
				      };
				      if (status) status.textContent = "AGENTS.md 已保存";
				      setStatus("AGENTS.md 已保存", "live");
				    } catch (err) {
				      const msg = err instanceof Error ? err.message : String(err);
				      if (status) status.textContent = msg;
				      setStatus(msg, "warn");
				    }
				  });
el("prefsSaveBtn")?.addEventListener("click", async () => {
				    const status = el("prefsStatus");
				    try {
				      const theme = /** @type {HTMLSelectElement | null} */ (el("prefTheme"))?.value || "dark";
				      const proxyUrl = /** @type {HTMLInputElement | null} */ (el("prefProxy"))?.value || "";
				      const compactRaw = /** @type {HTMLInputElement | null} */ (el("prefCompact"))?.value;
				      const memoryEnabled = /** @type {HTMLInputElement | null} */ (el("prefMemory"))?.checked !== false;
const permissionMode = normalizePermissionMode(
					        /** @type {HTMLSelectElement | null} */ (el("prefPermissionMode"))?.value,
					      );
					      if (
					        permissionMode === "full_access" &&
					        !window.confirm(
					          "将默认访问模式设为「完全访问」？\n\n新建会话将自动允许全部工具（含危险 Shell）。",
					        )
					      ) {
					        return;
					      }
const checkUpdatesOnStartup =
						        /** @type {HTMLInputElement | null} */ (el("prefCheckUpdates"))?.checked !== false;
						      const updateSourceRaw =
						        /** @type {HTMLSelectElement | null} */ (el("prefUpdateSource"))?.value ||
						        "ghproxy";
						      const updateSource = updateSourceRaw === "direct" ? "direct" : "ghproxy";
						      const updateProxyBase =
						        /** @type {HTMLInputElement | null} */ (el("prefUpdateProxyBase"))?.value?.trim() ||
						        "https://ghproxy.com/";
						      const compactMaxChars = Number(compactRaw || 48000);
						      const usageInputPerMillion = Number(
						        /** @type {HTMLInputElement | null} */ (el("prefInPrice"))?.value || 0,
						      );
						      const usageOutputPerMillion = Number(
						        /** @type {HTMLInputElement | null} */ (el("prefOutPrice"))?.value || 0,
						      );
						      if (!window.hfq?.setPrefs) throw new Error("setPrefs unavailable");
						      const next = await window.hfq.setPrefs({
						        theme,
						        proxyUrl,
						        memoryEnabled,
						        compactMaxChars,
						        permissionMode,
						        planModeDefault: permissionMode === "plan",
						        checkUpdatesOnStartup,
						        updateSource,
						        updateProxyBase,
						        usageInputPerMillion,
						        usageOutputPerMillion,
						      });
				      state.config = next;
				      applyTheme(next?.prefs?.theme || theme);
				      if (status) status.textContent = "偏好已保存";
				      setStatus("偏好已保存", "live");
				    } catch (err) {
				      const msg = err instanceof Error ? err.message : String(err);
				      if (status) status.textContent = msg;
				      setStatus(msg, "warn");
				    }
				  });
				  el("diagExportBtn")?.addEventListener("click", async () => {
				    const status = el("diagStatus");
				    try {
				      const res = await window.hfq.exportDiagnostics();
				      if (status) status.textContent = `已导出: ${res?.dir || ""}`;
				      if (res?.dir) {
				        try {
				          await window.hfq.openPath({ path: res.dir });
				        } catch {
				          /* ignore */
				        }
				      }
				    } catch (err) {
				      if (status) status.textContent = err instanceof Error ? err.message : String(err);
				    }
				  });
				  el("updateCheckBtn")?.addEventListener("click", async () => {
				    const status = el("updateStatus");
				    const btn = el("updateCheckBtn");
				    if (btn instanceof HTMLButtonElement) btn.disabled = true;
				    if (status) status.textContent = "正在查询 Releases（多源自动回退）…";
				    try {
				      if (!window.hfq?.checkForUpdates) throw new Error("checkForUpdates unavailable");
				      const res = await window.hfq.checkForUpdates({ force: true });
				      state.updateCheck = res;
				      if (status) {
				        status.textContent = formatUpdateStatus(res, state.appPaths?.version);
				      }
				      if (res?.updateAvailable) {
				        setStatus(`发现新版本 ${res.latestVersion}`, "warn");
				      } else if (res?.ok) {
				        setStatus(res.skipped ? "更新检查已节流" : "已是最新版本", "live");
				      } else {
				        setStatus(res?.error || "检查更新失败", "warn");
				      }
				      if (state.page === "settings") renderPage("settings");
				    } catch (err) {
				      const msg = err instanceof Error ? err.message : String(err);
				      if (status) status.textContent = msg;
				      setStatus(msg, "warn");
				    } finally {
				      if (btn instanceof HTMLButtonElement) btn.disabled = false;
				    }
				  });
				  el("updateOpenBtn")?.addEventListener("click", async () => {
				    try {
				      const url =
				        state.updateCheck?.releaseUrl ||
				        "https://github.com/BB0813/HFQ-Code/releases";
				      await window.hfq.openReleasePage({ url });
				      setStatus("已在浏览器打开发布页", "live");
				    } catch (err) {
				      setStatus(err instanceof Error ? err.message : String(err), "warn");
				    }
				  });
				  el("updateSourceSaveBtn")?.addEventListener("click", async () => {
				    const status = el("updateStatus");
				    try {
				      if (!window.hfq?.setPrefs) throw new Error("setPrefs unavailable");
				      const updateSourceRaw =
				        /** @type {HTMLSelectElement | null} */ (el("prefUpdateSource"))?.value ||
				        "ghproxy";
				      const updateSource = updateSourceRaw === "direct" ? "direct" : "ghproxy";
				      const updateProxyBase =
				        /** @type {HTMLInputElement | null} */ (el("prefUpdateProxyBase"))?.value?.trim() ||
				        "https://ghproxy.com/";
				      const next = await window.hfq.setPrefs({ updateSource, updateProxyBase });
				      state.config = next;
				      if (status) {
				        status.textContent =
				          updateSource === "ghproxy"
				            ? `已保存 · 更新检查走 ghproxy（${updateProxyBase}）`
				            : "已保存 · 更新检查直连 api.github.com";
				      }
				      setStatus("更新源已保存", "live");
				    } catch (err) {
				      const msg = err instanceof Error ? err.message : String(err);
				      if (status) status.textContent = msg;
				      setStatus(msg, "warn");
				    }
				  });
				  document.querySelectorAll("[data-open-update-url]").forEach((btn) => {
				    btn.addEventListener("click", async () => {
				      const url = btn.getAttribute("data-open-update-url");
				      if (!url) return;
				      try {
				        await window.hfq.openReleasePage({ url });
				        setStatus("已在浏览器打开下载链接", "live");
				      } catch (err) {
				        setStatus(err instanceof Error ? err.message : String(err), "warn");
				      }
				    });
				  });
				  el("prefCheckUpdates")?.addEventListener("change", async () => {
				    const checked =
				      /** @type {HTMLInputElement | null} */ (el("prefCheckUpdates"))?.checked !== false;
				    try {
				      if (!window.hfq?.setPrefs) return;
				      const next = await window.hfq.setPrefs({ checkUpdatesOnStartup: checked });
				      state.config = next;
				      setStatus(checked ? "已开启启动时检查更新" : "已关闭启动时检查更新", "live");
				    } catch (err) {
				      setStatus(err instanceof Error ? err.message : String(err), "warn");
				    }
				  });
			  el("prefTheme")?.addEventListener("change", () => {
			    const theme = /** @type {HTMLSelectElement | null} */ (el("prefTheme"))?.value || "dark";
			    applyTheme(theme);
			  });
			  document.querySelectorAll("[data-open-path]").forEach((btn) => {
			    btn.addEventListener("click", async () => {
			      const target = btn.getAttribute("data-open-path");
			      if (!target) return;
			      try {
			        await window.hfq.openPath({ path: target });
			      } catch (err) {
			        setStatus(err instanceof Error ? err.message : String(err), "warn");
			      }
			    });
			  });
			  document.querySelectorAll("[data-open-session]").forEach((btn) => {
			    btn.addEventListener("click", () => {
			      const id = btn.getAttribute("data-open-session");
			      if (id) void openRecentSession(id);
			    });
			  });
	document.querySelectorAll("[data-delete-session]").forEach((btn) => {
				    btn.addEventListener("click", (ev) => {
				      ev.preventDefault();
				      ev.stopPropagation();
				      const id = btn.getAttribute("data-delete-session");
				      if (id) void deleteRecentSession(id);
				    });
				  });
				  document.querySelectorAll("[data-rename-session]").forEach((btn) => {
				    btn.addEventListener("click", (ev) => {
				      ev.preventDefault();
				      ev.stopPropagation();
				      const id = btn.getAttribute("data-rename-session");
				      const title = btn.getAttribute("data-session-title") || "";
				      if (id) void renameRecentSession(id, title);
				    });
				  });
				}

function bindMcpHandlers() {
  const refresh = async () => {
    state.mcp = await window.hfq.listMcp();
    if (state.page === "mcp") {
      el("content").innerHTML = pageHtml("mcp");
      bindMcpHandlers();
    }
  };

  document.querySelectorAll("[data-mcp-enable]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await window.hfq.setMcpEnabled({
          id: btn.getAttribute("data-mcp-enable"),
          enabled: btn.getAttribute("data-enabled") === "1",
        });
        await refresh();
      } catch (err) {
        const status = el("mcpStatus");
        if (status) status.textContent = err instanceof Error ? err.message : String(err);
      }
    });
  });

  document.querySelectorAll("[data-mcp-connect]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        setStatus("连接 MCP…", "busy");
        await window.hfq.connectMcp({ id: btn.getAttribute("data-mcp-connect") });
        setStatus("MCP 已连接", "live");
        await refresh();
      } catch (err) {
        setStatus("MCP 连接失败", "warn");
        const status = el("mcpStatus");
        if (status) status.textContent = err instanceof Error ? err.message : String(err);
        await refresh();
      }
    });
  });

document.querySelectorAll("[data-mcp-disconnect]").forEach((btn) => {
	    btn.addEventListener("click", async () => {
	      await window.hfq.disconnectMcp({ id: btn.getAttribute("data-mcp-disconnect") });
	      await refresh();
	    });
	  });

document.querySelectorAll("[data-mcp-remove]").forEach((btn) => {
		    btn.addEventListener("click", async () => {
		      const id = btn.getAttribute("data-mcp-remove");
		      if (!id) return;
		      if (!window.confirm(`从注册表删除 MCP 服务器「${id}」？`)) return;
		      try {
		        await window.hfq.removeMcp({ id });
		        setStatus(`已删除 MCP ${id}`, "live");
		        await refresh();
		      } catch (err) {
		        setStatus(err instanceof Error ? err.message : String(err), "warn");
		      }
		    });
		  });

		  document.querySelectorAll("[data-mcp-ping]").forEach((btn) => {
		    btn.addEventListener("click", async () => {
		      const id = btn.getAttribute("data-mcp-ping");
		      if (!id) return;
		      try {
		        setStatus(`Ping ${id}…`, "busy");
		        const res = await window.hfq.pingMcp({ id });
		        const status = el("mcpStatus");
		        const msg = res?.ok
		          ? `Ping 成功 · ${res.latencyMs}ms · tools ${res.toolCount ?? 0}`
		          : `Ping 失败: ${res?.error || res?.lastError || res?.status || "unknown"}`;
		        if (status) status.textContent = msg;
		        setStatus(msg, res?.ok ? "live" : "warn");
		        await refresh();
		      } catch (err) {
		        setStatus(err instanceof Error ? err.message : String(err), "warn");
		      }
		    });
		  });

		  el("mcpSaveBtn")?.addEventListener("click", async () => {
	    try {
	      const transport = el("mcpTransport")?.value || "stdio";
	      const endpoint = el("mcpEndpoint")?.value?.trim() || "";
	      const auth = el("mcpAuth")?.value?.trim() || "";
	await window.hfq.upsertMcp({
		        id: el("mcpId")?.value?.trim(),
		        name: el("mcpName")?.value?.trim() || "Custom MCP",
		        transport,
		        command: transport === "stdio" ? endpoint : undefined,
		        url: transport === "http" ? endpoint : undefined,
		        argsText: el("mcpArgs")?.value || "",
		        authHeader: transport === "http" && auth ? auth : undefined,
		        description: el("mcpDesc")?.value?.trim(),
		        enabled: true,
		      });
		      const status = el("mcpStatus");
		      if (status) status.textContent = "已保存到 config.json";
		      setStatus("MCP 注册表已更新", "live");
		      await refresh();
	    } catch (err) {
	      const status = el("mcpStatus");
	      if (status) status.textContent = err instanceof Error ? err.message : String(err);
	    }
	  });
	}

function bindModelsHandlers() {
  const cfg = state.config;
  if (!cfg) return;

  const fillFrom = (providerId) => {
    const p = cfg.providers.find((x) => x.id === providerId);
    if (!p) return;
    const set = (id, v) => {
      const node = el(id);
      if (node) node.value = v ?? "";
    };
    set("provId", p.id);
    set("provName", p.name);
    set("provBase", p.baseURL || "");
    set("provKey", "");
    set("provModels", (p.models || []).join(", "));
    set("provDefault", p.defaultModel || p.models?.[0] || "");
    const kind = el("provKind");
    if (kind && p.kind) kind.value = p.kind;
  };

  el("activeProviderSelect")?.addEventListener("change", () => {
    const providerId = el("activeProviderSelect").value;
    const p = cfg.providers.find((x) => x.id === providerId);
    const modelSelect = el("activeModelSelect");
    if (!modelSelect || !p) return;
    modelSelect.innerHTML = (p.models || [])
      .map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
      .join("");
    if (p.defaultModel) modelSelect.value = p.defaultModel;
  });

el("saveActiveBtn")?.addEventListener("click", async () => {
		    try {
		      state.config = await window.hfq.setActiveModel({
		        providerId: el("activeProviderSelect")?.value,
		        model: el("activeModelSelect")?.value,
		      });
		      updateModelProviderBadge();
		      const status = el("modelsStatus");
		      if (status) status.textContent = "已保存。请新建会话后生效。";
		      renderPage("models");
		    } catch (err) {
		      const status = el("modelsStatus");
		      if (status) status.textContent = err instanceof Error ? err.message : String(err);
		    }
		  });

		  el("testModelBtn")?.addEventListener("click", async () => {
		    const status = el("modelsStatus");
		    const providerId = el("activeProviderSelect")?.value || state.config?.activeProviderId;
		    const model = el("activeModelSelect")?.value || state.config?.activeModel;
		    if (status) status.textContent = "测试中…";
		    try {
		      // Persist selection first so test uses the form values when saved on disk.
		      state.config = await window.hfq.setActiveModel({ providerId, model });
		      updateModelProviderBadge();
		      const res = await window.hfq.testModel({ providerId, model });
		      if (res?.ok) {
		        if (status) {
		          status.textContent = `连通成功 · ${res.latencyMs}ms · ${String(res.reply || "").slice(0, 80)}`;
		        }
		        setStatus(`模型就绪 · ${providerId}/${model}`, "live");
		      } else {
		        if (status) status.textContent = `失败: ${res?.error || "unknown"}`;
		        setStatus("模型连通失败", "warn");
		      }
		    } catch (err) {
		      if (status) status.textContent = err instanceof Error ? err.message : String(err);
		      setStatus("模型连通失败", "warn");
		    }
		  });

	  document.querySelectorAll("[data-activate]").forEach((btn) => {
	    btn.addEventListener("click", async () => {
	      const providerId = btn.getAttribute("data-activate");
	      const p = cfg.providers.find((x) => x.id === providerId);
	      state.config = await window.hfq.setActiveModel({
	        providerId,
	        model: p?.defaultModel || p?.models?.[0],
	      });
	      updateModelProviderBadge();
	      renderPage("models");
	    });
	  });

  el("fillFromActiveBtn")?.addEventListener("click", () => {
    const p =
      cfg.providers.find((x) => x.id === cfg.activeProviderId) ||
      cfg.providers.find((x) => x.kind === "openai_compatible") ||
      cfg.providers.find((x) => x.id === "openai-compatible");
    if (p) fillFrom(p.id);
  });

  el("fillAnthropicBtn")?.addEventListener("click", () => {
    const set = (id, v) => {
      const node = el(id);
      if (node) node.value = v ?? "";
    };
    set("provId", "anthropic");
    set("provName", "Anthropic");
    const kind = el("provKind");
    if (kind) kind.value = "anthropic";
    set("provBase", "https://api.anthropic.com");
    set("provModels", "claude-sonnet-4-20250514, claude-haiku-4-5-20251001");
    set("provDefault", "claude-sonnet-4-20250514");
  });

  el("saveProviderBtn")?.addEventListener("click", async () => {
    try {
      const models = String(el("provModels")?.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const kind = el("provKind")?.value || "openai_compatible";
      state.config = await window.hfq.upsertProvider({
        id: el("provId")?.value?.trim() || "openai-compatible",
        name: el("provName")?.value?.trim() || "Provider",
        kind,
        enabled: true,
        baseURL: el("provBase")?.value?.trim(),
        apiKey: el("provKey")?.value || undefined,
        models,
        defaultModel: el("provDefault")?.value?.trim() || models[0],
      });
      const status = el("modelsStatus");
      if (status) status.textContent = "提供方已保存。";
      renderPage("models");
    } catch (err) {
      const status = el("modelsStatus");
      if (status) status.textContent = err instanceof Error ? err.message : String(err);
    }
  });

  const fillKind = (p) => {
    const kind = el("provKind");
    if (kind && p?.kind) kind.value = p.kind;
  };

  // Prefer active provider fields when form is empty.
  const seed =
    cfg.providers.find((p) => p.id === cfg.activeProviderId) ||
    cfg.providers.find((p) => p.id === "openai-compatible");
  if (seed) {
    const set = (id, v) => {
      const node = el(id);
      if (node && !node.value) node.value = v ?? "";
    };
    set("provId", seed.id || "");
    set("provName", seed.name || "");
    set("provBase", seed.baseURL || "");
    set("provModels", (seed.models || []).join(", "));
    set("provDefault", seed.defaultModel || "");
    fillKind(seed);
  }
}

async function refreshSkills() {
  try {
    state.skills = await window.hfq.listSkills({ workspacePath: state.workspacePath });
  } catch (err) {
    state.skills = [
      {
        name: "(错误)",
        description: err instanceof Error ? err.message : String(err),
        source: "bundled",
        eligible: false,
        ineligibleReason: "加载失败",
      },
    ];
  }
}

async function refreshConfig() {
		  try {
		    state.config = await window.hfq.getConfig();
		    if (state.config?.prefs?.theme) applyTheme(state.config.prefs.theme);
		  } catch (err) {
		state.config = {
			      activeProviderId: "mock",
			      activeModel: "mock-hfq",
			      providers: [],
			      recentWorkspaces: [],
			      prefs: { theme: "dark", proxyUrl: "", memoryEnabled: true, compactMaxChars: 48000 },
			      error: err instanceof Error ? err.message : String(err),
			    };
		  }
		  updateModelProviderBadge();
		}

async function refreshPolicy() {
  try {
    const res = await window.hfq.getPolicyMatrix({
      sessionId: state.session?.id || undefined,
    });
    if (Array.isArray(res)) {
      state.policyMatrix = res;
      state.sessionAllows = [];
    } else {
      state.policyMatrix = res?.matrix || [];
      state.sessionAllows = res?.sessionAllows || [];
    }
  } catch (err) {
    state.policyMatrix = [
      {
        toolName: "(error)",
        risk: "high",
        decision: "ask",
        note: err instanceof Error ? err.message : String(err),
      },
    ];
    state.sessionAllows = [];
  }
}

async function refreshMcp() {
  try {
    state.mcp = await window.hfq.listMcp();
  } catch (err) {
    state.mcp = {
      servers: [],
      tools: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function renderPage(id) {
		  state.page = id;
		  const meta = NAV_META[id] || { label: id };
		  el("pageTitle").textContent = meta.label;
		  setCrumb();
		  updateModelProviderBadge();
		  el("content").innerHTML = pageHtml(id);
		  document.querySelectorAll(".nav button").forEach((btn) => {
		    btn.classList.toggle("active", btn.dataset.id === id);
		  });
if (id === "home") {
		    bindHomeHandlers();
		    void Promise.all([refreshSessions(), refreshConfig()]).then(() => {
		      if (state.page === "home") {
		        el("content").innerHTML = pageHtml("home");
		        bindHomeHandlers();
		      }
		    });
		  }
if (id === "chat") {
					    bindChatHandlers();
					    if (!state.skills?.length) {
					      void refreshSkills().then(() => {
					        if (state.page === "chat" && el("slashPaletteList")) {
					          const panel = el("slashPalette");
					          if (panel && !panel.classList.contains("hidden")) {
					            renderSlashPaletteList(paletteItems(), 0);
					          }
					        }
					      });
					    }
					  }
					  if (id === "changes") bindChangesHandlers();
				  if (id === "terminal") bindTerminalHandlers();
				  if (id === "tasks") {
				    bindTasksHandlers();
				    void refreshChildSessions().then(() => {
				      if (state.page === "tasks") {
				        el("content").innerHTML = pageHtml("tasks");
				        bindTasksHandlers();
				      }
				    });
				  }
				  if (id === "settings") {
			    bindSettingsHandlers();
			    void Promise.all([
			      refreshAppPaths(),
			      refreshConfig(),
			      refreshSessions(),
			      loadAgentsEditor(),
			    ]).then(() => {
			      if (state.page === "settings") {
		        el("content").innerHTML = pageHtml("settings");
		        bindSettingsHandlers();
		      }
		    });
		  }
		  if (id === "models") {
		    void refreshConfig().then(() => {
		      if (state.page === "models") {
		        el("content").innerHTML = pageHtml("models");
		        bindModelsHandlers();
		      }
		    });
		    bindModelsHandlers();
		  }
		  if (id === "skills") {
		    void Promise.all([
		      refreshSkills(),
		      refreshAppPaths(),
		      state.skillsTab === "store" ? refreshSkillsCatalog() : Promise.resolve(),
		    ]).then(() => {
		      if (state.page === "skills") {
		        el("content").innerHTML = pageHtml("skills");
		        bindSkillsHandlers();
		      }
		    });
		  }
if (id === "permissions") {
			    void refreshPolicy().then(() => {
			      if (state.page === "permissions") {
			        el("content").innerHTML = pageHtml("permissions");
			        bindPermissionsHandlers();
			      }
			    });
			    bindPermissionsHandlers();
			  }
if (id === "audit") bindAuditHandlers();
			  if (id === "mcp") {
			    void refreshMcp().then(() => {
			      if (state.page === "mcp") {
			        el("content").innerHTML = pageHtml("mcp");
			        bindMcpHandlers();
			      }
			    });
			    bindMcpHandlers();
			  }
			  if (id === "memory") {
			    void refreshMemory().then(() => {
			      if (state.page === "memory") {
			        el("content").innerHTML = pageHtml("memory");
			        bindMemoryHandlers();
			      }
			    });
			    bindMemoryHandlers();
			  }
			  if (id === "usage") {
			    void refreshUsage().then(() => {
			      if (state.page === "usage") {
			        el("content").innerHTML = pageHtml("usage");
			        bindUsageHandlers();
			      }
			    });
			    bindUsageHandlers();
			  }
			  if (id === "import") {
			    bindImportHandlers();
			  }
			}

			async function refreshMemory() {
			  try {
			    state.memoryDocs = await window.hfq.listMemory({
			      workspacePath: state.workspacePath,
			      scope: state.memoryScope || "all",
			      limit: 100,
			    });
			  } catch (err) {
			    state.memoryDocs = [];
			    setStatus(err instanceof Error ? err.message : String(err), "warn");
			  }
			}

			async function refreshUsage() {
			  try {
			    state.usageSummary = await window.hfq.usageSummary();
			  } catch (err) {
			    state.usageSummary = null;
			    setStatus(err instanceof Error ? err.message : String(err), "warn");
			  }
			}

			function bindMemoryHandlers() {
			  el("memoryRefreshBtn")?.addEventListener("click", async () => {
			    await refreshMemory();
			    renderPage("memory");
			  });
			  el("memScope")?.addEventListener("change", async () => {
			    state.memoryScope = el("memScope")?.value || "all";
			    await refreshMemory();
			    renderPage("memory");
			  });
			  el("memSearchBtn")?.addEventListener("click", async () => {
			    const q = el("memQuery")?.value || "";
			    state.memoryQuery = q;
			    try {
			      state.memoryHits = await window.hfq.searchMemory({
			        query: q,
			        workspacePath: state.workspacePath,
			        scope: state.memoryScope || "all",
			      });
			      renderPage("memory");
			    } catch (err) {
			      setStatus(err instanceof Error ? err.message : String(err), "warn");
			    }
			  });
			  el("memSaveBtn")?.addEventListener("click", async () => {
			    const text = el("memText")?.value || "";
			    const status = el("memStatus");
			    try {
			      await window.hfq.upsertMemory({
			        text,
			        scope: el("memWriteScope")?.value || "project",
			        pinned: Boolean(el("memPinned")?.checked),
			        workspacePath: state.workspacePath,
			        source: "user",
			      });
			      if (status) status.textContent = "已保存";
			      if (el("memText")) el("memText").value = "";
			      await refreshMemory();
			      renderPage("memory");
			    } catch (err) {
			      if (status) status.textContent = err instanceof Error ? err.message : String(err);
			    }
			  });
			  document.querySelectorAll("[data-del-mem]").forEach((btn) => {
			    btn.addEventListener("click", async () => {
			      const id = btn.getAttribute("data-del-mem");
			      if (!id) return;
			      try {
			        await window.hfq.removeMemory({
			          id,
			          scope: btn.getAttribute("data-mem-scope") || undefined,
			          workspacePath: state.workspacePath,
			        });
			        await refreshMemory();
			        renderPage("memory");
			      } catch (err) {
			        setStatus(err instanceof Error ? err.message : String(err), "warn");
			      }
			    });
			  });
			}

			function bindUsageHandlers() {
			  el("usageRefreshBtn")?.addEventListener("click", async () => {
			    await refreshUsage();
			    renderPage("usage");
			  });
			}

			function bindImportHandlers() {
			  el("importScanBtn")?.addEventListener("click", async () => {
			    try {
			      state.importNote = "扫描中…";
			      renderPage("import");
			      state.importScan = await window.hfq.importScan({
			        workspacePath: state.workspacePath,
			      });
			      state.importSelected = {};
			      state.importNote = `找到 ${state.importScan?.candidates?.length || 0} 个候选`;
			      renderPage("import");
			    } catch (err) {
			      state.importNote = err instanceof Error ? err.message : String(err);
			      renderPage("import");
			    }
			  });
			  document.querySelectorAll("[data-import-id]").forEach((box) => {
			    box.addEventListener("change", () => {
			      const id = box.getAttribute("data-import-id");
			      if (!id) return;
			      state.importSelected[id] = Boolean(box.checked);
			    });
			  });
			  el("importApplyBtn")?.addEventListener("click", async () => {
			    const items = Object.entries(state.importSelected)
			      .filter(([, v]) => v)
			      .map(([id]) => ({ id, conflict: "rename" }));
			    if (!items.length) {
			      state.importNote = "请先勾选候选";
			      renderPage("import");
			      return;
			    }
			    try {
			      const res = await window.hfq.importApply({
			        items,
			        candidates: state.importScan?.candidates || [],
			        workspacePath: state.workspacePath,
			        conflictDefault: "rename",
			      });
			      state.importNote = `已复制 ${res.copied?.length || 0} · 跳过 ${
			        res.skipped?.length || 0
			      } · 错误 ${res.errors?.length || 0}`;
			      await refreshSkills();
			      renderPage("import");
			    } catch (err) {
			      state.importNote = err instanceof Error ? err.message : String(err);
			      renderPage("import");
			    }
			  });
			}

function buildNav(pages) {
  const nav = el("nav");
  nav.innerHTML = "";
  let lastGroup = "";
  for (const page of pages) {
    const meta = NAV_META[page.id] || { label: page.label, group: "工作区" };
    if (meta.group && meta.group !== lastGroup) {
      lastGroup = meta.group;
      if (nav.children.length && meta.group !== "工作区") {
        const sec = document.createElement("div");
        sec.className = "nav-section";
        sec.textContent = meta.group;
        nav.appendChild(sec);
      }
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = page.id;
    btn.innerHTML = `<span class="nav-ico">${ICONS[page.id] || ICONS.settings}</span><span class="nav-label">${escapeHtml(
      meta.label || page.label,
    )}</span>`;
    btn.addEventListener("click", () => renderPage(page.id));
    nav.appendChild(btn);
  }
}

async function boot() {
  const pages =
    (await window.hfq?.listPages?.()) ??
    Object.keys(NAV_META).map((id) => ({ id, label: NAV_META[id].label }));

  buildNav(pages);

el("openWs").addEventListener("click", async () => {
		    const res = await window.hfq.openWorkspace();
		    if (res?.workspacePath) {
		      state.workspacePath = res.workspacePath;
		      state.session = null;
		      resetLiveSurfaces();
		      el("wsPath").textContent = res.workspacePath;
		      setStatus("工作区已打开", "live");
		      setSessionBadge();
		      setCrumb();
		      await Promise.all([refreshSessions(), refreshConfig()]);
		      if (state.page === "home" || state.page === "chat" || state.page === "settings") {
		        renderPage(state.page);
		      }
		    }
		  });

  el("permModal").addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const decision = target.getAttribute("data-perm");
    if (!decision || !state.pendingPermission || state.permissionResolving) return;
    await resolveCurrentPermission(decision);
  });

  window.hfq.onSessionEvent(handleSessionEvent);
  window.hfq.onWorkspaceChanged((data) => {
    state.workspacePath = data.workspacePath;
    el("wsPath").textContent = data.workspacePath || "尚未选择文件夹";
    setCrumb();
  });
  window.hfq.onUpdateAvailable?.((result) => {
    state.updateCheck = result;
    if (result?.updateAvailable && result.latestVersion) {
      setStatus(`发现新版本 ${result.latestVersion} · 可到设置页下载`, "warn");
    }
  });

  const info = await window.hfq.getInfo();
  if (info) {
    setStatus(info.bootError ? `启动: ${info.bootError}` : `${info.platform}`, info.bootError ? "warn" : "live");
    if (info.workspacePath) {
      state.workspacePath = info.workspacePath;
      el("wsPath").textContent = info.workspacePath;
    }
  }

el("modelProviderBadge")?.addEventListener("click", () => {
	    renderPage("models");
	  });

	await refreshConfig();
		  await Promise.all([refreshSessions(), refreshAppPaths()]);
		  setSessionBadge();
		  setCrumb();
		  updateModelProviderBadge();
		  renderPage("home");
		}

boot();
