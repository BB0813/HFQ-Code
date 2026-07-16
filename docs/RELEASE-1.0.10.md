# HFQ Code 1.0.10

Patch train over **1.0.9**: Authenticode self-sign + trust pack, thinking stream, DPAPI, D3 download, PTY/git backends, React/Vite shell.

## Highlights

### Signing (D2)
- Publisher **HFQ-ClodBreeze** (self-signed; SmartScreen may still warn)
- NSIS installs trust via `resources/trust/config-silent.bat`
- Portable: prefer `resources/Launch-HFQ-Code.bat`
- CI secrets: `HFQ_SIGN_PFX_BASE64`, `HFQ_SIGN_PFX_PASSWORD`
- Private PFX **never** in git or release tree

### Agent / IPC
- Thinking stream events for CoT UI
- DPAPI credentials; usage CSV; diagnostics redaction
- PTY + git IPC ready for frontend chrome
- In-app update download (D3)

### UI shell
- Vite/React renderer under `apps/desktop/renderer`
- Legacy vanilla UI archived at `renderer-legacy/`

## Install

GitHub Releases: NSIS (`HFQ Code-1.0.10-x64.exe`) + portable + `SHA256SUMS.txt`.

See [PACKAGING.md](./PACKAGING.md) and README SmartScreen notes.

## Verify

- [ ] `pnpm release:check` green (build · 146+ tests · smoke · eval)
- [ ] Signed `HFQ Code.exe` (`signtool verify /pa`) when secrets/local `HFQ_SIGN_ROOT` present
- [ ] Installed/portable layout has `resources/trust/` and no `*.pfx`
- [ ] Settings version **1.0.10**; update check finds this release
- [ ] Chat can receive `thinking.*` events (UI optional)
- [ ] Permission modes + modal timeout still work
