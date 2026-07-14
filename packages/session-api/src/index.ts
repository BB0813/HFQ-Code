/**
 * Local daemon RPC channel names (WorkBuddy-style).
 * Transport can be Electron IPC or WebSocket.
 */

export const RpcChannels = {
  sessionCreate: "session:create",
  sessionGet: "session:get",
  sessionList: "session:list",
  sessionSend: "session:send",
  sessionSubscribe: "session:subscribe",
  permissionResolve: "permission:resolve",
  skillsList: "skills:list",
  mcpList: "mcp:list",
  modelsList: "models:list",
  workspaceOpen: "workspace:open",
} as const;

export type RpcChannel = (typeof RpcChannels)[keyof typeof RpcChannels];
