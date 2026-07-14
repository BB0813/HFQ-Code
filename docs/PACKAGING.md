# HFQ Code — Packaging (1.0)

## Targets

| Artifact | Command | Output |
|----------|---------|--------|
| NSIS installer + portable | `pnpm pack:win` | `apps/desktop/release/HFQ Code-1.0.0-x64.exe` + `…-portable.exe` |
| Portable only | `pnpm --filter @hfq/desktop pack:portable` | same dir |
| Unpacked dir (debug) | `pnpm pack:dir` | `release/win-unpacked/` |
| Unpacked smoke asserts | `pnpm pack:verify` | builds dir + checks tree |

Release handoff notes: [RELEASE-1.0.0.md](./RELEASE-1.0.0.md).

## CI / CD (GitHub Actions)

| Workflow | Trigger | Job |
|----------|---------|-----|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | push/PR → `main` | `pnpm release:check` on `windows-latest` |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | tag `v*` or manual | `release:check` + `pack:win` → GitHub Release assets |
| [`.github/workflows/pack-verify.yml`](../.github/workflows/pack-verify.yml) | weekly / manual | `pnpm pack:verify` |

Publish a release:

```bash
git tag -a v1.0.0 -m "HFQ Code 1.0.0"
git push origin v1.0.0
```

Requires: Node 22+, pnpm 9+, Windows x64, network for electron-builder downloads on first run.

`pnpm pack:win` / `pack:dir` run `pnpm build` first so `packages/*/dist` (including session worker entry) is current.

## Version

Product version comes from `apps/desktop/package.json` (currently **1.0.0**). Keep root `package.json` version aligned.

## Update policy (1.0 freeze)

**Manual channel only** — no in-app `electron-updater`.

1. Publish NSIS and/or portable artifacts from your release page / share.
2. Users install NSIS over the previous install, or replace the portable folder.
3. Data under `%APPDATA%/HFQ-Code` is preserved across upgrades (`config.json`, `credentials.json`, sessions).

Rationale: single-user desktop, low update frequency, avoids auto-update attack surface and code-signing dependency for RC→1.0. Revisit updater only if distribution volume requires it.

## Contents

- Electron main + preload + renderer
- Workspace packages (`@hfq/*`) via Electron dependency graph at pack time
- **`asar: false`** so pnpm-linked `@hfq/*` pack cleanly and session worker `entry.js` is a real filesystem path
- Bundled skills via `extraResources` → `resources/skills/bundled`

## Verify after pack

Automated:

```bash
pnpm release:check   # build + test + smoke + eval
pnpm pack:verify     # build + pack:dir + tree asserts
```

Manual:

1. Run portable `.exe` or install NSIS
2. Confirm data dir under `%APPDATA%/HFQ-Code`
3. Open a workspace → new session → list/read (worker or local fallback)
4. Settings → 诊断包 export works
5. Settings shows version **1.0.0**

## Signing

Optional code signing for SmartScreen. Unsigned builds may show Windows protection prompts; portable is the fallback for internal use.

Default config sets `win.signAndEditExecutable: false` so electron-builder does **not** download `winCodeSign` (which fails on many Windows machines without admin / Developer Mode when extracting macOS symlink stubs). Enable only when you have a cert and symlink privileges.

## Session worker in packages

Desktop spawns:

```text
Electron.exe + ELECTRON_RUN_AS_NODE=1 → node_modules/@hfq/agent-core/dist/worker/entry.js
```

No separate system Node install is required. If spawn fails, main falls back to in-process `SessionManager`.
