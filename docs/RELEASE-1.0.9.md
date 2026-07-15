# HFQ Code 1.0.9

Patch over **1.0.8**: ClawHub remote skill packages (safe path) + permission modal hardening.

## Highlights

### Remote skill packages
- Install from catalog `packageUrl` (https zip / tar.gz only)
- Size limit (default 20 MiB), download timeout, optional SHA-256
- Extract rejects path escapes; requires `SKILL.md` under extract tree
- Does **not** run package scripts — data + instructions only

### Permission reliability
- Modal timeout → auto-deny after 10 minutes
- Worker crash / session fail / abort clears queue and unlocks composer
- `git_commit` shows commit message in the permission summary

### Docs
- README section on unsigned builds / SmartScreen

## Install

Manual download from GitHub Releases (unsigned — see README SmartScreen notes).

## Verify

- [ ] Skills store: item with `packageUrl` shows **远程安装**; install succeeds; overwrite path works
- [ ] Bad SHA-256 fails closed; `http://` packageUrl rejected
- [ ] Permission modal: second request queues; timeout path denies; fail/abort unlocks input
- [ ] `git_commit` ask mode shows message in modal
- [ ] `pnpm release:check` green
