const { app, BrowserWindow, ipcMain, dialog, shell, net } = require("electron");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

/** Public GitHub repo used for release checks (manual download channel). */
const UPDATE_REPO = { owner: "BB0813", name: "HFQ-Code" };
const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPO.owner}/${UPDATE_REPO.name}/releases`;
const UPDATE_API_LATEST = `https://api.github.com/repos/${UPDATE_REPO.owner}/${UPDATE_REPO.name}/releases/latest`;
const UPDATE_CHECK_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Default public mirror for CN networks (wraps full https://… URL). */
const DEFAULT_GHPROXY_BASE = "https://ghproxy.com/";

/**
 * Normalize a ghproxy-style base to end with exactly one trailing slash.
 * @param {string | undefined | null} base
 */
function normalizeGhproxyBase(base) {
  const raw = String(base || DEFAULT_GHPROXY_BASE).trim() || DEFAULT_GHPROXY_BASE;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return DEFAULT_GHPROXY_BASE;
    }
    const href = u.href.endsWith("/") ? u.href : `${u.href}/`;
    return href;
  } catch {
    return DEFAULT_GHPROXY_BASE;
  }
}

/**
 * Build the Releases latest API URL, optionally via ghproxy.
 * ghproxy expects: {base}https://api.github.com/repos/.../releases/latest
 * @param {{ source?: string, proxyBase?: string }} [opts]
 */
function resolveUpdateApiUrl(opts = {}) {
  const source = opts.source === "direct" ? "direct" : "ghproxy";
  if (source === "direct") {
    return { url: UPDATE_API_LATEST, source: "direct", proxyBase: null };
  }
  const proxyBase = normalizeGhproxyBase(opts.proxyBase);
  return {
    url: `${proxyBase}${UPDATE_API_LATEST}`,
    source: "ghproxy",
    proxyBase,
  };
}

/**
 * Hostnames allowed when opening release / download links from the update UI.
 * Includes common ghproxy mirrors so download pages can open when mirrored.
 */
const UPDATE_OPEN_HOST_ALLOW = new Set([
  "github.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "ghproxy.com",
  "mirror.ghproxy.com",
  "gh.ddlc.top",
  "ghproxy.net",
  "gitclone.com",
]);

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {string | null} */
let workspacePath = null;

/** @type {import('@hfq/agent-core').SessionManager | null} */
let sessionManager = null;

/**
 * Child-process session worker (Phase-3 M3.3). Preferred over in-process manager.
 * @type {import('@hfq/agent-core').SessionWorkerHost | null}
 */
let sessionWorker = null;

/** @type {"worker" | "local" | null} */
let sessionBackend = null;

/** @type {string | null} */
let activeSessionId = null;

/** @type {Error | null} */
let bootError = null;

/** @type {import('@hfq/mcp').McpHost | null} */
let mcpHost = null;
/** Prevent concurrent host bootstrap races. */
let mcpHostPromise = null;

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function loadModules() {
  const [agentCore, configMod, providersMod, skillsMod, mcpMod, policyMod, toolsMod] =
    await Promise.all([
      import("@hfq/agent-core"),
      import("@hfq/config"),
      import("@hfq/providers"),
      import("@hfq/skills"),
      import("@hfq/mcp"),
      import("@hfq/policy"),
      import("@hfq/tools"),
    ]);
  return { agentCore, configMod, providersMod, skillsMod, mcpMod, policyMod, toolsMod };
}

function stripMcpRuntime(servers) {
  return (servers || []).map((s) => ({
    id: s.id,
    name: s.name,
    transport: s.transport,
    command: s.command,
    args: s.args,
    url: s.url,
    headers: s.headers,
    enabled: s.enabled !== false,
    description: s.description,
  }));
}

async function persistMcpRegistry(host) {
  const { configMod } = await loadModules();
  const cfg = await readConfig();
  const next = configMod.withMcpServers(cfg, stripMcpRuntime(host.listServers()));
  await writeConfig(next);
  return next;
}

async function ensureMcpHost() {
  if (mcpHost) return mcpHost;
  if (mcpHostPromise) return mcpHostPromise;
  mcpHostPromise = (async () => {
    const { mcpMod, configMod } = await loadModules();
    const cfg = await readConfig();
    const saved = Array.isArray(cfg.mcpServers) ? cfg.mcpServers : [];
    const initial = saved.length ? saved : mcpMod.defaultMcpServers();
    mcpHost = mcpMod.createMcpHost(initial);
    // First run: seed defaults into config so UI edits survive restart.
    if (!saved.length) {
      await writeConfig(configMod.withMcpServers(cfg, stripMcpRuntime(mcpHost.listServers())));
    }
    return mcpHost;
  })().finally(() => {
    mcpHostPromise = null;
  });
  return mcpHostPromise;
}

async function configPath() {
  const { agentCore } = await loadModules();
  const dirs = await agentCore.ensureDataDirs();
  return path.join(dirs.root, "config.json");
}

async function readConfig() {
  const { configMod } = await loadModules();
  return configMod.loadAppConfig(await configPath());
}

async function writeConfig(cfg) {
  const { configMod } = await loadModules();
  await configMod.saveAppConfig(await configPath(), cfg);
  return cfg;
}

function bundledSkillsDir() {
  // Dev: repo skills/bundled · packaged: process.resourcesPath/skills/bundled
  if (process.resourcesPath) {
    const packed = path.join(process.resourcesPath, "skills", "bundled");
    try {
      require("node:fs").accessSync(packed);
      return packed;
    } catch {
      /* fall through */
    }
  }
  return path.resolve(__dirname, "..", "..", "..", "skills", "bundled");
}

async function sessionPrefs() {
  let memoryEnabled = true;
  let compactMaxChars = 48_000;
  try {
    const cfg = await readConfig();
    memoryEnabled = cfg.prefs?.memoryEnabled !== false;
    compactMaxChars = cfg.prefs?.compactMaxChars || 48_000;
  } catch {
    /* defaults */
  }
  return { memoryEnabled, compactMaxChars };
}

/**
 * Preferred: SessionWorkerHost (child process). Fallback: in-process SessionManager
 * if worker spawn fails (missing node, broken entry, etc.).
 */
