# Adopt Kivio Desktop + AthenaOS designs into HFQ Code

Status: **active**  
Baseline: HFQ Code **1.1.4**  
Last updated: 2026-07-19

## Positioning (unchanged)

HFQ Code remains a Windows-first **desktop coding agent** (workspace plan → edit → run → review).

- **Not** a general productivity assistant shell (Kivio’s full product shape)
- **Not** a free-form multi-panel Agent OS as the default UI (Athena’s full product shape)
- References supply **capability patterns**, not UI clones

See [DECISIONS.md](./DECISIONS.md) Q2/Q3 and [ARCHITECTURE.md](./ARCHITECTURE.md).

## Source products (local installs reviewed)

| Product | Install path (this machine) | Product shape |
|---------|----------------------------|---------------|
| **Kivio Desktop** | `%LOCALAPPDATA%/Kivio Desktop` + `%APPDATA%/com.zmair.kivio` | Multi-assistant chat + skills + knowledge + desktop utilities |
| **AthenaOS** | `%LOCALAPPDATA%/AthenaOS` | Dockable agent workbench + Goal Driver + CogNet vault |

## What we adopt

### From Kivio (coding-relevant only)

| Pattern | HFQ adoption | Non-goal |
|---------|--------------|----------|
| Builtin assistant matrix | **Coding Profiles** (Refactor / Debug / Review / Docs / Frontend / Research) | Writing/email/translator as first-class products |
| Skill binding per assistant | Profile `skillIds` + progressive skill body inject | Always load every skill body |
| Chat mermaid / rich code | `MarkdownMessage` with mermaid + fenced code | Full HTML live preview sandbox |
| Model role split | `prefs.modelRoles`: chat / title / compression | Separate image/advisor stacks in v1 |
| Document skills | Bundled `diagram` (+ later pdf/docx read path) | Himalaya mail, Obsidian vault product |
| Lens / screenshot translate | — | Explicitly out of scope |

### From Athena (coding-relevant only)

| Pattern | HFQ adoption | Non-goal |
|---------|--------------|----------|
| Goal Driver tree | Light **goal fields** on `task.updated` / `UiTask` | Full goals.db product port |
| Acceptance / blocked / retry | Optional driver fields on goals | Persistent multi-tenant goal OS |
| CogNet notes/links/tags | Memory `links` + tag-aware search (file brain first) | Second Obsidian product |
| Dockable multi-panel layout | Optional panel prefs later; keep Layout A default | Replace frozen Layout A |
| Runtime knobs | Prefer existing prefs; advanced compact UI later | Expose every Athena runtime null field |

## Phased delivery

### Track F1 — 1.1.x patch (this train)

1. **Docs** — this file + ROADMAP/DECISIONS hooks  
2. **Chat markdown + mermaid** — agent messages render GFM + mermaid fences  
3. **Coding Profiles** — config schema + prefs IPC + Settings UI  
4. **Model roles** — title / compression optional provider+model (fallback = active chat model)  
5. **Skill progressive match** — rank by user text; inject top-K skill **bodies** under index  
6. **Goal driver fields** — extend `task.updated` for kind/objective/progress/budget/blockedReason  
7. **Memory links** — optional `links[]` on notes; surface in search/prompt  
8. **Bundled `diagram` skill** — mermaid-first architecture diagrams for coding sessions  

### Track F2 — 1.2+

- Goal parent/children persistence (sidecar like spawn-attempts)  
- Memory FTS5 dual-write (keep JSON export)  
- pdf/docx/xlsx read skills (workspace/safe-copy path, no Pyodide requirement if Node path works)  
- Optional dockable drawer composition prefs  
- Advanced compact circuit-breaker UI  

## Config shapes (additive, backward compatible)

```ts
// prefs.codingProfiles[]
{
  id: string
  name: string
  description?: string
  icon?: string
  systemAddon?: string          // appended to system prompt
  skillIds?: string[]          // soft preference for progressive inject
  permissionMode?: PermissionMode
  providerId?: string          // empty = use global active
  model?: string
  builtIn?: boolean
}

// prefs.activeCodingProfileId?: string

// prefs.modelRoles
{
  title?: { providerId?: string; model?: string }
  compression?: { providerId?: string; model?: string }
}

// prefs.skillMatch
{
  enabled?: boolean            // default true
  maxBodies?: number           // default 2
  maxBodyChars?: number        // default 6000
}
```

## Event / task shape (additive)

`task.updated` optional fields:

| Field | Meaning |
|-------|---------|
| `kind` | `"goal"` \| `"tool"` \| `"subagent"` |
| `objective` | Full goal text |
| `progress` | 0–100 when known |
| `budget` | `{ maxRounds?, maxToolCalls? }` |
| `parentTaskId` | Goal tree edge |
| `blockedReason` | Why paused/blocked |
| `acceptance` | Short acceptance criteria string |

UI and history ignore unknown fields safely (zod optional).

## Security / product constraints

- Workspace path-escape rejection unchanged  
- Secrets stay in `credentials.json` / DPAPI  
- Mermaid render is **client-side SVG only** — no arbitrary HTML execution from model output  
- Coding Profiles must not weaken default permission mode unless user picks a profile that sets it  
- Do not ship Kivio API keys or Athena auth tokens from local installs into this repo  

## Explicit non-goals (near term)

- Multi-channel IM gateway  
- Screenshot OCR translation as core loop  
- Email connector  
- Replacing Layout A with free-form IDE mosaic as default  
- Silent auto tool YOLO as product default  

## Implementation map

| Feature | Primary insertion |
|---------|-------------------|
| Mermaid chat | `apps/desktop/renderer/src/features/chat/` |
| Profiles / model roles | `packages/config/src/schema.ts`, Settings UI, session create |
| Skill match | `packages/skills` + `agent-core` `rebuildSystemPrompt` / send path |
| Goal fields | `packages/shared/events.ts`, `history.ts`, `loop.ts`, Chat/Tasks UI |
| Memory links | `packages/memory`, `tools` memory_save/search |
| Diagram skill | `skills/bundled/diagram/SKILL.md` |

## Acceptance (F1)

- [x] Decision doc linked from ROADMAP + DECISIONS  
- [x] Agent message with mermaid fences renders via `MarkdownMessage`  
- [x] Built-in coding profiles selectable in Settings  
- [x] Skill progressive match + body inject in agent-core  
- [x] `/goal` emits `kind: "goal"` (+ objective/budget/progress) on `task.updated`  
- [x] Memory notes accept optional `links` (+ tags surface)  
- [x] Bundled `diagram` skill shipped  
- [x] `session:create` / `session:open` both inject profile + skillMatch + model roles; open permissionMode aligns with create (payload > profile > prefs)  
- [x] Goal driver fields rebuild into `snapshot.tasks` (history + session tests)  
- [x] `pnpm test` green for touched packages (integration)  
