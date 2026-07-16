const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hfq", {
  getInfo: () => ipcRenderer.invoke("app:getInfo"),
  listPages: () => ipcRenderer.invoke("nav:listPages"),
  openWorkspace: () => ipcRenderer.invoke("workspace:open"),
  setWorkspace: (payload) => ipcRenderer.invoke("workspace:set", payload ?? {}),
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  openPath: (payload) => ipcRenderer.invoke("shell:openPath", payload ?? {}),
  openWorkspaceFile: (payload) => ipcRenderer.invoke("workspace:openFile", payload ?? {}),
  openInEditor: (payload) => ipcRenderer.invoke("workspace:openInEditor", payload ?? {}),
  readWorkspaceText: (payload) => ipcRenderer.invoke("workspace:readText", payload ?? {}),
  writeWorkspaceText: (payload) => ipcRenderer.invoke("workspace:writeText", payload ?? {}),
  /** Shallow directory listing under workspace (Files explorer). */
  listWorkspaceDir: (payload) => ipcRenderer.invoke("workspace:listDir", payload ?? {}),
  /** System dialog: pick files under bound workspace → relative paths. */
  pickWorkspaceFiles: (payload) => ipcRenderer.invoke("workspace:pickFiles", payload ?? {}),
  runShell: (payload) => ipcRenderer.invoke("shell:run", payload ?? {}),

  /** Interactive PTY (1.1 backend). UI agent can wire xterm later. */
  ptyCreate: (payload) => ipcRenderer.invoke("pty:create", payload ?? {}),
  ptyWrite: (payload) => ipcRenderer.invoke("pty:write", payload ?? {}),
  ptyResize: (payload) => ipcRenderer.invoke("pty:resize", payload ?? {}),
  ptyKill: (payload) => ipcRenderer.invoke("pty:kill", payload ?? {}),
  ptyList: () => ipcRenderer.invoke("pty:list"),
  /** { shells: AvailableShell[], preferred: ""|"powershell"|"pwsh"|"cmd" } */
  ptyShells: () => ipcRenderer.invoke("pty:shells"),
  onPtyData: (handler) => {
    const listener = (_event, data) => handler(data);
    ipcRenderer.on("pty:data", listener);
    return () => ipcRenderer.removeListener("pty:data", listener);
  },
  onPtyExit: (handler) => {
    const listener = (_event, data) => handler(data);
    ipcRenderer.on("pty:exit", listener);
    return () => ipcRenderer.removeListener("pty:exit", listener);
  },

  getConfig: () => ipcRenderer.invoke("config:get"),
  setActiveModel: (payload) => ipcRenderer.invoke("config:setActive", payload),
  upsertProvider: (payload) => ipcRenderer.invoke("config:upsertProvider", payload),
  setPrefs: (payload) => ipcRenderer.invoke("config:setPrefs", payload ?? {}),
  testModel: (payload) => ipcRenderer.invoke("models:test", payload ?? {}),

  createSession: (payload) => ipcRenderer.invoke("session:create", payload ?? {}),
  getSession: (sessionId) => ipcRenderer.invoke("session:get", sessionId),
  listSessions: (payload) => ipcRenderer.invoke("session:list", payload ?? {}),
  openSession: (payload) => ipcRenderer.invoke("session:open", payload ?? {}),
  getSessionSnapshot: (sessionId) => ipcRenderer.invoke("session:snapshot", sessionId),
  sendMessage: (payload) => ipcRenderer.invoke("session:send", payload),
  abortSession: (payload) => ipcRenderer.invoke("session:abort", payload ?? {}),
  deleteSession: (payload) => ipcRenderer.invoke("session:delete", payload ?? {}),
  renameSession: (payload) => ipcRenderer.invoke("session:rename", payload ?? {}),
  setPlanMode: (payload) => ipcRenderer.invoke("session:setPlanMode", payload ?? {}),
  getPlanMode: (payload) => ipcRenderer.invoke("session:getPlanMode", payload ?? {}),
  setPermissionMode: (payload) => ipcRenderer.invoke("session:setPermissionMode", payload ?? {}),
  getPermissionMode: (payload) => ipcRenderer.invoke("session:getPermissionMode", payload ?? {}),
  listChildSessions: (payload) => ipcRenderer.invoke("session:listChildren", payload ?? {}),
  listSpawnAttempts: (payload) => ipcRenderer.invoke("session:listSpawnAttempts", payload ?? {}),
  spawnSubagent: (payload) => ipcRenderer.invoke("session:spawnSubagent", payload ?? {}),
  resolvePermission: (payload) => ipcRenderer.invoke("permission:resolve", payload),
  revertChange: (payload) => ipcRenderer.invoke("changes:revert", payload),
  writeChangeContent: (payload) => ipcRenderer.invoke("changes:writeContent", payload),

  /** Workspace git for Changes UI (1.1 backend). Frontend owns commit panel UX. */
  gitStatus: (payload) => ipcRenderer.invoke("git:status", payload ?? {}),
  gitDiff: (payload) => ipcRenderer.invoke("git:diff", payload ?? {}),
  gitShow: (payload) => ipcRenderer.invoke("git:show", payload ?? {}),
  gitStage: (payload) => ipcRenderer.invoke("git:stage", payload ?? {}),
  gitUnstage: (payload) => ipcRenderer.invoke("git:unstage", payload ?? {}),
  gitCommit: (payload) => ipcRenderer.invoke("git:commit", payload ?? {}),
  gitLog: (payload) => ipcRenderer.invoke("git:log", payload ?? {}),

  getAppPaths: () => ipcRenderer.invoke("app:paths"),
  listSkills: (payload) => ipcRenderer.invoke("skills:list", payload ?? {}),
  skillsCatalog: (payload) => ipcRenderer.invoke("skills:catalog", payload ?? {}),
  installSkillFromDir: (payload) => ipcRenderer.invoke("skills:installFromDir", payload ?? {}),
  installSkillFromPackage: (payload) =>
    ipcRenderer.invoke("skills:installFromPackage", payload ?? {}),
  previewSkill: (payload) => ipcRenderer.invoke("skills:preview", payload ?? {}),
  getPolicyMatrix: (payload) => ipcRenderer.invoke("policy:matrix", payload ?? {}),
  getSessionAllows: (payload) => ipcRenderer.invoke("policy:sessionAllows", payload ?? {}),
  grantSessionAllow: (payload) => ipcRenderer.invoke("policy:grantSession", payload ?? {}),
  revokeSessionAllow: (payload) => ipcRenderer.invoke("policy:revokeSession", payload ?? {}),
  listMcp: () => ipcRenderer.invoke("mcp:list"),
  setMcpEnabled: (payload) => ipcRenderer.invoke("mcp:setEnabled", payload),
  connectMcp: (payload) => ipcRenderer.invoke("mcp:connect", payload),
  disconnectMcp: (payload) => ipcRenderer.invoke("mcp:disconnect", payload),
  upsertMcp: (payload) => ipcRenderer.invoke("mcp:upsert", payload),
  removeMcp: (payload) => ipcRenderer.invoke("mcp:remove", payload),
  pingMcp: (payload) => ipcRenderer.invoke("mcp:ping", payload ?? {}),

  listMemory: (payload) => ipcRenderer.invoke("memory:list", payload ?? {}),
  searchMemory: (payload) => ipcRenderer.invoke("memory:search", payload ?? {}),
  upsertMemory: (payload) => ipcRenderer.invoke("memory:upsert", payload ?? {}),
  removeMemory: (payload) => ipcRenderer.invoke("memory:remove", payload ?? {}),
  usageSummary: () => ipcRenderer.invoke("usage:summary"),
  /** Write usage-sessions.csv / usage-daily.csv / usage-summary.json under data/exports. */
  usageExport: () => ipcRenderer.invoke("usage:export"),
  importScan: (payload) => ipcRenderer.invoke("import:scan", payload ?? {}),

  importApply: (payload) => ipcRenderer.invoke("import:apply", payload ?? {}),
  exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export"),
  checkForUpdates: (payload) => ipcRenderer.invoke("update:check", payload ?? {}),
  openReleasePage: (payload) => ipcRenderer.invoke("update:openRelease", payload ?? {}),
  /**
   * D3 — download installer (progress via onUpdateDownload).
   * omit url → re-check + recommendedAsset; or pass url/fileName from assets.
   */
  downloadUpdate: (payload) => ipcRenderer.invoke("update:download", payload ?? {}),
  cancelUpdateDownload: () => ipcRenderer.invoke("update:downloadCancel"),
  getUpdateDownloadStatus: () => ipcRenderer.invoke("update:downloadStatus"),
  /** Open downloaded .exe after confirm dialog (unless confirm:false). */
  installUpdate: (payload) => ipcRenderer.invoke("update:install", payload ?? {}),
  clearUpdateDownloads: () => ipcRenderer.invoke("update:clearDownloads"),
  openExternal: (payload) => ipcRenderer.invoke("shell:openExternal", payload ?? {}),
  /** Reveal path in Explorer (workspace-relative or under app data). */
  revealInFolder: (payload) => ipcRenderer.invoke("shell:revealInFolder", payload ?? {}),

  onSessionEvent: (handler) => {
    const listener = (_event, data) => handler(data);
    ipcRenderer.on("session:event", listener);
    return () => ipcRenderer.removeListener("session:event", listener);
  },
  onWorkspaceChanged: (handler) => {
    const listener = (_event, data) => handler(data);
    ipcRenderer.on("workspace:changed", listener);
    return () => ipcRenderer.removeListener("workspace:changed", listener);
  },
  onUpdateAvailable: (handler) => {
    const listener = (_event, data) => handler(data);
    ipcRenderer.on("update:available", listener);
    return () => ipcRenderer.removeListener("update:available", listener);
  },
  onUpdateDownload: (handler) => {
    const listener = (_event, data) => handler(data);
    ipcRenderer.on("update:download", listener);
    return () => ipcRenderer.removeListener("update:download", listener);
  },
});
