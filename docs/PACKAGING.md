# HFQ Code — Packaging (1.0)

## Targets

| Artifact | Command | Output |
|----------|---------|--------|
| NSIS installer + portable | `pnpm pack:win` | `apps/desktop/release/HFQ Code-1.0.10-x64.exe` + `…-portable.exe` |
| SHA-256 sums | `pnpm sha256:release` | `apps/desktop/release/SHA256SUMS.txt` |
| Portable only | `pnpm --filter @hfq/desktop pack:portable` | same dir |
| Unpacked dir (debug) | `pnpm pack:dir` | `release/win-unpacked/` |
| Unpacked smoke asserts | `pnpm pack:verify` | builds dir + checks tree |

Release handoff notes: [RELEASE-1.0.10.md](./RELEASE-1.0.10.md) · [RELEASE-1.0.9.md](./RELEASE-1.0.9.md) · [RELEASE-1.0.8.md](./RELEASE-1.0.8.md) · [RELEASE-1.0.7.md](./RELEASE-1.0.7.md) · [RELEASE-1.0.6.md](./RELEASE-1.0.6.md).

## CI / CD (GitHub Actions)

| Workflow | Trigger | Job |
|----------|---------|-----|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | push/PR → `main` | `pnpm release:check` on `windows-latest` |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | tag `v*` or manual | `release:check` + **signed** `pack:win` → GitHub Release |
| [`.github/workflows/pack-verify.yml`](../.github/workflows/pack-verify.yml) | weekly / manual | `pnpm pack:verify` |

Publish a release:

```bash
git tag -a v1.0.1 -m "HFQ Code 1.0.1"
git push origin v1.0.1
```

Requires: Node 22+, pnpm 9+, Windows x64, network for electron-builder downloads on first run.

`pnpm pack:win` / `pack:dir` run `pnpm build` first so `packages/*/dist` (including session worker entry) is current.

### GitHub secrets (signing)

| Secret | Content |
|--------|---------|
| `HFQ_SIGN_PFX_BASE64` | Base64 of `root.pfx` (from `Z:\Win软件签名\output\root.pfx`) |
| `HFQ_SIGN_PFX_PASSWORD` | PFX password (same as `output\pfx.password`) |

Encode PFX locally (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("Z:\Win软件签名\output\root.pfx")) | Set-Clipboard
```

Workflow materializes `%RUNNER_TEMP%\hfq-sign` with `sign.ps1` + PFX + Windows SDK `signtool`, sets `HFQ_SIGN_ROOT`, then runs `pnpm pack:win`.  
CI **never** stores PFX in the git tree. `workflow_dispatch` can set `skip_sign=true` for unsigned debug packs.

## Version

Product version comes from `apps/desktop/package.json` (currently **1.0.10**). Keep root `package.json` version aligned.

App icon: `apps/desktop/build/icon.ico` (+ `icon.png`); electron-builder uses `directories.buildResources` / `win.icon`.

**Windows exe icon stamp:** `win.signAndEditExecutable` stays `false` (avoids winCodeSign symlink issues).  
`scripts/after-pack.mjs` (`build.afterPack`) runs:

1. `scripts/stamp-win-icon.mjs` — resedit injects `icon.ico` into `HFQ Code.exe`
2. `scripts/windows-sign.mjs` — Authenticode sign **after** resedit (order is mandatory)

Final NSIS + portable artifacts are signed again via `afterAllArtifactBuild` → same signer.

## Authenticode (HFQ-ClodBreeze)

Self-signed publisher **HFQ-ClodBreeze** (thumbprint `C3A1D6336948BF3E2FB13B82E8E8689AE89B502A`).  
Improves “未知发布者” when the machine trusts the root; **does not** guarantee SmartScreen clearance.

### Build machine (local)

| Env | Meaning | Default |
|-----|---------|---------|
| `HFQ_SIGN_ROOT` | Sign project root | `Z:\Win软件签名` |
| `HFQ_SIGN_SKIP=1` | Skip signing (debug only) | off — **pack fails** if root missing |
| `HFQ_SIGN_DIST` | Trust source (optional) | `%HFQ_SIGN_ROOT%\dist` |

Expected layout under `HFQ_SIGN_ROOT`:

```text
output\root.pfx          # PRIVATE — never pack / never git
output\pfx.password      # PRIVATE
tools\signtool.exe
sign.ps1
dist\                    # PUBLIC trust pack (also vendored at apps/desktop/build/trust)
```

Sign one file manually:

```powershell
node scripts/windows-sign.mjs "D:\path\HFQ Code.exe"
# or
powershell -NoProfile -ExecutionPolicy Bypass -File "Z:\Win软件签名\sign.ps1" -File "D:\path\xxx.exe" -Description "HFQ Code"
```

Unsigned local pack:

```bash
# Git Bash
export HFQ_SIGN_SKIP=1
pnpm pack:win

