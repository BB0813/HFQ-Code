import path from "node:path";

/** Resolve cwd under workspace; reject escapes. Empty userCwd → workspace root. */
export function resolveWorkspaceCwd(workspaceRoot: string, userCwd?: string | null): string {
  const root = path.resolve(workspaceRoot);
  if (!userCwd || !String(userCwd).trim()) return root;
  const target = path.resolve(root, String(userCwd).trim());
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`cwd escapes workspace: ${userCwd}`);
  }
  return target;
}

/** True if candidate path is inside (or equal to) workspace root. */
export function isInsideWorkspace(workspaceRoot: string, candidate: string): boolean {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(candidate);
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
