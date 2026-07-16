# HFQ Code 1.1.2

Full product ship over **1.1.1**: same backend (D3 install auto-download, Tasks cold-start, `providerId`) **plus** desktop renderer polish that was left unstaged on the 1.1.1 tag.

## Why 1.1.2

`v1.1.1` CI pack only contained the backend commit; local frontend changes (Settings / Tasks / Changes / Models) were not in the tag tree. **1.1.2** includes those UI files so the GitHub installer matches the intended product surface.

## Highlights

### Backend (unchanged from 1.1.1)
- D3 `update:install` auto-download + `resolveInstallerPath` + CN errors
- Session `providerId` + `sessionApplied.providerId`
- `listChildren` / `listSpawnAttempts` cold-start persistence

### Desktop UI
- Settings: download %, install auto-download feedback, release page, SmartScreen note
- Tasks: tree / parent stack / failed spawn chips (errorCode 中文)
- Changes: keyboard file nav ·「让智能体修」prefill · commit polish
- Models empty-state + session identity fields in store/sidebar

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.2-x64.exe`) + portable + `SHA256SUMS.txt`.

Prefer **1.1.2** over 1.1.1 for end users (complete UI).

## Verify

- [ ] CI pack green; signed when secrets present
- [ ] Settings download progress + install without prior download
- [ ] Tasks shows children after app restart; depth-fail chips
- [ ] Changes keyboard + ask-agent prefill
- [ ] Version bar **1.1.2**
