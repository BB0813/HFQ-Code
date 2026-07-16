/**
 * Windows DPAPI (CurrentUser) helpers for credentials at rest.
 * Uses System.Security.Cryptography.ProtectedData via PowerShell —
 * no native addons; works under Electron + Node on Windows.
 *
 * Disable with HFQ_CREDENTIALS_PLAIN=1 (dev/tests).
 */

import { spawn } from "node:child_process";

export type DpapiScope = "CurrentUser" | "LocalMachine";

function runPowerShellEnv(
  scriptBody: string,
  envExtra: Record<string, string>,
  timeoutMs = 20_000,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", scriptBody],
      {
        windowsHide: true,
        env: { ...process.env, ...envExtra },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`DPAPI PowerShell timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

export function isWindowsDpapiHost(): boolean {
  return process.platform === "win32";
}

/** Prefer DPAPI on Windows unless HFQ_CREDENTIALS_PLAIN=1. */
export function shouldUseDpapi(): boolean {
  if (!isWindowsDpapiHost()) return false;
  if (process.env.HFQ_CREDENTIALS_PLAIN === "1") return false;
  return true;
}

const PROTECT_SCRIPT = `
Add-Type -AssemblyName System.Security
$b64 = $env:HFQ_DPAPI_IN
$scopeName = $env:HFQ_DPAPI_SCOPE
if (-not $b64) { throw 'HFQ_DPAPI_IN missing' }
$bytes = [Convert]::FromBase64String($b64)
$scope = [System.Security.Cryptography.DataProtectionScope]::$scopeName
$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, $scope)
Write-Output ([Convert]::ToBase64String($protected))
`.trim();

const UNPROTECT_SCRIPT = `
Add-Type -AssemblyName System.Security
$b64 = $env:HFQ_DPAPI_IN
$scopeName = $env:HFQ_DPAPI_SCOPE
if (-not $b64) { throw 'HFQ_DPAPI_IN missing' }
$bytes = [Convert]::FromBase64String($b64)
$scope = [System.Security.Cryptography.DataProtectionScope]::$scopeName
$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, $scope)
Write-Output ([Convert]::ToBase64String($plain))
`.trim();

export async function dpapiProtect(
  plainUtf8: string,
  scope: DpapiScope = "CurrentUser",
): Promise<string> {
  if (!isWindowsDpapiHost()) {
    throw new Error("DPAPI is only available on Windows");
  }
  const plainB64 = Buffer.from(plainUtf8, "utf8").toString("base64");
  const res = await runPowerShellEnv(PROTECT_SCRIPT, {
    HFQ_DPAPI_IN: plainB64,
    HFQ_DPAPI_SCOPE: scope,
  });
  if (res.code !== 0) {
    throw new Error(
      `DPAPI protect failed: ${(res.stderr || res.stdout || `exit ${res.code}`).trim()}`,
    );
  }
  const out = res.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || "";
  const cleaned = out.replace(/\s+/g, "");
  if (!cleaned || !/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
    throw new Error("DPAPI protect returned empty/invalid ciphertext");
  }
  return cleaned;
}

export async function dpapiUnprotect(
  cipherB64: string,
  scope: DpapiScope = "CurrentUser",
): Promise<string> {
  if (!isWindowsDpapiHost()) {
    throw new Error("DPAPI is only available on Windows");
  }
  const cleaned = String(cipherB64 || "").trim().replace(/\s+/g, "");
  if (!cleaned) throw new Error("empty DPAPI ciphertext");
  const res = await runPowerShellEnv(UNPROTECT_SCRIPT, {
    HFQ_DPAPI_IN: cleaned,
    HFQ_DPAPI_SCOPE: scope,
  });
  if (res.code !== 0) {
    throw new Error(
      `DPAPI unprotect failed: ${(res.stderr || res.stdout || `exit ${res.code}`).trim()}`,
    );
  }
  const out = res.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || "";
  const b64 = out.replace(/\s+/g, "");
  if (!b64) throw new Error("DPAPI unprotect returned empty plaintext");
  return Buffer.from(b64, "base64").toString("utf8");
}
