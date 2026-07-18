const { app, BrowserWindow, ipcMain, dialog, shell, net, Menu } = require("electron");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");
const { UpdateDownloader } = require("./update-download.cjs");

/** Public GitHub repo used for release checks (manual download channel). */
const UPDATE_REPO = { owner: "BB0813", name: "HFQ-Code" };
const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPO.owner}/${UPDATE_REPO.name}/releases`;
const UPDATE_API_LATEST = `https://api.github.com/repos/${UPDATE_REPO.owner}/${UPDATE_REPO.name}/releases/latest`;
/** ungh.cc mirrors Releases JSON without api.github.com (good CN fallback). */
const UPDATE_UNGH_LATEST = `https://ungh.cc/repos/${UPDATE_REPO.owner}/${UPDATE_REPO.name}/releases/latest`;
const UPDATE_CHECK_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
/**
 * Default public mirror for CN networks (wraps full https://… URL).
 * Note: ghproxy.com often returns HTML interstitial now — checkForUpdates falls back.
 */
const DEFAULT_GHPROXY_BASE = "https://ghproxy.com/";
/**
 * Extra ghproxy-style bases tried after the user-configured base fails.
 * Each wraps: {base}https://api.github.com/repos/.../releases/latest
 */
const GHPROXY_FALLBACK_BASES = [
  "https://gh-proxy.com/",
  "https://ghfast.top/",
  "https://mirror.ghproxy.com/",
];

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
 * @param {{ source?: string, proxyBase?: string, kind?: string }} [opts]
 */
function resolveUpdateApiUrl(opts = {}) {
  if (opts.kind === "ungh" || opts.source === "ungh") {
    return { url: UPDATE_UNGH_LATEST, source: "ungh", proxyBase: null, kind: "ungh" };
  }
  const source = opts.source === "direct" ? "direct" : "ghproxy";
  if (source === "direct") {
    return { url: UPDATE_API_LATEST, source: "direct", proxyBase: null, kind: "github" };
  }
  const proxyBase = normalizeGhproxyBase(opts.proxyBase);
  return {
    url: `${proxyBase}${UPDATE_API_LATEST}`,
    source: "ghproxy",
    proxyBase,
    kind: "github",
  };
}

/**
 * Ordered endpoints for a check. Primary source first, then resilient fallbacks.
 * @param {{ source: string, proxyBase: string }} prefs
 * @returns {Array<{ url: string, source: string, proxyBase: string | null, kind?: string }>}
 */