async function ensureSessionBackend() {
  if (sessionBackend === "worker" && sessionWorker?.isAlive) {
    return { kind: "worker", host: sessionWorker };
  }
  if (sessionBackend === "local" && sessionManager) {
    return { kind: "local", mgr: sessionManager };
  }

  const { agentCore } = await loadModules();
  const prefs = await sessionPrefs();
  const skillsDir = bundledSkillsDir();

  // Try child worker first.
  try {
    const entryPath = path.join(
      agentCore.SessionWorkerHost.resolvePackageRoot(),
      "dist",
      "worker",
      "entry.js",
    );
    const worker = new agentCore.SessionWorkerHost({
      entryPath,
      // Packaged apps use Electron + ELECTRON_RUN_AS_NODE (no system Node required).
      preferSystemNode: false,
      timeoutMs: 120_000,
      onEvent: async (event) => {
        broadcast("session:event", event);
      },
      onLog: (level, message) => {
        if (level === "error") console.error("[HFQ worker]", message);
        else if (level === "warn") console.warn("[HFQ worker]", message);
      },
      onExit: (code, signal) => {
        console.warn("[HFQ] session worker exited", { code, signal });
        sessionWorker = null;
        if (sessionBackend === "worker") sessionBackend = null;
        if (activeSessionId) {
          broadcast("session:event", {
            type: "session.failed",
            sessionId: activeSessionId,
            error: `Session worker crashed (code=${code ?? "null"} signal=${signal ?? "null"}). Create or reopen a session to continue.`,
            at: new Date().toISOString(),
          });
        }
      },
    });
    await worker.start();
    let mcpServers = [];
    try {
      const cfg = await readConfig();
      mcpServers = Array.isArray(cfg.mcpServers) ? cfg.mcpServers : [];
    } catch {
      /* empty */
    }
    await worker.configure({
      bundledSkillsDir: skillsDir,
      memoryEnabled: prefs.memoryEnabled,
      compactMaxChars: prefs.compactMaxChars,
      mcpServers,
    });
    sessionWorker = worker;
    sessionBackend = "worker";
    console.log("[HFQ] session backend: worker pid=", worker.pid);
    return { kind: "worker", host: worker };
  } catch (err) {
    console.warn(
      "[HFQ] session worker unavailable, falling back to in-process SessionManager:",
      err instanceof Error ? err.message : err,
    );
  }

  // In-process fallback (same as Phase-2).
  try {
    const host = await ensureMcpHost();
    sessionManager = new agentCore.SessionManager({
      bundledSkillsDir: skillsDir,
      memoryEnabled: prefs.memoryEnabled,
      compactMaxChars: prefs.compactMaxChars,
      getExtraTools: () => {
        try {
          const bundle = host.getAgentToolBundle();
          if (!bundle?.defs?.length) return null;
          const handlers = {};
          for (const def of bundle.defs) {
            handlers[def.name] = async (_ws, input) => bundle.call(def.name, input || {});
          }
          return { defs: bundle.defs, handlers };
        } catch (e) {
          console.warn("[HFQ] getExtraTools failed", e);
          return null;
        }
      },
      onEvent: async (event) => {
        broadcast("session:event", event);
      },
    });
    sessionBackend = "local";
    console.log("[HFQ] session backend: local (in-process)");
    return { kind: "local", mgr: sessionManager };
  } catch (err) {
    bootError = err instanceof Error ? err : new Error(String(err));
    console.error("[HFQ] failed to load agent-core", bootError);
    throw bootError;
  }
}

/** @deprecated use ensureSessionBackend — kept name for minimal IPC churn via helpers */
async function ensureSessionManager() {
  const backend = await ensureSessionBackend();
  if (backend.kind === "local") return backend.mgr;
  // Return a facade with SessionManager-like methods for remaining call sites.
  return workerFacade(backend.host);
}

function workerFacade(host) {
  return {
    async create(params) {
      const { provider, ...rest } = params;
      return host.create({
        ...rest,
        provider: providerSpecFromLive(provider) || params.providerSpec,
      });
    },
    async open(params) {
      const { provider, ...rest } = params;
      return host.open({
        ...rest,
        provider: providerSpecFromLive(provider) || params.providerSpec,
      });
    },
    get(id) {
      return host.get(id);
    },
    getSnapshot(id) {
      return host.snapshot(id);
    },
    list() {
      return host.list();
    },
    listAll(ws) {
      return host.listAll(ws);
    },
    send(sessionId, text) {
      return host.send(sessionId, text);
    },
    abort(sessionId) {
      return host.abort(sessionId).then((r) => r.ok);
    },
    delete(sessionId) {
      return host.delete(sessionId);
    },
    rename(sessionId, title) {
      return host.rename(sessionId, title);
    },
    setPlanMode(sessionId, enabled) {
      return host.setPlanMode(sessionId, enabled).then((r) => r.ok);
    },
    getPlanMode(sessionId) {
      return host.getPlanMode(sessionId).then((r) => r.planMode);
    },
    setPermissionMode(sessionId, mode) {
      return host.setPermissionMode(sessionId, mode).then((r) => r.ok);
    },
    getPermissionMode(sessionId) {
      return host.getPermissionMode(sessionId).then((r) => r.permissionMode);
    },
    listChildren(sessionId) {
      return host.listChildren(sessionId);
    },
    spawnSubagent(params) {
      const { provider, ...rest } = params;
      return host.spawnSubagent({
        ...rest,
        provider: providerSpecFromLive(provider),
      });
    },
    resolvePermission(requestId, decision) {
      return host.resolvePermission(requestId, decision).then((r) => r.ok);
    },
    listSessionAllows(sessionId) {
      return host.listSessionAllows(sessionId);
    },
    grantSessionAllow(sessionId, toolName) {
      return host.grantSessionAllow(sessionId, toolName);
    },
    revokeSessionAllow(sessionId, toolName) {
      return host.revokeSessionAllow(sessionId, toolName);
    },
  };
}

function providerSpecFromLive(provider) {
  if (!provider) return undefined;
  // Live ModelProvider instances are not structured-cloneable; callers should pass providerSpec.
  if (provider && typeof provider === "object" && provider.kind && provider.id) {
    return {
      id: provider.id,
      kind: provider.kind,
      baseURL: provider.baseURL,
      apiKey: provider.apiKey,
    };
  }
  return undefined;
}

async function resolveActiveProvider() {
  const { providersMod } = await loadModules();
  const cfg = await readConfig();
  const providerCfg =
    cfg.providers.find((p) => p.id === cfg.activeProviderId) ??
    cfg.providers.find((p) => p.id === "mock");
  if (!providerCfg) {
    return {
      provider: providersMod.createMockProvider(),
      providerSpec: { id: "mock", kind: "mock" },
      model: "mock-hfq",
      providerId: "mock",
    };
  }
  const providerSpec = {
    id: providerCfg.id,
    kind: providerCfg.kind,
    baseURL: providerCfg.baseURL,
    apiKey: providerCfg.apiKey,
  };
  const provider = providersMod.createProviderFromConfig(providerSpec);
  const model =
    cfg.activeModel ||
    providerCfg.defaultModel ||
    providerCfg.models[0] ||
    "mock-hfq";
  return { provider, providerSpec, model, providerId: providerCfg.id };
}

