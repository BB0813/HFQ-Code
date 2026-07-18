# HFQ Code — project agent rules

## Product

- Name: **HFQ Code** (`hfq-code`)
- Windows desktop coding agent (Electron + TypeScript)
- Not an IM gateway product

## Code style

- Match surrounding packages: TypeScript ESM, strict types, small focused modules
- Workspace-scoped tools must reject path escapes
- Do not commit secrets or real API keys

## Layout

- `apps/desktop` — Electron shell + UI
- `packages/*` — agent-core, tools, skills, providers, policy, …
- `docs/*` — architecture and product decisions
- `skills/bundled` — shipped skills

## Before large changes

- Read `docs/DECISIONS.md` and `docs/ARCHITECTURE.md`
- Keep Phase-1 scope unless the user expands it

## Orchestrator handoffs (frontend / backend agents)

When acting as the **统筹 Agent** and the user will forward work to a separate **前端 / 后端** implementation agent:

1. **Always save the handoff as a file** under `docs/prompts/` — never only paste a long prompt in chat.
2. **One undivided prompt per train** — FE and BE share the same file (contracts + acceptance stay aligned). Do not split into drifting `fe.md` / `be.md` pairs.
3. Naming: `{track-or-topic}-{short-slug}.md` (optional date prefix on major revisions). Index + rules: `docs/prompts/README.md`.
4. Reply to the user with the **file path** (and a short summary); the file is the source of truth they copy into the other agent.
5. No secrets in prompt files.
