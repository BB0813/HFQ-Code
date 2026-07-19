# HFQ Code 1.1.6

Full train over **1.1.5**: compression model actually drives compact, Goal tree cold-start sidecar, `read_document` tool + skill, Settings `compactMaxChars`, and post-F1 UI polish.

Canonical scope: [docs/prompts/1.1.6-full-train.md](./prompts/1.1.6-full-train.md) · handoff [1.1.6-handoff.md](./prompts/1.1.6-handoff.md) · audit [1.1.6-integration-audit.md](./prompts/1.1.6-integration-audit.md).

## Why 1.1.6

**1.1.5** shipped Coding Profiles and goal *fields*, but compression roles were reserved only, goals disappeared after process restart, and documents beyond plain text needed shell workarounds. **1.1.6** closes those gaps without a full Goal OS or Memory FTS rewrite.

## Highlights

### Compression LLM compact

- `prefs.modelRoles.compression` participates in context compact via `compactChatMessagesMaybeLlm`
- When a compression provider+model is set and the heuristic would compact, the head is summarized by that model
- Failure falls back to the existing heuristic compact path
- Observable system note: `[context compacted · llm]` (also emitted as a system `message.completed` for Chat)

### Goal tree sidecar

- Disk path: `%APPDATA%\HFQ-Code\sessions\<sessionId>.goals.json` (data dir layout)
- Upsert on `task.updated` for goal-kind / `goal:` titles
- Cold `open` / snapshot merges sidecar with history (newer `updatedAt` wins)
- `delete` session unlinks the sidecar
- Tasks UI: parentTaskId one-level indent; orphan parents still show as top-level

### `read_document` + document-read skill

- Workspace-bound tool: text / `.docx` (OOXML extract) / best-effort pure-JS `.pdf`
- Path escape rejected (same sandbox as other file tools)
- Bundled `skills/bundled/document-read/SKILL.md` nudges the agent to prefer this tool over shell converters

### Settings compact controls

- `compactMaxChars` number input (clamped 8_000–200_000)
- Compression copy clarifies: non-empty compression model → try LLM summary; empty → heuristic only

### UI polish

- Coding Profile Header chip hot-updates after Settings save
- Mermaid: streaming-safe (no run on incomplete fences); `securityLevel: "strict"` when complete
- Goal banner prefers `objective` text
- Shell surface density / empty-state copy on Memory & Permissions

## Install

GitHub Releases: NSIS (`HFQ Code-1.1.6-x64.exe`) + portable + `SHA256SUMS.txt`.

Prefer **1.1.6** over 1.1.5 for real compression, goal cold-start, and document reading.

## Update check (test path)

1. Keep a **1.1.5** (or older) install running
2. Publish this tag as GitHub **latest** with NSIS/portable assets
3. Settings → 检查更新 should report **1.1.6**
4. StatusBar / Settings shows **1.1.6**

## Verify

- [ ] `pnpm release:check` green
- [ ] Signed `HFQ Code.exe` when secrets / local `HFQ_SIGN_ROOT` present
- [ ] No `*.pfx` / password files in package tree
- [ ] Settings / status bar version **1.1.6**
- [ ] Settings: compression model + small `compactMaxChars` → long chat shows llm compact note (no model → heuristic only)
- [ ] `/goal …` → Tasks shows goal; kill app and reopen → goal still present; delete session → sidecar gone
- [ ] Workspace docx/md → agent can `read_document`; path escape rejected
- [ ] Change Coding Profile and save → Header chip updates immediately
- [ ] Streaming mermaid does not crash; complete fence renders
- [ ] 1.1.5 install sees **1.1.6** via update check after this is latest

## Out of scope (1.1.6)

- Memory inverted index / FTS5 (P2 remainder → 1.2+)
- Full Goal OS / multi-level drag tree / free dock layout
- Commercial OV/EV signing reputation
- PTY reattach polish, IM / OCR