# PowerShell
$env:HFQ_SIGN_SKIP = "1"
pnpm pack:win
```

`pnpm pack:verify` / weekly CI always set `HFQ_SIGN_SKIP=1` (tree asserts only; no PFX required).

### Trust pack (shipped to users)

Vendored (public only) at `apps/desktop/build/trust/` → electron-builder `extraResources` →:

```text
{app}/resources/trust/
  HFQ-ClodBreeze.cer
  HFQ-ClodBreeze.spc
  root.spc
  certmgr.exe
  config.bat
  config-silent.bat
  Install-Trust.bat
  README.txt
```

**NSIS:** `build/installer-trust.nsh` (`nsis.include`) runs after install:

```text
$INSTDIR\resources\trust\config-silent.bat
```

(`perMachine: true` + elevation so root store import can succeed.)

**Portable:** same `resources\trust\`. Prefer launcher `resources\Launch-HFQ-Code.bat` (runs silent trust then starts `HFQ Code.exe`), or run `Install-Trust.bat` as Administrator once.

Success marker used by silent script: `%TEMP%\HFQ-ClodBreeze.trust.key`.

### Red lines

1. Release tree / NSIS / portable / `win-unpacked` must **not** contain `root.pfx`, `pfx.password`, or `PFX密码.txt`.
2. Do not promise SmartScreen elimination in UI copy.
3. Sign failure aborts `pnpm pack:win` (non-zero) unless `HFQ_SIGN_SKIP=1`.
4. Keep `signAndEditExecutable: false` — custom hooks only (no winCodeSign download).
5. Never re-order: **resedit first, then sign** unpacked main exe.

## Update policy

1. Publish NSIS and/or portable artifacts to GitHub Releases.
2. Users may install via browser **or** in-app download (D3).
3. Data under `%APPDATA%/HFQ-Code` is preserved across upgrades (`config.json`, `credentials.json`, sessions).
4. **Self-signed Authenticode** via HFQ-ClodBreeze (above). SmartScreen may still warn for new publishers.
5. **No silent auto-install.** D3 downloads to `%APPDATA%/HFQ-Code/updates/` then opens the `.exe` after user confirm.

**In-app check (1.0.2+):** Settings → 检查更新 queries GitHub Releases latest, compares semver to `app.getVersion()`, and can open the release page. Optional startup check (`prefs.checkUpdatesOnStartup`, default on, 6h throttle) only **notifies** when newer.

**In-app download (D3):** `update:download` / `update:install` — see [UPDATE-D3.md](./UPDATE-D3.md) · [FRONTEND-IPC.md](./FRONTEND-IPC.md).

**Default transport (1.0.4+):** `prefs.updateSource` defaults to **`ghproxy`** so the API call is  
`{updateProxyBase}https://api.github.com/repos/BB0813/HFQ-Code/releases/latest`  
(default base `https://ghproxy.com/`). Set `updateSource: "direct"` to hit GitHub without a mirror. Asset rows may include a mirrored download URL when ghproxy is active. Fallback chain also tries ungh + direct.

## Contents

- Electron main + preload + renderer
- Workspace packages (`@hfq/*`) via Electron dependency graph at pack time
- **`asar: false`** so pnpm-linked `@hfq/*` pack cleanly and session worker `entry.js` is a real filesystem path
- Bundled skills via `extraResources` → `resources/skills/bundled`
- Trust pack via `extraResources` → `resources/trust`
- **`@hfq/pty`** (+ optional **`node-pty`** native): required for interactive Terminal backend. If `node-pty` fails to pack/load, runtime uses `spawn-pipe` fallback. `pnpm pack:verify` asserts `@hfq/pty` is present and reports `node-pty` / `.node` binding status.

## Verify after pack

Automated:

```bash
pnpm release:check   # build + test + smoke + eval
pnpm pack:verify     # build + pack:dir + tree asserts
```

Signing check (PowerShell, after local `pack:win` without skip):

```powershell
$st = "Z:\Win软件签名\tools\signtool.exe"
& $st verify /pa /v "apps\desktop\release\win-unpacked\HFQ Code.exe"
& $st verify /pa /v (Get-ChildItem "apps\desktop\release\HFQ Code-*-x64.exe").FullName
& $st verify /pa /v (Get-ChildItem "apps\desktop\release\HFQ Code-*-portable.exe").FullName
# Ensure no private material:
Get-ChildItem apps\desktop\release -Recurse -Include *.pfx,pfx.password,*密码* -ErrorAction SilentlyContinue
```

Manual:

1. Run portable `.exe` or install NSIS (UAC for per-machine + trust import)
2. Confirm data dir under `%APPDATA%/HFQ-Code`
3. Open a workspace → new session → list/read (worker or local fallback)
4. Settings → 诊断包 export works
5. Settings shows version **1.0.10**
6. Taskbar / shortcut / `HFQ Code.exe` icon is the HFQ monogram (not the default Electron atom)
7. `resources\trust\config-silent.bat` exists in installed/portable layout

## Session worker in packages

Desktop spawns:

```text
Electron.exe + ELECTRON_RUN_AS_NODE=1 → node_modules/@hfq/agent-core/dist/worker/entry.js
```

No separate system Node install is required. If spawn fails, main falls back to in-process `SessionManager`.
