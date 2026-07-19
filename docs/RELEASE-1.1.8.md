# HFQ Code 1.1.8

Update ladder **L3** over **1.1.7**: optional **opt-in** silent NSIS install (`/S`) after download is ready, with pending-install marker recovery, Portable rejection, and L2 wizard fallback. Silent is **never** the default.

Canonical: [UPDATE-L1-L3.md](./UPDATE-L1-L3.md) · [DECISIONS.md](./DECISIONS.md) Q9 · [prompts/1.1.8-l3-handoff.md](./prompts/1.1.8-l3-handoff.md) · [prompts/release-1.1.8.md](./prompts/release-1.1.8.md).

## Why 1.1.8

**1.1.7** stopped at guided download + one-click open of the NSIS wizard (L1+L2). Users who explicitly want fewer steps can now enable **下载完成后自动安装更新**, confirm once, and use **安装并重启** so the app schedules a detached installer with **`/S`**, quits, and relaunches after NSIS finishes. UAC may still appear for per-machine install — that is an OS boundary, not a product install wizard.

## Highlights

### L3 — Opt-in silent NSIS install

- `prefs.updatePolicy.silentInstall` (default **false**) + first-enable **secondary confirm** + `silentInstallAcceptedAt`
- Ready + silent on → Settings CTA **安装并重启** → `installUpdate({ mode: "silent" })` / `installUpdateSilent`
- Writes `%APPDATA%/HFQ-Code/updates/pending-install.json`, spawns detached **`installer.exe /S`** (short delay so file locks release), then `app.quit()`
- On next boot: version ≥ target → clear marker + `update:installed`; else keep marker + `update:install-pending` and offer L2 retry

### Safety & channels

- **Portable** runtime and portable assets **reject** L3; use NSIS install or L2 openPath
- Install path sandboxed to `userData/updates` `.exe` only; download host allowlist unchanged
- L2 **安装更新** (openPath wizard) remains available when silent is off or silent fails
- Self-signed **HFQ-ClodBreeze** / SmartScreen notes unchanged — product copy does **not** claim default silent or “no UAC”

### Shared helpers + polish

- `@hfq/shared` `update-silent` (+ tests); desktop `electron/update-silent.cjs`
- Bootstrap failsafe: longer timeout window and clear sticky “Bootstrap timeout” when bootstrap settles

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.8-x64.exe`) + portable + `SHA256SUMS.txt`.

- Prefer **NSIS** for L3 silent upgrade path  
- **Portable has no L3** silent install  

## Path A — real silent upgrade (release gate)

| Step | Result |
|------|--------|
| Host | Installed **1.1.7** NSIS (`C:\Program Files\HFQ Code`, package version 1.1.7) |
| New package | Local `pnpm pack:win` → `HFQ Code-1.1.8-x64.exe` (signed HFQ-ClodBreeze) |
| Flow | Place 1.1.8 under `%APPDATA%/HFQ-Code/updates/` · write `pending-install.json` · NSIS **`/S`** (elevated; ExitCode 0) · no wizard pages |
| Assert | Version **1.1.8**; APPDATA config/sessions retained (config size 5657, sessions=1); pending cleared on success via boot evaluate |

**Path A result (2026-07-20 release smoke):** **PASS** — before **1.1.7** → after **1.1.8**; silent flags `/S`; UAC elevation required (OS boundary); full NSIS wizard **not** shown.

- [x] Path A PASS  
- [x] `pnpm release:check` green (192 tests + smoke + eval)  
- [x] silent default off; without opt-in, `mode:"silent"` rejected (unit + main guards)  
- [x] L2 `mode:"ui"` / openPath path retained in code  
- [x] Portable rejects L3 (shared + main guards)

## Verify (checklist)

- [x] `pnpm release:check` green  
- [x] Signed when secrets / `HFQ_SIGN_ROOT` present (local pack signed)  
- [x] No `*.pfx` / password files in package tree  
- [x] Product package version **1.1.8**  
- [x] `silentInstall` default false; first enable requires confirm + acceptedAt  
- [x] **Path A** 1.1.7 → 1.1.8 silent upgrade (see above)  
- [x] L2 openPath path still works with silent off (code path)  
- [x] Portable cannot enable / schedule silent  

## Out of scope (1.1.8)

- Default-on silent install or “fully unattended / no UAC” claims  
- electron-updater migration  
- OV/EV purchase / killing SmartScreen  
- Delta packages  
- Memory FTS / Goal OS / Layout redesign  
