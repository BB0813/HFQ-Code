import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "./workspace.js";

describe("resolveWorkspacePath", () => {
  const root = path.resolve(process.cwd(), ".tmp-hfq-workspace-fixture");

  it("resolves relative paths inside workspace", () => {
    const full = resolveWorkspacePath(root, "src/index.ts");
    expect(full).toBe(path.resolve(root, "src/index.ts"));
  });

  it("rejects parent traversal", () => {
    expect(() => resolveWorkspacePath(root, "../secret.txt")).toThrow(/escapes workspace/);
  });

  it("rejects absolute paths outside workspace", () => {
    const outside =
      process.platform === "win32" ? "C:\\\\Windows\\\\System32\\\\drivers" : "/etc/passwd";
    expect(() => resolveWorkspacePath(root, outside)).toThrow(/escapes workspace/);
  });
});
