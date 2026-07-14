# HFQ Code

Windows desktop **coding agent** (WorkBuddy / ZCode class): full GUI, workspace-bound sessions, skills, MCP, multi-provider models, permissions & audit.

> Repo folder may still be named `HFQ_Clod-Agent`; product name is **HFQ Code**.

## Status

**1.0.1** — stable Windows coding agent (Phase-1+2 + Phase-3 M3.0/M3.1/M3.3/M3.4) + logo / model-identity / eval isolation patch:

- Session loop: create / resume / stop / delete / rename + auto-title, streaming, tokens, compaction, **plan mode**, **sub-agents**
- **Session worker** (child process) for agent loop isolation; in-process fallback
- Tools: `read_file` · `list_dir` · `grep` · `git_status` · `git_diff` · `git_show` · `git_commit` · `memory_*` · `write_file` · `apply_patch` · `shell` · `network_fetch` · `spawn_subagent` + live `mcp__*`
- Secrets in `credentials.json` (API keys / MCP auth headers)
- Memory 2.0 (user/project scope) · Usage dashboard · Import wizard
- MCP: stdio + HTTP (headers/auth) · ping · registry in `config.json`
- Permissions + Audit · Changes · Terminal · Tasks · Skills · Models
- Settings: theme / proxy / memory / pricing / diagnostics export
- Packaging: NSIS + portable · **manual update** · `pnpm release:check` / `pack:verify`
- Eval: `pnpm eval`

See [docs/PHASE3-STATUS.md](./docs/PHASE3-STATUS.md) · [docs/PACKAGING.md](./docs/PACKAGING.md) · [docs/AUDIT.md](./docs/AUDIT.md) · [CHANGELOG.md](./CHANGELOG.md).

## Decisions (frozen)

| Topic | Choice |
|-------|--------|
| Shell | Electron + TypeScript |
| Runtime | TypeScript agent-core (Python brain optional later) |
| Scenario | Coding agent first |
| Compat | Skills S1+light S2, own config + import wizard, MCP |
| Phase-1 UI | Session/Diff/Terminal, Skills, MCP, Tasks, Models, Permissions/Audit |

Details: [docs/DECISIONS.md](./docs/DECISIONS.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [docs/COMPAT.md](./docs/COMPAT.md) · [docs/PRODUCT.md](./docs/PRODUCT.md) · [docs/NAMING.md](./docs/NAMING.md) · [docs/BETA.md](./docs/BETA.md) · [docs/PHASE2.md](./docs/PHASE2.md) · [docs/PHASE3.md](./docs/PHASE3.md) · [docs/AUDIT.md](./docs/AUDIT.md)

## Monorepo

```text
apps/desktop          Electron app
packages/*            agent-core, tools, skills, mcp, memory, providers, ...
docs/                 product & architecture
skills/bundled        shipped skills
scripts/              eval harness
```

## Develop (after install)

```bash
pnpm install
pnpm -r run build
pnpm test
pnpm smoke
pnpm eval
pnpm dev:desktop
```

Requires: Node.js 22+, pnpm 9+.

### Packaging (Windows)

```bash
pnpm release:check                         # build + test + smoke + eval
pnpm pack:verify                           # unpacked dir smoke asserts
pnpm pack:win                              # NSIS + portable
```

Artifacts under `apps/desktop/release/`. Update policy: **manual** download/install — see [docs/PACKAGING.md](./docs/PACKAGING.md).

### CI / CD

| Workflow | When | What |
|----------|------|------|
| **CI** | push / PR to `main` | `pnpm release:check` (Windows) |
| **Release** | tag `v*` | pack NSIS + portable → GitHub Release |
| **Pack verify** | weekly / manual | `pnpm pack:verify` |

```bash
git tag -a v1.0.1 -m "HFQ Code 1.0.1"
git push origin v1.0.1   # triggers Release workflow
```

### Desktop try-out

1. `pnpm dev:desktop`
2. Open Workspace → select this repo
3. Session → New session
4. Explore **记忆 / 用量 / 导入** pages; plan mode + sub-agent on Chat toolbar
5. Tools: `list` / `read` / `git status` / write (approve) / MCP / shell

## License

TBD
