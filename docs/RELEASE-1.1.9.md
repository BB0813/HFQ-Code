# HFQ Code 1.1.9

Coding-loop **polish** over **1.1.8**: PTY scrollback reattach for Terminal remount, Changes commit-message validation, and Tasks/docs alignment. **Not** a layout redesign — that is **1.2**.

Canonical: [PTY-1.1.md](./PTY-1.1.md) · [FRONTEND-IPC.md](./FRONTEND-IPC.md) · [prompts/1.1.9-polish-handoff.md](./prompts/1.1.9-polish-handoff.md) · [prompts/release-1.1.9.md](./prompts/release-1.1.9.md).

## Why 1.1.9

Leaving the Terminal page used to drop the xterm view; users expected the shell process and recent output to still be there. **1.1.9** keeps live PTYs across route switches and replays a ring-buffer scrollback on remount. Changes gets clearer empty-message / stage toasts. Big shell redesign stays in **1.2**.

## Highlights

### Terminal — reattach (B1-2)

- `@hfq/pty` output ring (`DEFAULT_PTY_SCROLLBACK_CHARS`) + `getScrollback`
- IPC `pty:getScrollback` · preload `ptyGetScrollback`
- Terminal panel: on remount / tab re-entry, replay BE ring (+ FE cache); route change does **not** kill PTY
- Session tabs show readable `shellKind` / label; explicit close still kills

### Changes / Tasks

- Empty commit message → toast **请先填写提交说明**; no staged files → clearer stage toast
- (Existing) j/k review, ask-agent prefills only; Tasks parent return / spawn `errorCode` copy as prior train

### Docs / roadmap

- ROADMAP: **1.1.9** polish then **1.2** big UI (`1.2-ui-plan.md`)
- FRONTEND-IPC / PTY-1.1 document reattach contract

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.9-x64.exe`) + portable + `SHA256SUMS.txt`.

## Electron T1 — reattach smoke (release gate)

| Step | Result |
|------|--------|
| Boot | Dev Electron `apps/desktop` · product version **1.1.9** · workspace `Z:\HFQ-Code-test` |
| Terminal | UI **新建终端** · `echo HFQ-1.1.9-REATTACH` · ring + DOM had marker |
| Leave | `#/chat` ≥3.5s · `ptyList` still **alive** (same id) |
| Return | `#/terminal` · marker **still in DOM** (`domAfterReturn: true`) + ring |

**T1 result (2026-07-21 release smoke):** **PASS** — script `scripts/t1-pty-reattach.mjs` (CDP + Playwright); evidence `%APPDATA%/HFQ-Code/t1-evidence/t1-1.1.9.json` (+ screenshot).

- [x] Electron T1 PASS  
- [x] `pnpm release:check` green (193 tests + smoke + eval)  
- [x] Route switch did not kill PTY  
- [x] Changes empty message toast path in code  
- [x] Package version **1.1.9**  
- [x] L3 silent still default off (no update-policy change this train)  

## Verify (checklist)

- [x] `pnpm release:check` green  
- [x] **Electron T1** reattach (see above)  
- [ ] Signed when secrets / `HFQ_SIGN_ROOT` present (CI Release on tag)  
- [x] No secrets in package tree  
- [x] Version **1.1.9**  
- [x] No claim of 1.2 layout redesign or default silent update  

## Out of scope (1.1.9)

- 1.2 Layout / theme / activity bar redesign  
- Memory FTS / Goal OS productization  
- Update ladder L0–L3 behavior changes  
- Track E / IM  
