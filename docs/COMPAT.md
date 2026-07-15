# Compatibility Matrix

## Skills

### Supported (MVP)

- Directory containing `SKILL.md`
- YAML frontmatter with at least:
  - `name` (string)
  - `description` (string)
- Markdown body instructions
- `{baseDir}` placeholder → skill directory path
- Optional light OpenClaw gates:

```yaml
metadata:
  openclaw:
    os: ["win32", "linux", "darwin"]
    requires:
      bins: ["git"]
      env: []
      anyBins: []
```

### Load order (highest wins on name collision)

1. `<workspace>/skills`
2. `<workspace>/.agents/skills`
3. `%APPDATA%/HFQ-Code/skills` (user)
4. Bundled `skills/bundled`

Also scan `~/.agents/skills` as a **read-only import source** (ZCode / shared agent skills), without writing back.

### ClawHub-style store (1.0.5 scaffold)

| Capability | Status |
|------------|--------|
| Skills page **商店** tab + curated catalog | Done |
| Optional remote `skills/catalog.json` | Done (best-effort) |
| Install from local folder → user skills dir | Done |
| Remote package download / zip install | Not yet |
| Full ClawHub marketplace / publish | Not yet |

### Not in MVP

- Full `install` specs (brew/node/download UI)
- `command-dispatch: tool` slash bypass parity
- Node-hosted remote skills auto-run
- Publishing to ClawHub

## Project rules

| File | Behavior |
|------|----------|
| `AGENTS.md` | Primary; inject into system context |
| `CLAUDE.md` | If no AGENTS.md, or merge as secondary import |
| `.cursorrules` / `.cursor/rules` | Read-import when present |
| `SOUL.md` | Optional product persona (global), not required per repo |
| `TOOLS.md` | Ignored unless user enables “legacy tool notes” |

## Config migration (Phase 2 wizard)

One-shot import targets (read-only scan → copy into HFQ-Code dirs):

- `~/.openclaw/workspace/skills`
- `~/.openclaw/skills`
- `~/.agents/skills`
- Selected provider keys only with explicit user confirm

Never dual-write live config with OpenClaw.

## Protocols

| Protocol | Support |
|----------|---------|
| MCP | Client host; tools exposed to agent |
| OpenAI Chat Completions compatible | Yes |
| Anthropic Messages API | Yes |
| ACP-like local session HTTP | Internal Session API (own schema) |
| LSP | Later |

## Transcript

- Append-only JSONL per session under `%APPDATA%/HFQ-Code/sessions/`
- Externalize large tool payloads to `sessions/<id>/artifacts/`
- Export to portable JSON optional later