function buildUpdateEndpointChain(prefs) {
  const primarySource = prefs.source === "direct" ? "direct" : "ghproxy";
  const userBase = normalizeGhproxyBase(prefs.proxyBase);
  /** @type {Array<{ url: string, source: string, proxyBase: string | null, kind?: string }>} */
  const chain = [];
  const seen = new Set();

  const push = (ep) => {
    if (!ep?.url || seen.has(ep.url)) return;
    seen.add(ep.url);
    chain.push(ep);
  };

  if (primarySource === "direct") {
    push(resolveUpdateApiUrl({ source: "direct" }));
    push(resolveUpdateApiUrl({ kind: "ungh" }));
    // mirrors after ungh for asset mirroring preference when direct rate-limits
    push(resolveUpdateApiUrl({ source: "ghproxy", proxyBase: userBase }));
    for (const base of GHPROXY_FALLBACK_BASES) {
      push(resolveUpdateApiUrl({ source: "ghproxy", proxyBase: base }));
    }
  } else {
    push(resolveUpdateApiUrl({ source: "ghproxy", proxyBase: userBase }));
    for (const base of GHPROXY_FALLBACK_BASES) {
      push(resolveUpdateApiUrl({ source: "ghproxy", proxyBase: base }));
    }
    push(resolveUpdateApiUrl({ kind: "ungh" }));
    push(resolveUpdateApiUrl({ source: "direct" }));
  }
  return chain;
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
  "ungh.cc",
  "ghproxy.com",
  "mirror.ghproxy.com",
  "gh-proxy.com",
  "ghfast.top",
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

/** @type {import('@hfq/pty').PtyHost | null} */
let ptyHost = null;

/** @type {import('@hfq/mcp').McpHost | null} */
let mcpHost = null;
/** Prevent concurrent host bootstrap races. */
let mcpHostPromise = null;

/** @type {InstanceType<typeof UpdateDownloader> | null} */
let updateDownloader = null;

function getUpdatesDir() {
  return path.join(app.getPath("userData"), "updates");
}

function getUpdateDownloader() {
  if (updateDownloader) return updateDownloader;
  updateDownloader = new UpdateDownloader({
    updatesDir: getUpdatesDir(),
    broadcast,
    assertUrl: (url) => {
      // Lightweight allowlist (mirrors UPDATE_OPEN_HOST_ALLOW + githubusercontent subdomains)
      let u;
      try {
        u = new URL(String(url || "").trim());
      } catch {
        throw new Error("invalid download URL");
      }
      if (u.protocol !== "https:") throw new Error("only https download URLs allowed");
      const host = u.hostname.toLowerCase();
      const ok =
        UPDATE_OPEN_HOST_ALLOW.has(host) ||
        host.endsWith(".githubusercontent.com");
      if (!ok) throw new Error(`download host not allowed: ${host}`);
      return u;
    },
    sanitizeName: (name) => {
      let base = String(name || "HFQ-Code-update.exe").trim();
      base = base.replace(/[/\\?%*:|"<>]/g, "_").replace(/\.\.+/g, ".");
      if (!base.toLowerCase().endsWith(".exe")) base = `${base || "HFQ-Code-update"}.exe`;
      if (base.length > 180) base = `${base.slice(0, 160)}.exe`;
      return base;
    },
  });
  return updateDownloader;
}

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function loadModules() {
  const [agentCore, configMod, providersMod, skillsMod, mcpMod, policyMod, toolsMod, ptyMod] =
    await Promise.all([
      import("@hfq/agent-core"),
      import("@hfq/config"),
      import("@hfq/providers"),
      import("@hfq/skills"),
      import("@hfq/mcp"),
      import("@hfq/policy"),
      import("@hfq/tools"),
      import("@hfq/pty"),
    ]);
  return { agentCore, configMod, providersMod, skillsMod, mcpMod, policyMod, toolsMod, ptyMod };
}

async function getPtyHost() {
  if (ptyHost) return ptyHost;
  const { ptyMod } = await loadModules();
  ptyHost = new ptyMod.PtyHost({
    onData: (id, data) => {
      broadcast("pty:data", { id, data });
    },
    onExit: (id, exitCode, signal) => {
      broadcast("pty:exit", { id, exitCode, signal: signal ?? null });
    },
  });
  return ptyHost;
}

function killAllPtys() {
  if (!ptyHost) return;
  try {
    ptyHost.killAll();
  } catch (err) {
    console.warn("[HFQ] pty killAll", err);
  }
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
  let codingProfileAddon = "";
  let codingProfileSkillIds = [];
  let skillMatch = { enabled: true, maxBodies: 2, maxBodyChars: 6_000 };
  let titleModelRole;
  let compressionModelRole;
  let permissionModeFromProfile;
  try {
    const cfg = await readConfig();
    memoryEnabled = cfg.prefs?.memoryEnabled !== false;
    compactMaxChars = cfg.prefs?.compactMaxChars || 48_000;
    skillMatch = {
      enabled: cfg.prefs?.skillMatch?.enabled !== false,
      maxBodies: cfg.prefs?.skillMatch?.maxBodies ?? 2,
      maxBodyChars: cfg.prefs?.skillMatch?.maxBodyChars ?? 6_000,
    };
    const profiles = Array.isArray(cfg.prefs?.codingProfiles) ? cfg.prefs.codingProfiles : [];
    const activeId = String(cfg.prefs?.activeCodingProfileId || "").trim();
    const profile = activeId ? profiles.find((p) => p && p.id === activeId && p.enabled !== false) : null;
    if (profile) {
      codingProfileAddon = String(profile.systemAddon || "").trim();
      codingProfileSkillIds = Array.isArray(profile.skillIds)
        ? profile.skillIds.map((s) => String(s || "").trim()).filter(Boolean)
        : [];
      // Only apply when profile explicitly sets a legal access mode (never invent YOLO).
      const PROFILE_MODES = new Set([
        "confirm_before_change",
        "auto_edit",
        "plan",
        "full_access",
      ]);
      if (PROFILE_MODES.has(profile.permissionMode)) {
        permissionModeFromProfile = profile.permissionMode;
      }
    }
    const { providersMod } = await loadModules();
    const resolveRole = (role) => {
      if (!role || typeof role !== "object") return undefined;
      const model = String(role.model || "").trim();
      const providerId = String(role.providerId || cfg.activeProviderId || "").trim();
      if (!model || !providerId) return undefined;
      const pcfg = (cfg.providers || []).find((p) => p.id === providerId);
      if (!pcfg) return undefined;
      try {
        const providerSpec = {
          id: pcfg.id,
          kind: pcfg.kind,
          baseURL: pcfg.baseURL,
          apiKey: pcfg.apiKey,
        };
        const provider = providersMod.createProviderFromConfig(providerSpec);
        return { provider, providerSpec, model };
      } catch {
        return undefined;
      }
    };
    titleModelRole = resolveRole(cfg.prefs?.modelRoles?.title);
    compressionModelRole = resolveRole(cfg.prefs?.modelRoles?.compression);
  } catch {
    /* defaults */
  }
  return {
    memoryEnabled,
    compactMaxChars,
    codingProfileAddon,
    codingProfileSkillIds,
    skillMatch,
    titleModelRole,
    compressionModelRole,
    permissionModeFromProfile,
  };
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
    setProviderModel(sessionId, provider, model) {
      // Worker needs a serializable providerSpec; accept either live-ish or spec.
      const spec =
        provider && provider.kind
          ? {
              id: provider.id,
              kind: provider.kind,
              baseURL: provider.baseURL,
              apiKey: provider.apiKey,
            }
          : providerSpecFromLive(provider);
      return host.setProviderModel(sessionId, spec, model);
    },
    listChildren(sessionId) {
      return host.listChildren(sessionId);
    },
    listSpawnAttempts(sessionId) {
      return host.listSpawnAttempts(sessionId);
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

/**
 * Resolve the configured active provider.
 * Fail-closed: empty providers / missing active channel never invent mock.
 */
async function resolveActiveProvider() {
  const { providersMod } = await loadModules();
  const cfg = await readConfig();
  const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
  if (!providers.length) {
    // Stable keywords for frontend humanize: "no model provider" / "providers empty"
    throw new Error(
      "No model provider configured (providers empty). Add a channel in Models before chatting or testing.",
    );
  }
  const providerCfg =
    providers.find((p) => p.id === cfg.activeProviderId) ??
    providers.find((p) => p.enabled !== false) ??
    providers[0];
  if (!providerCfg) {
    throw new Error(
      "No model provider configured (providers empty). Add a channel in Models before chatting or testing.",
    );
  }
  const providerSpec = {
    id: providerCfg.id,
    kind: providerCfg.kind,
    baseURL: providerCfg.baseURL,
    apiKey: providerCfg.apiKey,
  };
  const provider = providersMod.createProviderFromConfig(providerSpec);
  const model =
    (cfg.activeModel && String(cfg.activeModel)) ||
    providerCfg.defaultModel ||
    (Array.isArray(providerCfg.models) ? providerCfg.models[0] : "") ||
    "";
  if (!model) {
    throw new Error(
      `Provider "${providerCfg.id}" has no models configured. Add at least one model id.`,
    );
  }
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
 * Human-readable reason when a body is not usable JSON.
 * @param {string} body
 * @param {unknown} [parseErr]
 */
function describeNonJsonBody(body, parseErr) {
  const sample = String(body || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const lower = sample.toLowerCase();
  if (
    lower.startsWith("<!doctype") ||
    lower.startsWith("<html") ||
    lower.includes("<head") ||
    sample.startsWith("<")
  ) {
    return "镜像返回了网页 HTML（不是 GitHub JSON）。常见于 ghproxy.com 失效/拦截，请改用其它基址或等待自动回退";
  }
  if (/rate limit/i.test(sample)) {
    return "API 速率限制";
  }
  const base =
    parseErr instanceof Error ? parseErr.message : parseErr ? String(parseErr) : "invalid JSON";
  return sample ? `${base} · 响应片段: ${sample}` : base;
}

/**
 * Fetch JSON via Electron net (uses Chromium network stack / system proxy).
 * @param {string} url
 * @param {number} [timeoutMs]
 * @param {{ accept?: string }} [opts]
 */
function netFetchJson(url, timeoutMs = 12_000, opts = {}) {
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

    request.setHeader("Accept", opts.accept || "application/vnd.github+json, application/json");
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
          const hint = describeNonJsonBody(body);
          reject(new Error(`HTTP ${status}${hint ? ` · ${hint}` : ""}`));
          return;
        }
        const trimmed = body.trim();
        if (
          trimmed.startsWith("<!DOCTYPE") ||
          trimmed.startsWith("<!doctype") ||
          trimmed.startsWith("<html") ||
          trimmed.startsWith("<HTML")
        ) {
          reject(new Error(describeNonJsonBody(body)));
          return;
        }
        try {
          resolve({ status, json: JSON.parse(body), body });
        } catch (err) {
          reject(new Error(describeNonJsonBody(body, err)));
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
 * Normalize ungh.cc latest release payload into GitHub Releases-like JSON.
 * @param {any} raw
 */
function normalizeUnghReleaseJson(raw) {
  const rel = raw?.release || raw;
  if (!rel || typeof rel !== "object") return null;
  const tag = String(rel.tag || rel.tag_name || rel.name || "").trim();
  if (!tag) return null;
  const assets = Array.isArray(rel.assets)
    ? rel.assets.map((a) => {
        const downloadUrl = String(
          a.downloadUrl || a.browser_download_url || a.url || "",
        );
        let name = String(a.name || a.label || "").trim();
        if (!name && downloadUrl) {
          try {
            const pathPart = new URL(downloadUrl).pathname;
            name = decodeURIComponent(pathPart.split("/").pop() || "");
          } catch {
            name = downloadUrl.split("/").pop() || "";
          }
        }
        // GitHub release assets may use dots for spaces (HFQ.Code-…)
        if (name.startsWith("HFQ.Code-")) {
          name = name.replace(/^HFQ\.Code-/, "HFQ Code-");
        }
        return {
          name,
          browser_download_url: downloadUrl,
          size: Number(a.size) || 0,
          content_type: a.contentType || a.content_type || "",
        };
      })
    : [];
  const body =
    typeof rel.markdown === "string"
      ? rel.markdown
      : typeof rel.body === "string"
        ? rel.body
        : typeof rel.notes === "string"
          ? rel.notes
          : "";
  return {
    tag_name: tag,
    name: rel.name || tag,
    html_url:
      rel.html_url ||
      `https://github.com/${UPDATE_REPO.owner}/${UPDATE_REPO.name}/releases/tag/${encodeURIComponent(tag)}`,
    body,
    published_at: rel.publishedAt || rel.published_at || null,
    prerelease: Boolean(rel.prerelease),
    draft: Boolean(rel.draft),
    assets,
  };
}

/**
 * True if JSON looks like a usable GitHub Releases (or normalized) latest payload.
 * @param {any} json
 */
function isUsableReleaseJson(json) {
  if (!json || typeof json !== "object") return false;
  const tag = String(json.tag_name || json.name || "").trim();
  return Boolean(tag);
}

/**
 * Query GitHub Releases latest. Manual channel only — never downloads installers.
 * @param {{ force?: boolean, silent?: boolean }} [opts]
 */
/**
 * Build a successful update-check result from GitHub Releases JSON.
 * @param {any} json
 * @param {{ currentVersion: string, checkedAt: string, endpoint: { url: string, source: string, proxyBase: string | null }, fallbackUsed?: boolean, primaryError?: string | null }} ctx
 */
function buildUpdateSuccessResult(json, ctx) {
  const currentVersion = ctx.currentVersion;
  const checkedAt = ctx.checkedAt;
  const endpoint = ctx.endpoint;
  if (!json) {
    return {
      ok: true,
      skipped: false,
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: UPDATE_RELEASES_URL,
      releaseNotes: null,
      publishedAt: null,
      assets: [],
      recommendedAsset: null,
      checkedAt,
      message: "暂无已发布的 Release",
      source: endpoint.source,
      proxyBase: endpoint.proxyBase,
      apiUrl: endpoint.url,
      fallbackUsed: Boolean(ctx.fallbackUsed),
      primaryError: ctx.primaryError || null,
    };
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
  // Prefer NSIS x64 for in-app download (D3); portable still listed in assets.
  const recommendedAsset = pickRecommendedUpdateAsset(assets);
  return {
    ok: true,
    skipped: false,
    currentVersion,
    latestVersion,
    updateAvailable,
    releaseUrl: String(json.html_url || UPDATE_RELEASES_URL),
    releaseNotes: typeof json.body === "string" ? json.body.slice(0, 4000) : null,
    publishedAt: json.published_at ? String(json.published_at) : null,
    assets,
    recommendedAsset,
    checkedAt,
    tagName: tag,
    prerelease: Boolean(json.prerelease),
    draft: Boolean(json.draft),
    source: endpoint.source,
    proxyBase: endpoint.proxyBase,
    apiUrl: endpoint.url,
    fallbackUsed: Boolean(ctx.fallbackUsed),
    primaryError: ctx.primaryError || null,
  };
}

/**
 * Pick preferred Windows installer from release assets (NSIS over portable).
 * @param {Array<{ name?: string, url?: string, mirrorUrl?: string, size?: number }>} assets
 */
function pickRecommendedUpdateAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  let best = null;
  let bestScore = -1;
  for (const a of list) {
    if (!a?.url && !a?.mirrorUrl) continue;
    const n = String(a.name || "").toLowerCase();
    if (!n.endsWith(".exe")) continue;
    if (n.endsWith(".blockmap")) continue;
    let score = 50;
    if (n.includes("portable")) score = 40;
    if (n.includes("setup") || n.includes("nsis") || n.includes("-x64")) score = 100;
    if (n.includes("hfq") && n.includes("code") && !n.includes("portable")) score = Math.max(score, 90);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

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
  const preferred = resolveUpdateApiUrl({
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
        source: preferred.source,
        proxyBase: preferred.proxyBase,
        apiUrl: preferred.url,
        fallbackUsed: false,
        primaryError: null,
      };
    }
  }

  const chain = buildUpdateEndpointChain({
    source: updateSource,
    proxyBase: updateProxyBase,
  });
  /** @type {string[]} */
  const errors = [];
  let primaryError = null;

  for (let i = 0; i < chain.length; i++) {
    const endpoint = chain[i];
    try {
      const timeout = endpoint.source === "direct" || endpoint.source === "ungh" ? 15_000 : 12_000;
      const accept =
        endpoint.source === "ungh" ? "application/json" : "application/vnd.github+json, application/json";
      const { status, json: rawJson } = await netFetchJson(endpoint.url, timeout, { accept });
      let json = rawJson;
      if (endpoint.source === "ungh" || endpoint.kind === "ungh") {
        json = normalizeUnghReleaseJson(rawJson);
      }
      if (status === 404 || !json) {
        // empty release list is success-shaped only for primary github API
        if (i === 0 && endpoint.source !== "ungh") {
          const result = buildUpdateSuccessResult(null, {
            currentVersion,
            checkedAt,
            endpoint,
          });
          await persistUpdateCheckStamp(checkedAt).catch(() => {});
          return result;
        }
        errors.push(`${endpoint.source}: empty/404`);
        if (!primaryError) primaryError = `${endpoint.source}: empty/404`;
        continue;
      }
      if (!isUsableReleaseJson(json)) {
        const msg = `${endpoint.source}: 响应缺少 tag_name`;
        errors.push(msg);
        if (!primaryError) primaryError = msg;
        continue;
      }
      const result = buildUpdateSuccessResult(json, {
        currentVersion,
        checkedAt,
        endpoint,
        fallbackUsed: i > 0,
        primaryError: i > 0 ? primaryError : null,
      });
      await persistUpdateCheckStamp(checkedAt).catch(() => {});
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${endpoint.source}${endpoint.proxyBase ? `@${endpoint.proxyBase}` : ""}: ${msg}`);
      if (!primaryError) primaryError = msg;
    }
  }

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
    error: `全部更新源失败：${errors.slice(0, 4).join(" → ")}${errors.length > 4 ? " …" : ""}`,
    source: preferred.source,
    proxyBase: preferred.proxyBase,
    apiUrl: preferred.url,
    fallbackUsed: errors.length > 1,
    primaryError,
  };
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
  // Product shell has its own chrome — hide Electron default File/Edit/View menu bar.
  Menu.setApplicationMenu(null);

  const icon = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    title: "HFQ Code",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
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

  // R9: React+Vite bundle under renderer/dist (file://). Dev: ELECTRON_RENDERER_URL=http://localhost:5173
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    const hashRaw = (process.env.ELECTRON_RENDERER_HASH || "").replace(/^#\/?/, "");
    // Dev/screenshot: write one-shot boot route for HashRouter (file:// search is unreliable).
    if (hashRaw) {
      try {
        const bootPath = path.join(app.getPath("userData"), "boot-route.txt");
        fs.writeFileSync(bootPath, hashRaw, "utf8");
      } catch {
        /* ignore */
      }
    }
    mainWindow.loadFile(path.join(__dirname, "..", "renderer", "dist", "index.html"), {
      ...(hashRaw ? { hash: `/${hashRaw}` } : {}),
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("app:getInfo", async () => {
    // Empty string when no providers — never invent mock for UI status chips.
    let activeProviderId = "";
    let activeModel = "";
    try {
      const cfg = await readConfig();
      activeProviderId = cfg.activeProviderId || "";
      activeModel = cfg.activeModel || "";
    } catch {
      /* ignore */
    }
    let packageVersion = app.getVersion();
    try {
      // When launched via `electron electron/main.cjs`, app.getVersion() can
      // report the Electron runtime version — prefer package.json product version.
      const pkg = require(path.join(__dirname, "..", "package.json"));
      if (pkg?.version) packageVersion = String(pkg.version);
    } catch {
      /* ignore */
    }
    let bootRoute = null;
    try {
      const bootPath = path.join(app.getPath("userData"), "boot-route.txt");
      if (fs.existsSync(bootPath)) {
        bootRoute = fs.readFileSync(bootPath, "utf8").trim() || null;
        fs.unlinkSync(bootPath);
      }
    } catch {
      /* ignore */
    }
    return {
      name: "HFQ Code",
      version: packageVersion,
      platform: process.platform,
      workspacePath,
      activeSessionId,
      activeProviderId,
      activeModel,
      bootError: bootError?.message ?? null,
      bootRoute,
      updateRepo: `${UPDATE_REPO.owner}/${UPDATE_REPO.name}`,
      updateReleasesUrl: UPDATE_RELEASES_URL,
    };
  });

  ipcMain.handle("update:check", async (_evt, payload = {}) => {
    return checkForUpdates({ force: payload?.force !== false });
  });

  /**
   * D3: download installer to %APPDATA%/HFQ-Code/updates (user-initiated, not silent).
   * payload: { url?, fileName?, expectedSize?, preferMirror?, preferPortable?, assetName? }
   * If url omitted, re-checks releases and picks recommendedAsset.
   */
  ipcMain.handle("update:download", async (_evt, payload = {}) => {
    let url = String(payload?.url || "").trim();
    let fileName = payload?.fileName ? String(payload.fileName) : "";
    let expectedSize = Number(payload?.expectedSize) || 0;

    if (!url) {
      const check = await checkForUpdates({ force: true });
      if (!check?.ok) {
        throw new Error(check?.error || "update check failed");
      }
      if (!check.updateAvailable) {
        throw new Error("当前已是最新版本，无需下载");
      }
      let asset = check.recommendedAsset || null;
      if (payload?.assetName && Array.isArray(check.assets)) {
        const want = String(payload.assetName);
        asset = check.assets.find((a) => a.name === want) || asset;
      }
      if (payload?.preferPortable && Array.isArray(check.assets)) {
        const port = check.assets.find((a) => /portable/i.test(String(a.name || "")));
        if (port) asset = port;
      }
      if (!asset) throw new Error("Release 中没有可下载的 .exe 安装包");
      const preferMirror = payload?.preferMirror !== false;
      url =
        preferMirror && asset.mirrorUrl
          ? String(asset.mirrorUrl)
          : String(asset.url || asset.mirrorUrl || "");
      fileName = fileName || String(asset.name || "");
      expectedSize = expectedSize || Number(asset.size) || 0;
    }

    const downloader = getUpdateDownloader();
    return downloader.start({
      url,
      fileName: fileName || undefined,
      expectedSize: expectedSize || undefined,
    });
  });

  ipcMain.handle("update:downloadCancel", async () => {
    return getUpdateDownloader().cancel();
  });

  ipcMain.handle("update:downloadStatus", async () => {
    return getUpdateDownloader().getState();
  });

  /**
   * Open downloaded installer after explicit user confirm (no silent install).
   * payload: { filePath?, confirm?: boolean, autoDownload?: boolean }
   * - confirm=false skips dialog (UI already confirmed)
   * - autoDownload!==false: if no local installer, download recommended asset then open
   */
  ipcMain.handle("update:install", async (_evt, payload = {}) => {
    const downloader = getUpdateDownloader();
    let filePath = String(payload?.filePath || "").trim();

    if (!filePath) {
      filePath = (await downloader.resolveInstallerPath()) || "";
    }

    const allowAutoDl = payload?.autoDownload !== false;
    if (!filePath && allowAutoDl) {
      // Convenience: 安装更新 without prior 下载更新 still works (check → download → open).
      if (downloader.getState().status === "downloading") {
        throw new Error("正在下载安装包，请稍候完成后再安装");
      }
      try {
        const check = await checkForUpdates({ force: true });
        if (!check?.ok) {
          throw new Error(check?.error || "检查更新失败");
        }
        if (!check.updateAvailable) {
          throw new Error("当前已是最新版本，无需安装");
        }
        let asset = check.recommendedAsset || null;
        if (payload?.preferPortable && Array.isArray(check.assets)) {
          const port = check.assets.find((a) => /portable/i.test(String(a.name || "")));
          if (port) asset = port;
        }
        if (!asset) throw new Error("Release 中没有可下载的 .exe 安装包");
        const preferMirror = payload?.preferMirror !== false;
        const url =
          preferMirror && asset.mirrorUrl
            ? String(asset.mirrorUrl)
            : String(asset.url || asset.mirrorUrl || "");
        const dl = await downloader.start({
          url,
          fileName: String(asset.name || ""),
          expectedSize: Number(asset.size) || undefined,
        });
        filePath = String(dl?.filePath || (await downloader.resolveInstallerPath()) || "");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/download already|正在下载/.test(msg)) throw e;
        throw new Error(
          msg.includes("无需") || msg.includes("没有可下载") || msg.includes("检查更新")
            ? msg
            : `自动下载安装包失败：${msg}。请先点「下载更新」`,
        );
      }
    }

    if (!filePath) {
      throw new Error("尚未下载安装包，请先点「下载更新」");
    }
    filePath = path.resolve(filePath);
    const updatesRoot = path.resolve(getUpdatesDir());
    const rel = path.relative(updatesRoot, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error("安装包路径不在 updates 目录内");
    }
    if (!filePath.toLowerCase().endsWith(".exe")) {
      throw new Error("安装包必须是 .exe 文件");
    }
    try {
      await fs.access(filePath);
    } catch {
      throw new Error("安装包文件已丢失，请重新「下载更新」");
    }

    const skipDialog = payload?.confirm === false;
    if (!skipDialog) {
      const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
      const box = await dialog.showMessageBox(win || undefined, {
        type: "info",
        buttons: ["运行安装程序", "取消"],
        defaultId: 0,
        cancelId: 1,
        title: "安装更新",
        message: "即将打开 HFQ Code 安装程序",
        detail:
          "安装包由发布者 HFQ-ClodBreeze 签名（自签）；首次可能需信任，Windows SmartScreen 仍可能提示。\n" +
          "请按安装向导完成升级；完成后可关闭本窗口。\n\n" +
          filePath,
      });
      if (box.response !== 0) {
        return { ok: false, cancelled: true, filePath };
      }
    }

    const err = await shell.openPath(filePath);
    if (err) throw new Error(err);
    return {
      ok: true,
      filePath,
      /** UI may offer quit; we do not force-quit. */
      quitSuggested: true,
    };
  });

  ipcMain.handle("update:clearDownloads", async () => {
    const dir = getUpdatesDir();
    try {
      const entries = await fs.readdir(dir).catch(() => []);
      for (const name of entries) {
        await fs.rm(path.join(dir, name), { force: true, recursive: true }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    if (updateDownloader && updateDownloader.getState().status !== "downloading") {
      updateDownloader.state = {
        status: "idle",
        url: null,
        fileName: null,
        filePath: null,
        bytesReceived: 0,
        bytesTotal: null,
        percent: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        sha256: null,
      };
    }
    return { ok: true, dir };
  });

  /** User-initiated https link open (skill homepage, docs). */
  ipcMain.handle("shell:openExternal", async (_evt, payload = {}) => {
    const raw = String(payload?.url || "").trim();
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error("invalid URL");
    }
    if (url.protocol !== "https:") throw new Error("only https URLs allowed");
    await shell.openExternal(url.toString());
    return { ok: true, url: url.toString() };
  });

  /**
   * Reveal a file/folder in the OS file manager.
   * - path absolute under data dirs or workspace (sandbox)
   * - or relative to bound workspace
   */
  ipcMain.handle("shell:revealInFolder", async (_evt, payload = {}) => {
    const { agentCore, toolsMod } = await loadModules();
    const raw = String(payload?.path || "").trim();
    if (!raw) throw new Error("path required");
    const dirs = await agentCore.ensureDataDirs();
    const dataRoot = path.resolve(dirs.root);
    let target = path.isAbsolute(raw) ? path.resolve(raw) : null;
    if (!target && workspacePath) {
      target = toolsMod.resolveWorkspacePath(workspacePath, raw);
    }
    if (!target) throw new Error("path required (absolute or workspace-relative)");
    const norm = path.resolve(target);
    const underData =
      norm === dataRoot || norm.startsWith(dataRoot + path.sep);
    let underWs = false;
    if (workspacePath) {
      const ws = path.resolve(workspacePath);
      underWs = norm === ws || norm.startsWith(ws + path.sep);
    }
    if (!underData && !underWs) {
      throw new Error("path outside workspace and app data");
    }
    shell.showItemInFolder(norm);
    return { ok: true, path: norm };
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
    { id: "files", label: "文件" },
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
    // Workspace switch: tear down interactive shells bound to previous root.
    killAllPtys();
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

  /**
   * List a single directory under the bound workspace (Files page / explorer).
   * Shallow only — UI expands folders on demand. Paths are workspace-relative POSIX.
   */
  ipcMain.handle("workspace:listDir", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    if (!ws) throw new Error("Open a workspace first");
    const raw = String(payload.path ?? ".").trim() || ".";
    const rel = raw === "/" || raw === "\\" ? "." : raw.replace(/\\/g, "/").replace(/^\.?\//, "") || ".";
    const full = toolsMod.resolveWorkspacePath(ws, rel === "." ? "." : rel);
    let st;
    try {
      st = await fs.stat(full);
    } catch (err) {
      if ((err && err.code) === "ENOENT") {
        return { ok: false, path: rel, error: "not found", entries: [] };
      }
      throw err;
    }
    if (!st.isDirectory()) {
      return { ok: false, path: rel, error: "not a directory", entries: [] };
    }
    const dirents = await fs.readdir(full, { withFileTypes: true });
    const entries = [];
    for (const d of dirents) {
      const name = d.name;
      if (!name || name === "." || name === "..") continue;
      // Soft-hide heavy / secret dirs at root listing only
      const childRel = rel === "." ? name : `${rel.replace(/\/$/, "")}/${name}`;
      let type = "other";
      if (d.isDirectory()) type = "dir";
      else if (d.isFile()) type = "file";
      else if (d.isSymbolicLink()) type = "symlink";
      let size = 0;
      let mtimeMs = 0;
      try {
        const cst = await fs.stat(path.join(full, name));
        size = cst.isFile() ? cst.size : 0;
        mtimeMs = cst.mtimeMs || 0;
      } catch {
        /* ignore broken links */
      }
      entries.push({
        name,
        path: childRel.split(path.sep).join("/"),
        type,
        size,
        mtimeMs,
      });
    }
    entries.sort((a, b) => {
      if (a.type === "dir" && b.type !== "dir") return -1;
      if (a.type !== "dir" && b.type === "dir") return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    return { ok: true, path: rel === "." ? "." : rel, entries };
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

  /**
   * System file picker constrained to the bound workspace (composer attach / open).
   * Returns workspace-relative POSIX paths only — rejects escapes.
   */
  ipcMain.handle("workspace:pickFiles", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    if (!ws) throw new Error("Open a workspace first");
    const multi = payload.multi !== false;
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: multi ? "选择工作区文件" : "选择工作区文件",
      defaultPath: ws,
      properties: multi
        ? ["openFile", "multiSelections"]
        : ["openFile"],
    });
    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, cancelled: true, paths: [] };
    }
    const paths = [];
    const rejected = [];
    for (const abs of result.filePaths) {
      try {
        const full = path.resolve(abs);
        const rel = path.relative(ws, full);
        if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
          rejected.push(abs);
          continue;
        }
        // Also validate via tools sandbox
        toolsMod.resolveWorkspacePath(ws, rel);
        paths.push(rel.split(path.sep).join("/"));
      } catch {
        rejected.push(abs);
      }
    }
    return {
      ok: paths.length > 0,
      cancelled: false,
      paths,
      rejected: rejected.length ? rejected : undefined,
    };
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

  /** Interactive PTY (1.1). Renderer/xterm is a separate frontend track. */
  ipcMain.handle("pty:create", async (_evt, payload = {}) => {
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    if (!ws) throw new Error("Open a workspace first");
    const host = await getPtyHost();
    let shellPref = payload.shell ?? null;
    if (shellPref == null || String(shellPref).trim() === "") {
      try {
        const cfg = await readConfig();
        const t = cfg?.prefs?.terminalShell;
        if (t === "powershell" || t === "pwsh" || t === "cmd") shellPref = t;
      } catch {
        /* ignore */
      }
    }
    return host.create({
      workspaceRoot: ws,
      cwd: payload.cwd ?? null,
      shell: shellPref,
      cols: payload.cols,
      rows: payload.rows,
      label: payload.label ?? payload.sessionId ?? null,
    });
  });

  ipcMain.handle("pty:write", async (_evt, payload = {}) => {
    const id = String(payload.id || "").trim();
    if (!id) throw new Error("id required");
    const host = await getPtyHost();
    return host.write(id, String(payload.data ?? ""));
  });

  ipcMain.handle("pty:resize", async (_evt, payload = {}) => {
    const id = String(payload.id || "").trim();
    if (!id) throw new Error("id required");
    const host = await getPtyHost();
    return host.resize(id, payload.cols, payload.rows);
  });

  ipcMain.handle("pty:kill", async (_evt, payload = {}) => {
    const id = String(payload.id || "").trim();
    if (!id) throw new Error("id required");
    const host = await getPtyHost();
    return host.kill(id);
  });

  ipcMain.handle("pty:list", async () => {
    if (!ptyHost) return [];
    return ptyHost.list();
  });

  /** Available interactive shells for Terminal settings / picker. */
  ipcMain.handle("pty:shells", async () => {
    const { ptyMod } = await loadModules();
    const shells =
      typeof ptyMod.listAvailableShells === "function" ? ptyMod.listAvailableShells() : [];
    let preferred = "";
    try {
      const cfg = await readConfig();
      const t = cfg?.prefs?.terminalShell;
      if (t === "powershell" || t === "pwsh" || t === "cmd") preferred = t;
    } catch {
      /* ignore */
    }
    return { shells, preferred };
  });

  ipcMain.handle("config:get", async () => {
    const { configMod } = await loadModules();
    const cfg = await readConfig();
    return configMod.publicConfigView(cfg);
  });

  ipcMain.handle("config:setActive", async (_evt, payload = {}) => {
    const { configMod } = await loadModules();
    const cfg = await readConfig();
    const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
    if (!providers.length) {
      throw new Error(
        "No model provider configured (providers empty). Add a channel in Models before selecting a model.",
      );
    }

    const nextProviderId = payload.providerId
      ? String(payload.providerId).trim()
      : cfg.activeProviderId;
    const nextModel = payload.model != null ? String(payload.model).trim() : cfg.activeModel;

    if (payload.providerId) {
      const found = providers.find((p) => p.id === nextProviderId);
      if (!found) {
        throw new Error(`provider not found: ${nextProviderId}`);
      }
      cfg.activeProviderId = found.id;
      if (payload.model == null || payload.model === "") {
        cfg.activeModel =
          found.defaultModel ||
          (Array.isArray(found.models) ? found.models[0] : "") ||
          "";
      }
    }
    if (payload.model != null && String(payload.model).trim()) {
      const active =
        providers.find((p) => p.id === cfg.activeProviderId) ||
        providers.find((p) => p.id === nextProviderId);
      if (!active) {
        throw new Error(`provider not found: ${cfg.activeProviderId || nextProviderId}`);
      }
      const models = Array.isArray(active.models) ? active.models : [];
      if (models.length && !models.includes(nextModel) && nextModel !== active.defaultModel) {
        // Allow selecting a remote-listed model not yet saved into config.models
        // (Models UI may call setActive after models:list without upserting).
        cfg.activeModel = nextModel;
        if (!models.includes(nextModel)) {
          active.models = [...models, nextModel];
        }
      } else {
        cfg.activeModel = nextModel;
      }
      cfg.activeProviderId = active.id;
    }

    if (!cfg.activeProviderId || !cfg.activeModel) {
      throw new Error("active provider and model are required");
    }

    await writeConfig(cfg);
    const pub = configMod.publicConfigView(cfg);

    // Hot-apply to the live active session so top-bar switch matches next turn.
    let sessionApplied = null;
    let sessionApplyError = null;
    const sessionId = activeSessionId;
    const applyToSession = payload.applyToSession !== false;
    if (sessionId && applyToSession) {
      try {
        const resolved = await resolveActiveProvider();
        const backend = await ensureSessionBackend();
        if (backend.kind === "worker") {
          sessionApplied = await backend.host.setProviderModel(
            sessionId,
            resolved.providerSpec,
            resolved.model,
          );
        } else if (typeof backend.mgr.setProviderModel === "function") {
          sessionApplied = await backend.mgr.setProviderModel(
            sessionId,
            resolved.provider,
            resolved.model,
          );
        }
      } catch (err) {
        sessionApplyError = err instanceof Error ? err.message : String(err);
        console.warn("[HFQ] setActive session hot-swap skipped:", sessionApplyError);
      }
    }

    return {
      ...pub,
      sessionApplied: sessionApplied
        ? {
            id: sessionApplied.id,
            model: sessionApplied.model,
            providerId:
              sessionApplied.providerId ||
              cfg.activeProviderId ||
              null,
          }
        : null,
      sessionApplyError,
    };
  });

  ipcMain.handle("config:upsertProvider", async (_evt, payload = {}) => {
    const { configMod, providersMod } = await loadModules();
    const cfg = await readConfig();
    const existing = cfg.providers.find((p) => p.id === payload.id);
    const merged = configMod.mergeProviderUpdate(existing, payload);
    // Auto-fix known third-party baseURL pitfalls (e.g. OpenCode /zen → /zen/v1).
    if (
      merged.kind === "openai_compatible" &&
      merged.baseURL &&
      typeof providersMod.normalizeOpenAICompatibleBaseURL === "function"
    ) {
      merged.baseURL = providersMod.normalizeOpenAICompatibleBaseURL(merged.baseURL);
    } else if (merged.baseURL && typeof merged.baseURL === "string") {
      merged.baseURL = merged.baseURL.trim().replace(/\/+$/, "");
    }
    const next = configMod.upsertProvider(cfg, merged);
    await writeConfig(next);
    return configMod.publicConfigView(next);
  });

  /**
   * Remove a provider channel (Models UI).
   * mock and last channel are deletable; empty providers is valid (fail-closed at use).
   */
  ipcMain.handle("config:removeProvider", async (_evt, payload = {}) => {
    const { configMod } = await loadModules();
    const cfg = await readConfig();
    const id = String(payload.id || payload.providerId || "").trim();
    if (!id) throw new Error("provider id required");
    const next = configMod.removeProvider(cfg, id);
    await writeConfig(next);
    return configMod.publicConfigView(next);
  });

  ipcMain.handle("models:test", async (_evt, payload = {}) => {
    const { providersMod } = await loadModules();
    const cfg = await readConfig();
    const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
    if (!providers.length) {
      return {
        ok: false,
        providerId: "",
        model: "",
        latencyMs: 0,
        error: "No model provider configured (providers empty). Add a channel in Models first.",
      };
    }
    const providerId = String(payload.providerId || cfg.activeProviderId || "").trim();
    const providerCfg =
      providers.find((p) => p.id === providerId) ||
      providers.find((p) => p.id === cfg.activeProviderId) ||
      providers.find((p) => p.enabled !== false) ||
      providers[0];
    if (!providerCfg) {
      return {
        ok: false,
        providerId: providerId || "",
        model: String(payload.model || cfg.activeModel || ""),
        latencyMs: 0,
        error: "provider not found",
      };
    }
    const model = String(
      payload.model ||
        cfg.activeModel ||
        providerCfg.defaultModel ||
        (Array.isArray(providerCfg.models) ? providerCfg.models[0] : "") ||
        "",
    ).trim();
    if (!model) {
      return {
        ok: false,
        providerId: providerCfg.id,
        model: "",
        latencyMs: 0,
        error: `Provider "${providerCfg.id}" has no models configured`,
      };
    }

    const started = Date.now();
    try {
      const provider = providersMod.createProviderFromConfig({
        id: providerCfg.id,
        kind: providerCfg.kind,
        baseURL: providerCfg.baseURL,
        apiKey: providerCfg.apiKey,
      });
      const result = await provider.chat({
        model,
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

  /**
   * List models for a provider.
   * Workbench source of truth remains config.models; remote list is soft-fallback.
   * Soft result shape: { ok, providerId, source, models, error?, warning?, rawCount? }
   */
  ipcMain.handle("models:list", async (_evt, payload = {}) => {
    const { providersMod } = await loadModules();
    const cfg = await readConfig();
    const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
    if (!providers.length) {
      return {
        ok: false,
        providerId: "",
        source: "config",
        models: [],
        error: "No model provider configured (providers empty)",
      };
    }
    const providerId = String(
      payload.providerId || payload.id || cfg.activeProviderId || "",
    ).trim();
    const providerCfg =
      providers.find((p) => p.id === providerId) ||
      providers.find((p) => p.id === cfg.activeProviderId) ||
      providers.find((p) => p.enabled !== false) ||
      providers[0];
    if (!providerCfg) {
      return {
        ok: false,
        providerId: providerId || "",
        source: "config",
        models: [],
        error: "provider not found",
      };
    }
    if (typeof providersMod.listProviderModels !== "function") {
      const models = Array.isArray(providerCfg.models) ? [...providerCfg.models] : [];
      return {
        ok: models.length > 0,
        providerId: providerCfg.id,
        source: "config",
        models,
        warning: "listProviderModels unavailable; using config.models",
      };
    }
    return providersMod.listProviderModels({
      id: providerCfg.id,
      kind: providerCfg.kind,
      baseURL: providerCfg.baseURL,
      apiKey: providerCfg.apiKey,
      models: providerCfg.models,
      defaultModel: providerCfg.defaultModel,
    });
  });

  ipcMain.handle("session:create", async (_evt, payload = {}) => {
    const backend = await ensureSessionBackend();
    const ws = payload.workspacePath || workspacePath;
    if (!ws) {
      throw new Error("Open a workspace first");
    }
    workspacePath = ws;

    const resolved = await resolveActiveProvider();
    const prefs = await sessionPrefs();
    const MODES = new Set(["confirm_before_change", "auto_edit", "plan", "full_access"]);
    let permissionMode = MODES.has(payload.permissionMode)
      ? payload.permissionMode
      : null;
    let planMode = payload.planMode == null ? null : Boolean(payload.planMode);
    let memoryEnabled = prefs.memoryEnabled;
    let compactMaxChars = prefs.compactMaxChars;
    try {
      const cfg = await readConfig();
      if (!permissionMode) {
        // Coding profile may override default access mode when creating a session.
        const fromProfile = prefs.permissionModeFromProfile;
        const prefMode = fromProfile || cfg.prefs?.permissionMode;
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
      codingProfileAddon: prefs.codingProfileAddon,
      codingProfileSkillIds: prefs.codingProfileSkillIds,
      skillMatch: prefs.skillMatch,
    };
    const info =
      backend.kind === "worker"
        ? await backend.host.create({
            ...createParams,
            provider: resolved.providerSpec,
            titleModelRole: prefs.titleModelRole
              ? { provider: prefs.titleModelRole.providerSpec, model: prefs.titleModelRole.model }
              : undefined,
            compressionModelRole: prefs.compressionModelRole
              ? {
                  provider: prefs.compressionModelRole.providerSpec,
                  model: prefs.compressionModelRole.model,
                }
              : undefined,
          })
        : await backend.mgr.create({
            ...createParams,
            provider: resolved.provider,
            titleModelRole: prefs.titleModelRole
              ? { provider: prefs.titleModelRole.provider, model: prefs.titleModelRole.model }
              : undefined,
            compressionModelRole: prefs.compressionModelRole
              ? {
                  provider: prefs.compressionModelRole.provider,
                  model: prefs.compressionModelRole.model,
                }
              : undefined,
          });
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
    // Default: rebind live/resume session to current global active provider/model.
    // Pass payload.rebindToActive=false to keep frozen session model (rare).
    const rebindToActive = payload.rebindToActive !== false;
    let resolved = null;
    let openModel = payload.model ? String(payload.model) : undefined;
    let openProvider = undefined;
    let openProviderSpec = undefined;
    let providerId = undefined;
    if (rebindToActive || !openModel) {
      try {
        resolved = await resolveActiveProvider();
        openModel = openModel || resolved.model;
        openProvider = resolved.provider;
        openProviderSpec = resolved.providerSpec;
        providerId = resolved.providerId;
      } catch (err) {
        // Empty providers: still allow open for transcript viewing, but send will fail-closed.
        if (!openModel) {
          throw err;
        }
      }
    }
    const MODES = new Set(["confirm_before_change", "auto_edit", "plan", "full_access"]);
    let permissionMode = MODES.has(payload.permissionMode) ? payload.permissionMode : null;
    let planMode = payload.planMode == null ? undefined : Boolean(payload.planMode);
    const prefs = await sessionPrefs();
    try {
      const cfg = await readConfig();
      if (!permissionMode) {
        // Align with session:create: explicit payload > active profile > prefs.
        // Profile only applies when it set a legal permissionMode (sessionPrefs validates).
        const fromProfile = prefs.permissionModeFromProfile;
        const prefMode = fromProfile || cfg.prefs?.permissionMode;
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
      model: openModel,
      planMode,
      permissionMode: permissionMode || undefined,
      memoryEnabled: prefs.memoryEnabled,
      compactMaxChars: prefs.compactMaxChars,
      codingProfileAddon: prefs.codingProfileAddon,
      codingProfileSkillIds: prefs.codingProfileSkillIds,
      skillMatch: prefs.skillMatch,
    };
    const snap =
      backend.kind === "worker"
        ? await backend.host.open({
            ...openParams,
            provider: openProviderSpec || (resolved && resolved.providerSpec),
            titleModelRole: prefs.titleModelRole
              ? { provider: prefs.titleModelRole.providerSpec, model: prefs.titleModelRole.model }
              : undefined,
            compressionModelRole: prefs.compressionModelRole
              ? {
                  provider: prefs.compressionModelRole.providerSpec,
                  model: prefs.compressionModelRole.model,
                }
              : undefined,
          })
        : await backend.mgr.open({
            ...openParams,
            provider: openProvider || (resolved && resolved.provider),
            titleModelRole: prefs.titleModelRole
              ? { provider: prefs.titleModelRole.provider, model: prefs.titleModelRole.model }
              : undefined,
            compressionModelRole: prefs.compressionModelRole
              ? {
                  provider: prefs.compressionModelRole.provider,
                  model: prefs.compressionModelRole.model,
                }
              : undefined,
          });
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
    const liveModel = snap.info?.model || openModel || "";
    const liveProviderId = providerId || resolved?.providerId || "";
    return {
      ...snap,
      info: {
        ...snap.info,
        model: liveModel,
        providerId: liveProviderId,
        planMode: livePlan,
        permissionMode: liveMode,
      },
      providerId: liveProviderId,
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
    const backend = await ensureSessionBackend();
    const sessionId = payload?.sessionId || activeSessionId;
    const text = String(payload?.text ?? "").trim();
    if (!sessionId) throw new Error("No active session");
    if (!text) throw new Error("Empty message");

    // Best-effort: re-pin live session to global active before each turn so
    // toolbar model and API/identity stay aligned even if setActive hot-swap was skipped.
    try {
      const resolved = await resolveActiveProvider();
      if (backend.kind === "worker") {
        await backend.host.setProviderModel(
          sessionId,
          resolved.providerSpec,
          resolved.model,
        );
      } else if (typeof backend.mgr.setProviderModel === "function") {
        await backend.mgr.setProviderModel(
          sessionId,
          resolved.provider,
          resolved.model,
        );
      }
    } catch (err) {
      // busy / empty providers / unknown session — send still proceeds with current binding
      console.warn(
        "[HFQ] session:send rebind skipped:",
        err instanceof Error ? err.message : String(err),
      );
    }

    const sendPromise =
      backend.kind === "worker"
        ? backend.host.send(sessionId, text)
        : backend.mgr.send(sessionId, text);
    void sendPromise.catch((err) => {
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

  /** Workspace git for Changes UI (human). Path-sandboxed; no force-push/amend. */
  function requireWorkspaceGit(payload = {}) {
    const ws = String(payload.workspacePath || workspacePath || "").trim();
    if (!ws) throw new Error("Open a workspace first");
    return ws;
  }

  ipcMain.handle("git:status", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = requireWorkspaceGit(payload);
    return toolsMod.gitStatus(ws, {
      path: payload.path,
      includeLog: payload.includeLog,
      maxEntries: payload.maxEntries,
      timeoutMs: payload.timeoutMs,
    });
  });

  ipcMain.handle("git:diff", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = requireWorkspaceGit(payload);
    return toolsMod.gitDiff(ws, {
      path: payload.path,
      staged: payload.staged,
      maxBytes: payload.maxBytes,
      timeoutMs: payload.timeoutMs,
    });
  });

  ipcMain.handle("git:show", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = requireWorkspaceGit(payload);
    return toolsMod.gitShow(ws, {
      object: payload.object,
      path: payload.path,
      maxBytes: payload.maxBytes,
      timeoutMs: payload.timeoutMs,
    });
  });

  ipcMain.handle("git:stage", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = requireWorkspaceGit(payload);
    return toolsMod.gitStage(ws, {
      paths: payload.paths,
      timeoutMs: payload.timeoutMs,
    });
  });

  ipcMain.handle("git:unstage", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = requireWorkspaceGit(payload);
    return toolsMod.gitUnstage(ws, {
      paths: payload.paths,
      timeoutMs: payload.timeoutMs,
    });
  });

  ipcMain.handle("git:commit", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = requireWorkspaceGit(payload);
    return toolsMod.gitCommit(ws, {
      message: payload.message,
      paths: payload.paths,
      timeoutMs: payload.timeoutMs,
    });
  });

  ipcMain.handle("git:log", async (_evt, payload = {}) => {
    const { toolsMod } = await loadModules();
    const ws = requireWorkspaceGit(payload);
    return toolsMod.gitLog(ws, {
      path: payload.path,
      max: payload.max ?? payload.limit,
      timeoutMs: payload.timeoutMs,
    });
  });

  ipcMain.handle("app:paths", async () => {
    const { agentCore, configMod } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    const configPath = path.join(dirs.root, "config.json");
    const credentialsPath =
      typeof configMod.getCredentialsPath === "function"
        ? configMod.getCredentialsPath(configPath)
        : path.join(dirs.root, "credentials.json");
    let credentialsEncoding = "unknown";
    try {
      if (typeof configMod.credentialsDiskEncoding === "function") {
        credentialsEncoding = await configMod.credentialsDiskEncoding(credentialsPath);
      }
    } catch {
      credentialsEncoding = "unknown";
    }
    return {
      ...dirs,
      configPath,
      credentialsPath,
      credentialsEncoding,
      credentialsDpapi:
        typeof configMod.shouldUseDpapi === "function" ? configMod.shouldUseDpapi() : false,
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
    if (payload.terminalShell !== undefined) {
      const s = String(payload.terminalShell || "").trim().toLowerCase();
      if (s === "" || s === "powershell" || s === "pwsh" || s === "cmd") {
        patch.terminalShell = s;
      }
    }
    if (typeof payload.activeCodingProfileId === "string") {
      patch.activeCodingProfileId = payload.activeCodingProfileId.trim();
    }
    if (Array.isArray(payload.codingProfiles)) {
      patch.codingProfiles = payload.codingProfiles;
    }
    if (payload.modelRoles && typeof payload.modelRoles === "object") {
      const roles = {};
      for (const key of ["title", "compression"]) {
        const r = payload.modelRoles[key];
        if (r && typeof r === "object") {
          roles[key] = {
            providerId: r.providerId != null ? String(r.providerId) : undefined,
            model: r.model != null ? String(r.model) : undefined,
          };
        } else if (r === null) {
          roles[key] = undefined;
        }
      }
      patch.modelRoles = {
        ...(cfg.prefs?.modelRoles || {}),
        ...roles,
      };
    }
    if (payload.skillMatch && typeof payload.skillMatch === "object") {
      patch.skillMatch = {
        enabled:
          typeof payload.skillMatch.enabled === "boolean"
            ? payload.skillMatch.enabled
            : cfg.prefs?.skillMatch?.enabled,
        maxBodies:
          payload.skillMatch.maxBodies != null
            ? Number(payload.skillMatch.maxBodies)
            : cfg.prefs?.skillMatch?.maxBodies,
        maxBodyChars:
          payload.skillMatch.maxBodyChars != null
            ? Number(payload.skillMatch.maxBodyChars)
            : cfg.prefs?.skillMatch?.maxBodyChars,
      };
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

  ipcMain.handle("session:listSpawnAttempts", async (_evt, payload = {}) => {
    const mgr = await ensureSessionManager();
    const sessionId = payload?.sessionId || activeSessionId;
    if (!sessionId) return [];
    return mgr.listSpawnAttempts(sessionId);
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

  /** Export usage CSV + JSON under data/exports/usage-<stamp>/ (Track E). */
  ipcMain.handle("usage:export", async () => {
    const { agentCore } = await loadModules();
    const cfg = await readConfig();
    const inP = Number(cfg.prefs?.usageInputPerMillion) || 0;
    const outP = Number(cfg.prefs?.usageOutputPerMillion) || 0;
    const pricing =
      inP > 0 || outP > 0
        ? { inputPerMillion: inP, outputPerMillion: outP }
        : undefined;
    const summary = await agentCore.aggregateUsage({ pricing });
    const dirs = await agentCore.ensureDataDirs();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = path.join(dirs.root, "exports", `usage-${stamp}`);
    return agentCore.exportUsageCsvBundle(summary, outDir);
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
    const dirs = await agentCore.ensureDataDirs();
    const credentialsPath =
      typeof configMod.getCredentialsPath === "function"
        ? configMod.getCredentialsPath(path.join(dirs.root, "config.json"))
        : path.join(dirs.root, "credentials.json");
    const bundle = await agentCore.buildDiagnosticsBundle({
      config: publicCfg,
      appVersion: app.getVersion() || "1.0.0",
      workspacePath,
      sessionBackend: sessionBackend || null,
      credentialsPath,
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

  /**
   * ClawHub-style catalog (1.0.5 scaffold): curated offline list + optional remote JSON.
   * Does not auto-download packages; install is local-folder only for now.
   */
  ipcMain.handle("skills:catalog", async (_evt, payload = {}) => {
    const ws = payload.workspacePath || workspacePath;
    const { agentCore, skillsMod } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    const installed = await skillsMod.loadSkills({
      workspacePath: ws || undefined,
      userSkillsDir: dirs.skills,
      sharedAgentsDir: path.join(os.homedir(), ".agents", "skills"),
      bundledDir: bundledSkillsDir(),
    });
    const installedNames = installed.map((s) => s.name);
    const curated = skillsMod.curatedCatalog();
    let remote = [];
    let remoteError;
    let source = "curated";
    const catalogUrl =
      typeof payload.url === "string" && payload.url.trim()
        ? payload.url.trim()
        : skillsMod.DEFAULT_SKILL_CATALOG_URL;
    const wantRemote = payload?.remote !== false;
    if (wantRemote && catalogUrl.startsWith("https://")) {
      try {
        const { status, json } = await netFetchJson(catalogUrl, 10_000);
        if (status >= 200 && status < 300 && json) {
          remote = skillsMod.parseRemoteCatalogJson(json);
          if (remote.length) source = curated.length ? "mixed" : "remote";
        } else if (status === 404) {
          remoteError = "remote catalog 404 (using curated)";
        } else {
          remoteError = `remote catalog HTTP ${status}`;
        }
      } catch (err) {
        remoteError = err instanceof Error ? err.message : String(err);
      }
    }
    const items = skillsMod.annotateInstalled(
      skillsMod.mergeCatalog(curated, remote),
      installedNames,
    );
    return {
      items,
      source,
      remoteError: remoteError || null,
      fetchedAt: new Date().toISOString(),
      catalogUrl,
      userSkillsDir: dirs.skills,
    };
  });

  ipcMain.handle("skills:installFromDir", async (_evt, payload = {}) => {
    const { agentCore, skillsMod } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    let sourceDir = typeof payload.sourceDir === "string" ? payload.sourceDir.trim() : "";
    if (!sourceDir) {
      const picked = await dialog.showOpenDialog(mainWindow || undefined, {
        title: "选择技能文件夹（需含 SKILL.md）",
        properties: ["openDirectory"],
      });
      if (picked.canceled || !picked.filePaths?.[0]) {
        return { ok: false, cancelled: true, code: "cancelled" };
      }
      sourceDir = picked.filePaths[0];
    }
    const res = await skillsMod.installSkillFromDir({
      sourceDir,
      userSkillsDir: dirs.skills,
      overwrite: Boolean(payload.overwrite),
    });
    return res;
  });

  /**
   * Install skill from remote packageUrl (https zip/tar.gz only).
   * Safe extract + optional SHA-256; never runs package scripts.
   */
  ipcMain.handle("skills:installFromPackage", async (_evt, payload = {}) => {
    const { agentCore, skillsMod } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    const packageUrl = typeof payload.packageUrl === "string" ? payload.packageUrl.trim() : "";
    if (!packageUrl) {
      return { ok: false, code: "invalid", error: "packageUrl required" };
    }
    if (typeof skillsMod.installSkillFromPackage !== "function") {
      return { ok: false, code: "invalid", error: "installSkillFromPackage unavailable" };
    }
    const expectedSha256 =
      typeof payload.expectedSha256 === "string"
        ? payload.expectedSha256
        : typeof payload.packageSha256 === "string"
          ? payload.packageSha256
          : undefined;
    return skillsMod.installSkillFromPackage({
      packageUrl,
      userSkillsDir: dirs.skills,
      overwrite: Boolean(payload.overwrite),
      expectedSha256,
      maxBytes: Number(payload.maxBytes) > 0 ? Number(payload.maxBytes) : undefined,
      timeoutMs: Number(payload.timeoutMs) > 0 ? Number(payload.timeoutMs) : undefined,
    });
  });

  /**
   * Preview SKILL.md under workspace / user / shared / bundled skill roots only.
   */
  ipcMain.handle("skills:preview", async (_evt, payload = {}) => {
    const ws = payload.workspacePath || workspacePath;
    const { agentCore, skillsMod } = await loadModules();
    const dirs = await agentCore.ensureDataDirs();
    const allowedRoots = [
      dirs.skills,
      path.join(os.homedir(), ".agents", "skills"),
      bundledSkillsDir(),
    ].filter(Boolean);
    if (ws) {
      allowedRoots.push(path.join(ws, "skills"), path.join(ws, ".agents", "skills"));
    }
    // Also allow a one-shot folder pick when skillDir omitted
    let skillDir = typeof payload.skillDir === "string" ? payload.skillDir.trim() : "";
    if (!skillDir && payload.pick) {
      const picked = await dialog.showOpenDialog(mainWindow || undefined, {
        title: "选择技能文件夹预览（需含 SKILL.md）",
        properties: ["openDirectory"],
      });
      if (picked.canceled || !picked.filePaths?.[0]) {
        return { ok: false, cancelled: true };
      }
      skillDir = picked.filePaths[0];
      // Temporary allow the picked path's parent for preview
      allowedRoots.push(path.dirname(skillDir), skillDir);
    }
    if (!skillDir && payload.name) {
      const records = await skillsMod.loadSkills({
        workspacePath: ws || undefined,
        userSkillsDir: dirs.skills,
        sharedAgentsDir: path.join(os.homedir(), ".agents", "skills"),
        bundledDir: bundledSkillsDir(),
      });
      const hit = records.find(
        (s) => String(s.name).toLowerCase() === String(payload.name).toLowerCase(),
      );
      if (!hit?.dir) return { ok: false, error: `skill not found: ${payload.name}` };
      skillDir = hit.dir;
    }
    return skillsMod.readSkillPreview({
      skillDir,
      allowedRoots,
      maxChars: payload.maxChars,
    });
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
    killAllPtys();
    if (sessionWorker) {
      void sessionWorker.shutdown().catch(() => undefined);
      sessionWorker = null;
      sessionBackend = null;
    }
  });
}
