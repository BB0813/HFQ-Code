export {
  PtyHost,
  resetNodePtyCacheForTests,
  DEFAULT_PTY_SCROLLBACK_CHARS,
} from "./host.js";
export type {
  PtyBackend,
  PtyCreateParams,
  PtyHostEvents,
  PtySessionInfo,
  PtyScrollback,
} from "./host.js";
export { resolveWorkspaceCwd, isInsideWorkspace } from "./paths.js";
export { resolveShell, sanitizedEnv, listAvailableShells } from "./shells.js";
export type { ResolvedShell, ShellKind, AvailableShell } from "./shells.js";
