# 1.1 · Changes + Git (backend contract)

Status: **B2-0 backend landed** (IPC + `packages/tools` git-ops)  
Date: 2026-07-15  
UI: frontend agent (Changes page commit panel / multi-file review)

## What shipped (backend)

| Layer | Content |
|-------|---------|
| `packages/tools/src/git-ops.ts` | Shared `runGit`, status/diff/show/commit + **stage/unstage** |
| Agent tools | Unchanged names: `git_status` / `git_diff` / `git_show` / `git_commit` (delegate to git-ops) |
| Desktop IPC | `git:status` · `git:diff` · `git:show` · `git:stage` · `git:unstage` · `git:commit` · `git:log` |
| Preload | `hfq.gitStatus` · `gitDiff` · `gitShow` · `gitStage` · `gitUnstage` · `gitCommit` · `gitLog` |

Session agent diffs (`diff.updated` / `state.changes`) are **unchanged** — still the primary “agent wrote this file” list.

## Frontend contract (`window.hfq`)

Requires bound workspace (main uses `workspacePath` if payload omits it).

```js
// Read-only
await hfq.gitStatus({ path?, includeLog?, maxEntries?, timeoutMs? })
// → { isRepo, branch, dirty, entries: [{ xy, path, origPath? }], head, recent?, … }
//   or { isRepo: false, error }

await hfq.gitDiff({ path?, staged?, maxBytes?, timeoutMs? })
// → { isRepo, staged, pathspec, bytes, truncated, diff }

await hfq.gitShow({ object?, path?, maxBytes?, timeoutMs? })
// → { isRepo, object, path, content, … }

// Mutating (human UI — still path-sandboxed; no amend / force / --no-verify)
await hfq.gitStage({ paths: string[], timeoutMs? })   // git add --
await hfq.gitUnstage({ paths: string[], timeoutMs? }) // restore --staged | reset HEAD --
await hfq.gitCommit({ message, paths?, timeoutMs? })  // optional paths = add then commit staged

await hfq.gitLog({ max?, path?, timeoutMs? })
// → { isRepo, entries: [{ sha, shortSha, subject, author, relativeDate, isoDate }], … }
```

Canonical frontend pack: [FRONTEND-IPC.md](./FRONTEND-IPC.md).

### Safety

- Paths resolved under workspace (`resolveWorkspacePath`); escape → throw  
- Flag-like pathspecs (`-rf`) rejected  
- Commit message cannot embed `--amend` / `--no-verify` / `--allow-empty`  
- No push / force-push / reset --hard APIs in 1.1  

### Suggested Changes UI wiring

1. **Agent changes pane** — keep existing `state.changes` + accept/revert  
2. **Repo status strip** — `gitStatus` on page open / after commit; show branch + dirty count  
3. **Stage panel** — list `entries`; stage/unstage selected paths  
4. **Commit** — message box → `gitCommit({ message, paths? })`; confirm before call  
5. **“让智能体修这个 diff”** — prefill composer with path + excerpt from `gitDiff` (frontend only)

## Non-goals (1.1)

- Magit-style hunk staging  
- Interactive rebase / merge conflict UI  
- Remote push/pull  
- Auto-commit from agent without permission mode gate (agent still uses `git_commit` tool + policy)

## Tests

- `packages/tools/src/git-ops.test.ts` — stage / unstage / commit + path sandbox  
- Existing hub git tests still cover tool surface  