function resolveAppIcon() {
  // Packaged: resources/app/build/icon.* · Dev: apps/desktop/build/icon.*
  const candidates = [
    path.join(__dirname, "..", "build", "icon.ico"),
    path.join(__dirname, "..", "build", "icon.png"),
    path.join(__dirname, "..", "renderer", "assets", "logo-256.png"),
  ];
  for (const p of candidates) {
    try {
      require("node:fs").accessSync(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function stripVersionNoise(raw) {
  let s = String(raw || "").trim();
  if (s.startsWith("v") || s.startsWith("V")) s = s.slice(1);
  const plus = s.indexOf("+");
  if (plus >= 0) s = s.slice(0, plus);
  const dash = s.indexOf("-");
  if (dash >= 0) s = s.slice(0, dash);
  return s.trim();
}

function parseSemver(raw) {
  const s = stripVersionNoise(raw);
  const parts = s.split(".").map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareSemver(a, b) {
  const A = parseSemver(a);
  const B = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] - B[i];
  }
  return 0;
}

/**
 * Fetch JSON via Electron net (uses Chromium network stack / system proxy).
 * @param {string} url
 * @param {number} [timeoutMs]
 */
function netFetchJson(url, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "GET",
      url,
      redirect: "follow",
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        request.abort();
      } catch {
        /* ignore */
      }
      reject(new Error("update check timed out"));
    }, timeoutMs);

    request.setHeader("Accept", "application/vnd.github+json");
    request.setHeader("User-Agent", `HFQ-Code/${app.getVersion() || "desktop"}`);
    request.setHeader("X-GitHub-Api-Version", "2022-11-28");

    request.on("response", (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const body = Buffer.concat(chunks).toString("utf8");
        const status = response.statusCode || 0;
        if (status === 404) {
          resolve({ status, json: null, body });
          return;
        }
        if (status < 200 || status >= 300) {
          reject(new Error(`GitHub API HTTP ${status}`));
          return;
        }
        try {
          resolve({ status, json: JSON.parse(body), body });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
      response.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
    request.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    request.end();
  });
}

/**
 * Query GitHub Releases latest. Manual channel only — never downloads installers.
 * @param {{ force?: boolean, silent?: boolean }} [opts]
 */
async function checkForUpdates(opts = {}) {
  const force = Boolean(opts.force);
  const currentVersion = app.getVersion() || "0.0.0";
  const checkedAt = new Date().toISOString();
  let cfg = null;
  try {
    cfg = await readConfig();
  } catch {
    /* ignore */
  }

  const updateSource =
    cfg?.prefs?.updateSource === "direct" ? "direct" : "ghproxy";
  const updateProxyBase = normalizeGhproxyBase(cfg?.prefs?.updateProxyBase);
  const endpoint = resolveUpdateApiUrl({
    source: updateSource,
    proxyBase: updateProxyBase,
  });

  if (!force && cfg?.prefs?.lastUpdateCheckAt) {
    const last = Date.parse(cfg.prefs.lastUpdateCheckAt);
    if (Number.isFinite(last) && Date.now() - last < UPDATE_CHECK_MIN_INTERVAL_MS) {
      return {
        ok: true,
        skipped: true,
        reason: "throttled",
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        releaseUrl: UPDATE_RELEASES_URL,
        releaseNotes: null,
        publishedAt: null,
        assets: [],
        checkedAt: cfg.prefs.lastUpdateCheckAt,
        source: endpoint.source,
        proxyBase: endpoint.proxyBase,
        apiUrl: endpoint.url,
      };
    }
  }

  try {
    const { status, json } = await netFetchJson(endpoint.url);
    if (status === 404 || !json) {
      const result = {
        ok: true,
        skipped: false,
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        releaseUrl: UPDATE_RELEASES_URL,
        releaseNotes: null,
        publishedAt: null,
        assets: [],
        checkedAt,
        message: "暂无已发布的 Release",
        source: endpoint.source,
        proxyBase: endpoint.proxyBase,
        apiUrl: endpoint.url,
      };
      await persistUpdateCheckStamp(checkedAt).catch(() => {});
      return result;
    }

    const tag = String(json.tag_name || json.name || "").trim();
    const latestVersion = stripVersionNoise(tag);
    const updateAvailable =
      Boolean(latestVersion) && compareSemver(latestVersion, currentVersion) > 0;
    const assets = Array.isArray(json.assets)
      ? json.assets
          .filter((a) => a && a.browser_download_url)
          .map((a) => {
            const direct = String(a.browser_download_url);
            // When using ghproxy for API, also surface mirrored download URLs for convenience.
            const mirrored =
              endpoint.source === "ghproxy" && endpoint.proxyBase
                ? `${endpoint.proxyBase}${direct}`
                : direct;
            return {
              name: String(a.name || ""),
              url: direct,
              mirrorUrl: mirrored !== direct ? mirrored : undefined,
              size: Number(a.size) || 0,
              contentType: a.content_type ? String(a.content_type) : "",
            };
          })
      : [];
    const releaseUrl = String(json.html_url || UPDATE_RELEASES_URL);
    const releaseNotes = typeof json.body === "string" ? json.body.slice(0, 4000) : null;
    const publishedAt = json.published_at ? String(json.published_at) : null;

    await persistUpdateCheckStamp(checkedAt).catch(() => {});

    return {
      ok: true,
      skipped: false,
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseUrl,
      releaseNotes,
      publishedAt,
      assets,
      checkedAt,
      tagName: tag,
      prerelease: Boolean(json.prerelease),
      draft: Boolean(json.draft),
      source: endpoint.source,
      proxyBase: endpoint.proxyBase,
      apiUrl: endpoint.url,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: UPDATE_RELEASES_URL,
      releaseNotes: null,
      publishedAt: null,
      assets: [],
      checkedAt,
      error: err instanceof Error ? err.message : String(err),
      source: endpoint.source,
      proxyBase: endpoint.proxyBase,
      apiUrl: endpoint.url,
    };
  }
}

async function persistUpdateCheckStamp(checkedAt) {
  try {
    const { configMod } = await loadModules();
    const cfg = await readConfig();
    const next = configMod.withPrefs(cfg, { lastUpdateCheckAt: checkedAt });
    await writeConfig(next);
  } catch {
    /* non-fatal */
  }
}

async function maybeCheckUpdatesOnStartup() {
  try {
    const cfg = await readConfig();
    if (cfg.prefs?.checkUpdatesOnStartup === false) return;
    // Delay so UI can paint; silent — only notify when a newer release exists.
    setTimeout(() => {
      void checkForUpdates({ force: false, silent: true })
        .then((result) => {
          if (result?.updateAvailable && result.latestVersion) {
            broadcast("update:available", result);
          }
        })
        .catch(() => {});
    }, 8_000);
  } catch {
    /* ignore */
  }
}

function createWindow() {
  const icon = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    title: "HFQ Code",
    backgroundColor: "#07090d",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox true needs a sandbox-compatible preload; keep false with isolation.
      sandbox: false,
      // Block renderer from following unexpected navigations.
      webSecurity: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("app:getInfo", async () => {
    let activeProviderId = "mock";
    let activeModel = "mock-hfq";
    try {
      const cfg = await readConfig();
      activeProviderId = cfg.activeProviderId;
      activeModel = cfg.activeModel;
    } catch {
      /* ignore */
    }
    return {
      name: "HFQ Code",
      version: app.getVersion(),
      platform: process.platform,
      workspacePath,
      activeSessionId,
      activeProviderId,
      activeModel,
      bootError: bootError?.message ?? null,
      updateRepo: `${UPDATE_REPO.owner}/${UPDATE_REPO.name}`,
      updateReleasesUrl: UPDATE_RELEASES_URL,
    };
  });

  ipcMain.handle("update:check", async (_evt, payload = {}) => {
    return checkForUpdates({ force: payload?.force !== false });
  });

  ipcMain.handle("update:openRelease", async (_evt, payload = {}) => {
    const raw = String(payload?.url || UPDATE_RELEASES_URL).trim();
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error("invalid release URL");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("only http(s) release URLs allowed");
    }
    const host = url.hostname.toLowerCase();
    if (!UPDATE_OPEN_HOST_ALLOW.has(host)) {
      // Allow custom ghproxy base host from prefs (user may set private mirror).
      let allowedCustom = false;
      try {
        const cfg = await readConfig();
        const base = normalizeGhproxyBase(cfg?.prefs?.updateProxyBase);
        const baseHost = new URL(base).hostname.toLowerCase();
        if (host === baseHost) allowedCustom = true;
      } catch {
        /* ignore */
      }
      if (!allowedCustom) throw new Error("release URL host not allowed");
    }
    // Prefer repo path for github.com
    if (host === "github.com") {
      const allowedPrefix = `/${UPDATE_REPO.owner}/${UPDATE_REPO.name}`.toLowerCase();
      if (!url.pathname.toLowerCase().startsWith(allowedPrefix)) {
        throw new Error("release URL outside HFQ-Code repository");
      }
    }
    // ghproxy.com/https://github.com/... — ensure inner path still points at our repo when present
    if (host !== "github.com" && /github\.com\//i.test(url.href)) {
      const marker = `github.com/${UPDATE_REPO.owner}/${UPDATE_REPO.name}`.toLowerCase();
      if (!url.href.toLowerCase().includes(marker) && !url.href.toLowerCase().includes("api.github.com")) {
        // allow asset mirrors that only embed objects.githubusercontent.com
        if (!/githubusercontent\.com/i.test(url.href)) {
          throw new Error("mirrored URL outside HFQ-Code repository");
        }
      }
    }
    await shell.openExternal(url.toString());
    return { ok: true, url: url.toString() };
  });

  ipcMain.handle("nav:listPages", async () => [
    { id: "home", label: "首页" },
    { id: "chat", label: "会话" },
    { id: "changes", label: "变更" },
    { id: "terminal", label: "终端" },
    { id: "tasks", label: "任务" },
    { id: "skills", label: "技能" },
    { id: "mcp", label: "MCP" },
    { id: "memory", label: "记忆" },
    { id: "usage", label: "用量" },
    { id: "import", label: "导入" },
    { id: "models", label: "模型" },
    { id: "permissions", label: "权限" },
    { id: "audit", label: "审计" },
    { id: "settings", label: "设置" },
  ]);

  async function bindWorkspace(nextPath) {
    workspacePath = path.resolve(nextPath);
    activeSessionId = null;
    try {
      const { configMod } = await loadModules();
      const cfg = await readConfig();
      await writeConfig(configMod.touchRecentWorkspace(cfg, workspacePath));
    } catch (err) {
      console.warn("[HFQ] failed to record recent workspace", err);
    }
    broadcast("workspace:changed", { workspacePath });
    return { ok: true, workspacePath };
  }

  ipcMain.handle("workspace:open", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "打开工作区",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, workspacePath };
    }
    return bindWorkspace(result.filePaths[0]);
  });

  ipcMain.handle("workspace:set", async (_evt, payload = {}) => {
    const next = String(payload.workspacePath || "").trim();
    if (!next) throw new Error("workspacePath required");
    try {
      const st = await fs.stat(next);
      if (!st.isDirectory()) throw new Error("not a directory");
    } catch {
      throw new Error(`工作区不存在或不可访问: ${next}`);
    }
    return bindWorkspace(next);
  });

  ipcMain.handle("workspace:get", async () => ({ workspacePath }));

  ipcMain.handle("shell:openPath", async (_evt, payload = {}) => {
    const target = path.resolve(String(payload.path || "").trim());
    if (!target) throw new Error("path required");
    // Only open paths under known HFQ data roots, shared agents, or active workspace.
    const { agentCore } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    const allowedRoots = [
      dirs.root,
      dirs.skills,
      dirs.memory,
      dirs.sessions,
      dirs.logs,
      path.join(os.homedir(), ".agents"),
      workspacePath,
    ].filter(Boolean);
    const okRoot = allowedRoots.some((root) => {
      const r = path.resolve(root);
      const rel = path.relative(r, target);
      return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    });
    if (!okRoot) {
      throw new Error("path not allowed for openPath (outside HFQ data / workspace)");
    }
    const err = await shell.openPath(target);
    if (err) throw new Error(err);
    return { ok: true };
  });

  ipcMain.handle("workspace:openFile", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    const rel = String(payload.path || "").trim();
    if (!ws) throw new Error("Open a workspace first");
    if (!rel) throw new Error("path required");
    const full = toolsMod.resolveWorkspacePath(ws, rel);
    const err = await shell.openPath(full);
    if (err) throw new Error(err);
    return { ok: true, path: full };
  });

  /** Open workspace-relative file in VS Code / Cursor / system default. */
  ipcMain.handle("workspace:openInEditor", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    const rel = String(payload.path || "").trim();
    if (!ws) throw new Error("Open a workspace first");
    if (!rel) throw new Error("path required");
    const full = toolsMod.resolveWorkspacePath(ws, rel);
    const line = Number(payload.line) > 0 ? Math.floor(Number(payload.line)) : 0;
    const editor = String(payload.editor || "auto").toLowerCase();
    const fileUrl = full.replace(/\\/g, "/");
    const withLine = line > 0 ? `${fileUrl}:${line}` : fileUrl;

    const tryExternal = async (url) => {
      try {
        await shell.openExternal(url);
        return true;
      } catch {
        return false;
      }
    };

    if (editor === "vscode" || editor === "auto") {
      if (await tryExternal(line > 0 ? `vscode://file/${withLine}` : `vscode://file/${fileUrl}`)) {
        return { ok: true, path: full, via: "vscode" };
      }
    }
    if (editor === "cursor" || editor === "auto") {
      if (await tryExternal(line > 0 ? `cursor://file/${withLine}` : `cursor://file/${fileUrl}`)) {
        return { ok: true, path: full, via: "cursor" };
      }
    }
    const err = await shell.openPath(full);
    if (err) throw new Error(err);
    return { ok: true, path: full, via: "system" };
  });

  ipcMain.handle("workspace:readText", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    const rel = String(payload.path || "AGENTS.md").trim() || "AGENTS.md";
    if (!ws) throw new Error("Open a workspace first");
    const full = toolsMod.resolveWorkspacePath(ws, rel);
    try {
      const content = await fs.readFile(full, "utf8");
      return { ok: true, path: rel, content, exists: true };
    } catch (err) {
      if ((err && err.code) === "ENOENT") {
        return { ok: true, path: rel, content: "", exists: false };
      }
      throw err;
    }
  });

  ipcMain.handle("workspace:writeText", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    const rel = String(payload.path || "AGENTS.md").trim() || "AGENTS.md";
    if (!ws) throw new Error("Open a workspace first");
    const content = String(payload.content ?? "");
    if (Buffer.byteLength(content, "utf8") > 1_500_000) {
      throw new Error("file too large (max ~1.5MB)");
    }
    const full = toolsMod.resolveWorkspacePath(ws, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
    return { ok: true, path: rel, bytes: Buffer.byteLength(content, "utf8") };
  });

  /** Run a one-shot shell command in the workspace (Terminal page), not full agent loop. */
  ipcMain.handle("shell:run", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    if (!ws) throw new Error("Open a workspace first");
    const command = String(payload.command || "").trim();
    if (!command) throw new Error("command required");
    const timeoutMs = Math.min(Math.max(Number(payload.timeoutMs) || 60_000, 1000), 300_000);
    const hub = toolsMod.createToolHub();
    const result = await hub.execute("shell", ws, { command, timeoutMs });
    const out = result && typeof result === "object" ? result : { stdout: String(result) };
    return {
      ok: (out.code ?? 0) === 0,
      command,
      code: out.code ?? null,
      stdout: String(out.stdout || ""),
      stderr: String(out.stderr || ""),
      at: new Date().toISOString(),
    };
  });

  ipcMain.handle("config:get", async () => {
    const { configMod } = await loadModules();
    const cfg = await readConfig();
    return configMod.publicConfigView(cfg);
  });

  ipcMain.handle("config:setActive", async (_evt, payload = {}) => {
    const cfg = await readConfig();
    if (payload.providerId) cfg.activeProviderId = String(payload.providerId);
    if (payload.model) cfg.activeModel = String(payload.model);
    await writeConfig(cfg);
    const { configMod } = await loadModules();
    return configMod.publicConfigView(cfg);
  });

  ipcMain.handle("config:upsertProvider", async (_evt, payload = {}) => {
    const { configMod } = await loadModules();
    const cfg = await readConfig();
    const existing = cfg.providers.find((p) => p.id === payload.id);
    const merged = configMod.mergeProviderUpdate(existing, payload);
    const next = configMod.upsertProvider(cfg, merged);
    await writeConfig(next);
    return configMod.publicConfigView(next);
  });

  ipcMain.handle("models:test", async (_evt, payload = {}) => {
    const { providersMod } = await loadModules();
    const cfg = await readConfig();
    const providerId = String(payload.providerId || cfg.activeProviderId || "mock");
    const model = String(payload.model || cfg.activeModel || "mock-hfq");
    const providerCfg =
      cfg.providers.find((p) => p.id === providerId) ||
      cfg.providers.find((p) => p.id === "mock");
    if (!providerCfg) throw new Error("no provider configured");

    const started = Date.now();
    try {
      const provider = providersMod.createProviderFromConfig({
        id: providerCfg.id,
        kind: providerCfg.kind,
        baseURL: providerCfg.baseURL,
        apiKey: providerCfg.apiKey,
      });
      const result = await provider.chat({
        model: model || providerCfg.defaultModel || "mock-hfq",
        messages: [
          {
            role: "system",
            content: "You are a connectivity probe for HFQ Code. Reply with exactly: pong",
          },
          { role: "user", content: "ping" },
        ],
        temperature: 0,
      });
      return {
        ok: true,
        providerId: providerCfg.id,
        model,
        latencyMs: Date.now() - started,
        reply: String(result.message || "").slice(0, 240),
        usage: result.usage || null,
      };
    } catch (err) {
      return {
        ok: false,
        providerId: providerCfg.id,
        model,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("session:create", async (_evt, payload = {}) => {
    const backend = await ensureSessionBackend();
    const ws = payload.workspacePath || workspacePath;
    if (!ws) {
      throw new Error("Open a workspace first");
    }
    workspacePath = ws;

    const resolved = await resolveActiveProvider();
    const MODES = new Set(["confirm_before_change", "auto_edit", "plan", "full_access"]);
    let permissionMode = MODES.has(payload.permissionMode)
      ? payload.permissionMode
      : null;
    let planMode = payload.planMode == null ? null : Boolean(payload.planMode);
    let memoryEnabled;
    let compactMaxChars;
    try {
      const cfg = await readConfig();
      if (!permissionMode) {
        const prefMode = cfg.prefs?.permissionMode;
        if (MODES.has(prefMode)) permissionMode = prefMode;
        else if (cfg.prefs?.planModeDefault) permissionMode = "plan";
        else permissionMode = "confirm_before_change";
      }
      if (planMode == null) planMode = permissionMode === "plan";
      memoryEnabled = cfg.prefs?.memoryEnabled;
      compactMaxChars = cfg.prefs?.compactMaxChars;
    } catch {
      if (!permissionMode) permissionMode = planMode ? "plan" : "confirm_before_change";
      if (planMode == null) planMode = permissionMode === "plan";
    }
    if (permissionMode === "plan") planMode = true;
    else if (planMode && permissionMode === "confirm_before_change" && payload.permissionMode == null) {
      // explicit planMode true without mode still maps to plan
      permissionMode = "plan";
    }
    const createParams = {
      workspacePath: ws,
      model: payload.model || resolved.model,
      title: payload.title,
      planMode: Boolean(planMode),
      permissionMode,
      memoryEnabled,
      compactMaxChars,
    };
    const info =
      backend.kind === "worker"
        ? await backend.host.create({ ...createParams, provider: resolved.providerSpec })
        : await backend.mgr.create({ ...createParams, provider: resolved.provider });
    activeSessionId = info.id;
    let liveMode = permissionMode;
    let livePlan = Boolean(planMode);
    try {
      if (backend.kind === "worker") {
        liveMode = (await backend.host.getPermissionMode(info.id)).permissionMode;
        livePlan = (await backend.host.getPlanMode(info.id)).planMode;
      } else {
        liveMode = backend.mgr.getPermissionMode(info.id);
        livePlan = backend.mgr.getPlanMode(info.id);
      }
    } catch {
      /* ignore */
    }
    return {
      ...info,
      providerId: resolved.providerId,
      planMode: livePlan,
      permissionMode: liveMode,
      sessionBackend: backend.kind,
    };
  });

  ipcMain.handle("session:get", async (_evt, sessionId) => {
    const mgr = await ensureSessionManager();
    const id = sessionId || activeSessionId;
    if (!id) return null;
    return (await mgr.get(id)) ?? null;
  });

  ipcMain.handle("session:list", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const ws = payload.workspacePath || workspacePath || undefined;
    return mgr.listAll(ws || undefined);
  });

  ipcMain.handle("session:open", async (_evt, payload = {}) => {
    const backend = await ensureSessionBackend();
    const sessionId = payload.sessionId;
    if (!sessionId) throw new Error("sessionId required");
    const resolved = await resolveActiveProvider();
    const MODES = new Set(["confirm_before_change", "auto_edit", "plan", "full_access"]);
    let permissionMode = MODES.has(payload.permissionMode) ? payload.permissionMode : null;
    let planMode = payload.planMode == null ? undefined : Boolean(payload.planMode);
    try {
      const cfg = await readConfig();
      if (!permissionMode) {
        const prefMode = cfg.prefs?.permissionMode;
        if (MODES.has(prefMode)) permissionMode = prefMode;
        else if (cfg.prefs?.planModeDefault) permissionMode = "plan";
      }
    } catch {
      /* ignore */
    }
    if (permissionMode === "plan") planMode = true;
    const openParams = {
      sessionId: String(sessionId),
      workspacePath: payload.workspacePath || workspacePath || undefined,
      model: payload.model || resolved.model,
      planMode,
      permissionMode: permissionMode || undefined,
    };
    const snap =
      backend.kind === "worker"
        ? await backend.host.open({ ...openParams, provider: resolved.providerSpec })
        : await backend.mgr.open({ ...openParams, provider: resolved.provider });
    activeSessionId = snap.info.id;
    if (snap.info.workspacePath) {
      workspacePath = snap.info.workspacePath;
      broadcast("workspace:changed", { workspacePath });
    }
    let liveMode = permissionMode || "confirm_before_change";
    let livePlan = Boolean(planMode);
    try {
      if (backend.kind === "worker") {
        liveMode = (await backend.host.getPermissionMode(snap.info.id)).permissionMode;
        livePlan = (await backend.host.getPlanMode(snap.info.id)).planMode;
      } else {
        liveMode = backend.mgr.getPermissionMode(snap.info.id);
        livePlan = backend.mgr.getPlanMode(snap.info.id);
      }
    } catch {
      /* ignore */
    }
    return {
      ...snap,
      info: {
        ...snap.info,
        providerId: resolved.providerId,
        planMode: livePlan,
        permissionMode: liveMode,
      },
      providerId: resolved.providerId,
      planMode: livePlan,
      permissionMode: liveMode,
      sessionBackend: backend.kind,
    };
  });

  ipcMain.handle("session:snapshot", async (_evt, sessionId) => {
    const mgr = await ensureSessionManager();
    const id = sessionId || activeSessionId;
    if (!id) return null;
    return (await mgr.getSnapshot(id)) ?? null;
  });

  ipcMain.handle("session:send", async (_evt, payload) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    const text = String(payload?.text ?? "").trim();
    if (!sessionId) throw new Error("No active session");
    if (!text) throw new Error("Empty message");
    void mgr.send(sessionId, text).catch((err) => {
      broadcast("session:event", {
        type: "session.failed",
        sessionId,
        error: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      });
    });
    return { ok: true, sessionId };
  });

  ipcMain.handle("session:abort", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) return { ok: false, reason: "no_session" };
    const ok = await mgr.abort(sessionId);
    return { ok, sessionId };
  });

  ipcMain.handle("session:delete", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = String(payload?.sessionId || "").trim();
    if (!sessionId) throw new Error("sessionId required");
    const res = await mgr.delete(sessionId);
    if (activeSessionId === sessionId) activeSessionId = null;
    return res;
  });

  ipcMain.handle("session:rename", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = String(payload?.sessionId || "").trim();
    const title = String(payload?.title || "").trim();
    if (!sessionId) throw new Error("sessionId required");
    if (!title) throw new Error("title required");
    const info = await mgr.rename(sessionId, title);
    return { ok: true, info };
  });

  ipcMain.handle("changes:revert", async (_evt, payload = {}) => {
    const { agentCore } = await loadModules();
    const ws = payload.workspacePath || workspacePath;
    if (!ws) throw new Error("Open a workspace first");
    if (!payload.path) throw new Error("path required");
    return agentCore.revertWorkspaceChange({
      workspacePath: ws,
      path: String(payload.path),
      kind: payload.kind,
      before: payload.before,
    });
  });

  ipcMain.handle("changes:writeContent", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = payload.workspacePath || workspacePath;
    if (!ws) throw new Error("Open a workspace first");
    if (!payload.path) throw new Error("path required");
    const content = String(payload.content ?? "");
    const full = toolsMod.resolveWorkspacePath(ws, String(payload.path));
    const pathMod = require("node:path");
    await fs.mkdir(pathMod.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
    return { ok: true, path: String(payload.path), bytes: Buffer.byteLength(content, "utf8") };
  });

  ipcMain.handle("app:paths", async () => {
    const { agentCore, configMod } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    const configPath = path.join(dirs.root, "config.json");
    const credentialsPath =
      typeof configMod.getCredentialsPath === "function"
        ? configMod.getCredentialsPath(configPath)
        : path.join(dirs.root, "credentials.json");
    return {
      ...dirs,
      configPath,
      credentialsPath,
      memoryPath: path.join(dirs.memory || path.join(dirs.root, "memory"), "user", "notes.json"),
      memoryRoot: dirs.memory,
      platform: process.platform,
      homedir: os.homedir(),
      version: app.getVersion() || "1.0.0",
      sessionBackend: sessionBackend || null,
    };
  });

  ipcMain.handle("config:setPrefs", async (_evt, payload = {}) => {
    const { configMod } = await loadModules();
    const cfg = await readConfig();
    const patch = {};
    if (payload.theme === "dark" || payload.theme === "light") patch.theme = payload.theme;
    if (typeof payload.proxyUrl === "string") patch.proxyUrl = payload.proxyUrl.trim();
    if (typeof payload.memoryEnabled === "boolean") patch.memoryEnabled = payload.memoryEnabled;
    if (typeof payload.planModeDefault === "boolean") patch.planModeDefault = payload.planModeDefault;
    const MODES = new Set(["confirm_before_change", "auto_edit", "plan", "full_access"]);
    if (MODES.has(payload.permissionMode)) {
      patch.permissionMode = payload.permissionMode;
      patch.planModeDefault = payload.permissionMode === "plan";
    }
    if (typeof payload.checkUpdatesOnStartup === "boolean") {
      patch.checkUpdatesOnStartup = payload.checkUpdatesOnStartup;
    }
    if (typeof payload.lastUpdateCheckAt === "string") {
      patch.lastUpdateCheckAt = payload.lastUpdateCheckAt;
    }
    if (payload.updateSource === "direct" || payload.updateSource === "ghproxy") {
      patch.updateSource = payload.updateSource;
    }
    if (typeof payload.updateProxyBase === "string") {
      patch.updateProxyBase = payload.updateProxyBase.trim() || DEFAULT_GHPROXY_BASE;
    }
    if (payload.compactMaxChars != null) {
      const n = Number(payload.compactMaxChars);
      if (Number.isFinite(n)) patch.compactMaxChars = Math.max(8_000, Math.min(200_000, Math.floor(n)));
    }
    if (payload.usageInputPerMillion != null) {
      const n = Number(payload.usageInputPerMillion);
      if (Number.isFinite(n)) patch.usageInputPerMillion = Math.max(0, n);
    }
    if (payload.usageOutputPerMillion != null) {
      const n = Number(payload.usageOutputPerMillion);
      if (Number.isFinite(n)) patch.usageOutputPerMillion = Math.max(0, n);
    }
    const next = configMod.withPrefs(cfg, patch);
    await writeConfig(next);
    return configMod.publicConfigView(next);
  });

  ipcMain.handle("session:setPlanMode", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) throw new Error("no active session");
    const ok = await mgr.setPlanMode(sessionId, Boolean(payload.enabled));
    const planMode = await mgr.getPlanMode(sessionId);
    const permissionMode = await mgr.getPermissionMode(sessionId);
    return { ok, sessionId, planMode, permissionMode };
  });

  ipcMain.handle("session:getPlanMode", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) return { sessionId: null, planMode: false, permissionMode: "confirm_before_change" };
    return {
      sessionId,
      planMode: await mgr.getPlanMode(sessionId),
      permissionMode: await mgr.getPermissionMode(sessionId),
    };
  });

  ipcMain.handle("session:setPermissionMode", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) throw new Error("no active session");
    const mode = String(payload?.mode || "confirm_before_change");
    const ok = await mgr.setPermissionMode(sessionId, mode);
    const permissionMode = await mgr.getPermissionMode(sessionId);
    const planMode = await mgr.getPlanMode(sessionId);
    return { ok, sessionId, permissionMode, planMode };
  });

  ipcMain.handle("session:getPermissionMode", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) {
      return { sessionId: null, permissionMode: "confirm_before_change", planMode: false };
    }
    return {
      sessionId,
      permissionMode: await mgr.getPermissionMode(sessionId),
      planMode: await mgr.getPlanMode(sessionId),
    };
  });

  ipcMain.handle("session:listChildren", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) return [];
    return mgr.listChildren(sessionId);
  });

  ipcMain.handle("session:spawnSubagent", async (_evt, payload = {}) => {
    const backend = await ensureSessionBackend();
    const parentSessionId = payload?.sessionId || activeSessionId;
    if (!parentSessionId) throw new Error("no active session");
    const goal = String(payload?.goal || "").trim();
    if (!goal) throw new Error("goal required");
    const profile = ["explore", "edit", "shell"].includes(payload?.profile)
      ? payload.profile
      : "explore";
    if (backend.kind === "worker") {
      const resolved = await resolveActiveProvider();
      return backend.host.spawnSubagent({
        parentSessionId,
        goal,
        profile,
        provider: resolved.providerSpec,
        model: resolved.model,
      });
    }
    return backend.mgr.spawnSubagent({ parentSessionId, goal, profile });
  });

  ipcMain.handle("memory:list", async (_evt, payload = {}) => {
    const { agentCore } = await loadModules();
    const memory = await import("@hfq/memory");
    const dirs = await agentCore.ensureDataDirs();
    const brain = memory.createScopedMemory({
      rootDir: dirs.memory,
      workspacePath: payload.workspacePath || workspacePath || undefined,
    });
    const scope = payload.scope || "all";
    return brain.list(Number(payload.limit) || 100, { scope });
  });

  ipcMain.handle("memory:search", async (_evt, payload = {}) => {
    const { agentCore } = await loadModules();
    const memory = await import("@hfq/memory");
    const dirs = await agentCore.ensureDataDirs();
    const brain = memory.createScopedMemory({
      rootDir: dirs.memory,
      workspacePath: payload.workspacePath || workspacePath || undefined,
    });
    const query = String(payload.query || "").trim();
    if (!query) return [];
    return brain.search(query, Number(payload.limit) || 20, {
      scope: payload.scope || "all",
    });
  });

  ipcMain.handle("memory:upsert", async (_evt, payload = {}) => {
    const { agentCore } = await loadModules();
    const memory = await import("@hfq/memory");
    const dirs = await agentCore.ensureDataDirs();
    const brain = memory.createScopedMemory({
      rootDir: dirs.memory,
      workspacePath: payload.workspacePath || workspacePath || undefined,
    });
    const text = String(payload.text || "").trim();
    if (!text) throw new Error("text required");
    const id = await brain.upsert({
      id: payload.id ? String(payload.id) : undefined,
      text,
      source: payload.source ? String(payload.source) : "user",
      scope: payload.scope === "user" ? "user" : "project",
      pinned: Boolean(payload.pinned),
    });
    return { id, ok: true };
  });

  ipcMain.handle("memory:remove", async (_evt, payload = {}) => {
    const { agentCore } = await loadModules();
    const memory = await import("@hfq/memory");
    const dirs = await agentCore.ensureDataDirs();
    const brain = memory.createScopedMemory({
      rootDir: dirs.memory,
      workspacePath: payload.workspacePath || workspacePath || undefined,
    });
    const id = String(payload.id || "");
    if (!id) throw new Error("id required");
    const ok = await brain.remove(id, payload.scope);
    return { ok, id };
  });

  ipcMain.handle("usage:summary", async () => {
    const { agentCore, configMod } = await loadModules();
    const cfg = await readConfig();
    const inP = Number(cfg.prefs?.usageInputPerMillion) || 0;
    const outP = Number(cfg.prefs?.usageOutputPerMillion) || 0;
    const pricing =
      inP > 0 || outP > 0
        ? { inputPerMillion: inP, outputPerMillion: outP }
        : undefined;
    return agentCore.aggregateUsage({ pricing });
  });

  ipcMain.handle("import:scan", async (_evt, payload = {}) => {
    const { agentCore } = await loadModules();
    return agentCore.scanImportSources({
      workspacePath: payload.workspacePath || workspacePath || undefined,
    });
  });

  ipcMain.handle("import:apply", async (_evt, payload = {}) => {
    const { agentCore } = await loadModules();
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!candidates.length) {
      const scan = await agentCore.scanImportSources({
        workspacePath: payload.workspacePath || workspacePath || undefined,
      });
      return agentCore.applyImport({
        items,
        candidates: scan.candidates,
        workspacePath: payload.workspacePath || workspacePath || undefined,
        conflictDefault: payload.conflictDefault || "skip",
      });
    }
    return agentCore.applyImport({
      items,
      candidates,
      workspacePath: payload.workspacePath || workspacePath || undefined,
      conflictDefault: payload.conflictDefault || "skip",
    });
  });

  ipcMain.handle("diagnostics:export", async () => {
    const { agentCore, configMod } = await loadModules();
    const cfg = await readConfig();
    const publicCfg = configMod.publicConfigView(cfg);
    const bundle = await agentCore.buildDiagnosticsBundle({
      config: publicCfg,
      appVersion: app.getVersion() || "1.0.0",
      workspacePath,
      sessionBackend: sessionBackend || null,
    });
    return bundle;
  });

  ipcMain.handle("permission:resolve", async (_evt, payload) => {
    const mgr = await ensureSessionManager();
    const requestId = payload?.requestId;
    const decision = payload?.decision;
    if (!requestId || !decision) {
      throw new Error("requestId and decision required");
    }
    const ok = await mgr.resolvePermission(requestId, decision);
    return { ok };
  });

  ipcMain.handle("skills:list", async (_evt, payload = {}) => {
    const ws = payload.workspacePath || workspacePath;
    const { agentCore, skillsMod } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    const records = await skillsMod.loadSkills({
      workspacePath: ws || undefined,
      userSkillsDir: dirs.skills,
      sharedAgentsDir: path.join(os.homedir(), ".agents", "skills"),
      bundledDir: bundledSkillsDir(),
    });
    return records.map((s) => ({
      name: s.name,
      description: s.description,
      source: s.source,
      enabled: s.enabled,
      eligible: s.eligible,
      ineligibleReason: s.ineligibleReason,
      dir: s.dir,
    }));
  });

  ipcMain.handle("policy:matrix", async (_evt, payload = {}) => {
    const { policyMod } = await loadModules();
    const sessionId = payload?.sessionId || activeSessionId;
    let sessionAllows = [];
    if (sessionId && (sessionManager || sessionWorker)) {
      try {
        const mgr = await ensureSessionManager();
        sessionAllows = await mgr.listSessionAllows(sessionId);
      } catch {
        sessionAllows = [];
      }
    }
    return {
      matrix: policyMod.defaultPolicyMatrix(sessionAllows),
      sessionAllows,
      sessionId: sessionId || null,
    };
  });

  ipcMain.handle("policy:sessionAllows", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) return { sessionId: null, sessionAllows: [] };
    return { sessionId, sessionAllows: await mgr.listSessionAllows(sessionId) };
  });

  ipcMain.handle("policy:grantSession", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    const toolName = String(payload?.toolName ?? "");
    if (!sessionId) throw new Error("no active session");
    if (!toolName) throw new Error("toolName required");
    const sessionAllows = await mgr.grantSessionAllow(sessionId, toolName);
    return { sessionId, sessionAllows };
  });

  ipcMain.handle("policy:revokeSession", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    const toolName = String(payload?.toolName ?? "");
    if (!sessionId) throw new Error("no active session");
    if (!toolName) throw new Error("toolName required");
    const sessionAllows = await mgr.revokeSessionAllow(sessionId, toolName);
    return { sessionId, sessionAllows };
  });

  ipcMain.handle("mcp:list", async () => {
    const host = await ensureMcpHost();
    const servers = host.listServers();
    const tools = await host.listTools();
    return { servers, tools };
  });

  ipcMain.handle("mcp:setEnabled", async (_evt, payload = {}) => {
    const host = await ensureMcpHost();
    const server = host.setEnabled(String(payload.id ?? ""), Boolean(payload.enabled));
    if (!server) throw new Error("unknown MCP server");
    await persistMcpRegistry(host);
    return server;
  });

  ipcMain.handle("mcp:connect", async (_evt, payload = {}) => {
    const host = await ensureMcpHost();
    return host.connect(String(payload.id ?? ""), {
      cwd: workspacePath || process.cwd(),
    });
  });

  ipcMain.handle("mcp:disconnect", async (_evt, payload = {}) => {
    const host = await ensureMcpHost();
    const server = host.disconnect(String(payload.id ?? ""));
    if (!server) throw new Error("unknown MCP server");
    return server;
  });

  ipcMain.handle("mcp:upsert", async (_evt, payload = {}) => {
    const host = await ensureMcpHost();
    /** @type {Record<string, string> | undefined} */
    let headers;
    if (payload.headers && typeof payload.headers === "object") {
      headers = {};
      for (const [k, v] of Object.entries(payload.headers)) {
        if (k && v != null && String(v).trim()) headers[String(k)] = String(v);
      }
    } else if (payload.authHeader && String(payload.authHeader).trim()) {
      headers = { authorization: String(payload.authHeader).trim() };
    }
    const server = host.upsertServer({
      id: String(payload.id ?? "").trim() || `mcp-${Date.now()}`,
      name: String(payload.name ?? "Custom MCP"),
      transport: payload.transport === "http" ? "http" : "stdio",
      command: payload.command ? String(payload.command) : undefined,
      args: Array.isArray(payload.args)
        ? payload.args.map(String)
        : String(payload.argsText ?? "")
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean),
      url: payload.url ? String(payload.url) : undefined,
      headers,
      enabled: payload.enabled !== false,
      description: payload.description ? String(payload.description) : undefined,
    });
    await persistMcpRegistry(host);
    return server;
  });

  ipcMain.handle("mcp:remove", async (_evt, payload = {}) => {
    const host = await ensureMcpHost();
    const id = String(payload.id ?? "");
    if (!id) throw new Error("id required");
    const ok = host.removeServer(id);
    if (!ok) throw new Error("unknown MCP server");
    await persistMcpRegistry(host);
    return { ok: true, id };
  });

  ipcMain.handle("mcp:ping", async (_evt, payload = {}) => {
    const host = await ensureMcpHost();
    const id = String(payload.id ?? "");
    if (!id) throw new Error("id required");
    const started = Date.now();
    try {
      const server = await host.connect(id, { cwd: workspacePath || process.cwd() });
      return {
        ok: server.status === "connected",
        status: server.status,
        toolCount: server.toolCount,
        lastError: server.lastError,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - started,
      };
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    registerIpc();
    createWindow();
    void maybeCheckUpdatesOnStartup();
    void ensureSessionBackend().catch(() => undefined);
    void readConfig().catch(() => undefined);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    if (sessionWorker) {
      void sessionWorker.shutdown().catch(() => undefined);
      sessionWorker = null;
      sessionBackend = null;
    }
  });
}
