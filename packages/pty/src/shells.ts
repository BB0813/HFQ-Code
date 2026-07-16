import path from "node:path";
import fs from "node:fs";

export type ShellKind = "powershell" | "pwsh" | "cmd";

export interface ResolvedShell {
  kind: ShellKind;
  file: string;
  args: string[];
}

const WIN_SHELLS: Record<ShellKind, { fileNames: string[]; args: string[] }> = {
  powershell: {
    fileNames: ["powershell.exe"],
    args: ["-NoLogo", "-NoProfile", "-NoExit"],
  },
  pwsh: {
    fileNames: ["pwsh.exe"],
    args: ["-NoLogo", "-NoProfile", "-NoExit"],
  },
  cmd: {
    fileNames: ["cmd.exe"],
    args: ["/K"],
  },
};

function existsFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function findOnPath(name: string): string | null {
  const pathEnv = process.env.PATH || process.env.Path || "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  for (const dir of parts) {
    const full = path.join(dir, name);
    if (existsFile(full)) return full;
  }
  return null;
}

function findWindowsShell(kind: ShellKind): string | null {
  const spec = WIN_SHELLS[kind];
  for (const name of spec.fileNames) {
    const found = findOnPath(name);
    if (found) return found;
  }
  if (kind === "cmd") {
    const comspec = process.env.ComSpec;
    if (comspec && existsFile(comspec)) return comspec;
    const sys = process.env.SystemRoot || "C:\\Windows";
    const cmd = path.join(sys, "System32", "cmd.exe");
    if (existsFile(cmd)) return cmd;
  }
  if (kind === "powershell") {
    const sys = process.env.SystemRoot || "C:\\Windows";
    const ps = path.join(sys, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    if (existsFile(ps)) return ps;
  }
  return null;
}

export interface AvailableShell {
  kind: ShellKind;
  file: string;
  available: true;
  label: string;
}

const SHELL_LABELS: Record<ShellKind, string> = {
  powershell: "Windows PowerShell",
  pwsh: "PowerShell 7+",
  cmd: "Command Prompt (cmd)",
};

/** List installed whitelisted shells (for Terminal settings / picker). */
export function listAvailableShells(): AvailableShell[] {
  const kinds: ShellKind[] =
    process.platform === "win32"
      ? ["powershell", "pwsh", "cmd"]
      : ["powershell", "pwsh", "cmd"];
  const out: AvailableShell[] = [];
  for (const kind of kinds) {
    if (process.platform === "win32") {
      const file = findWindowsShell(kind);
      if (file) {
        out.push({
          kind,
          file,
          available: true,
          label: SHELL_LABELS[kind],
        });
      }
    } else if (kind === "powershell") {
      // Non-Windows: report $SHELL once under a single entry for UI completeness.
      const sh = process.env.SHELL || "/bin/bash";
      out.push({
        kind: "powershell",
        file: sh,
        available: true,
        label: sh,
      });
      break;
    }
  }
  return out;
}

/** Resolve a whitelisted interactive shell. Prefer powershell on Windows. */
export function resolveShell(preferred?: string | null): ResolvedShell {
  const raw = String(preferred || "").trim().toLowerCase();
  const order: ShellKind[] =
    process.platform === "win32"
      ? raw === "cmd"
        ? ["cmd", "powershell", "pwsh"]
        : raw === "pwsh"
          ? ["pwsh", "powershell", "cmd"]
          : ["powershell", "pwsh", "cmd"]
      : raw === "cmd"
        ? ["cmd", "powershell", "pwsh"]
        : ["powershell", "pwsh", "cmd"];

  if (process.platform === "win32") {
    for (const kind of order) {
      const file = findWindowsShell(kind);
      if (file) {
        return { kind, file, args: [...WIN_SHELLS[kind].args] };
      }
    }
    throw new Error("no whitelisted shell found (powershell / pwsh / cmd)");
  }

  // Non-Windows: basic shell for future; still whitelist-ish
  const sh = process.env.SHELL || "/bin/bash";
  return { kind: "powershell", file: sh, args: [] };
}

/** Strip secrets / noisy vars from env inherited by interactive shells. */
export function sanitizedEnv(base: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  const deny =
    /^(API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|HFQ_.*KEY|HFQ_.*SECRET|AWS_SECRET|GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN)$/i;
  for (const [k, v] of Object.entries(base)) {
    if (v == null) continue;
    if (deny.test(k)) continue;
    if (/SECRET|PASSWORD|TOKEN|PRIVATE_KEY/i.test(k) && !/^(PROCESSOR_ARCHITECTURE|PATHEXT)$/i.test(k)) {
      continue;
    }
    out[k] = String(v);
  }
  // Ensure essentials on Windows
  if (process.platform === "win32") {
    if (!out.SystemRoot && process.env.SystemRoot) out.SystemRoot = process.env.SystemRoot;
    if (!out.ComSpec && process.env.ComSpec) out.ComSpec = process.env.ComSpec;
  }
  return out;
}
