import path from "node:path";

/** Resolve a user path against workspace; reject escapes. */
export function resolveWorkspacePath(workspaceRoot: string, userPath: string): string {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, userPath);
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${userPath}`);
  }
  return target;
}
