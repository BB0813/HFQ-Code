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
