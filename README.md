# HFQ Code

Windows desktop **coding agent** (WorkBuddy / ZCode class): full GUI, workspace-bound sessions, skills, MCP, multi-provider models, permissions & audit.

> Repo folder may still be named `HFQ_Clod-Agent`; product name is **HFQ Code**.

**Languages:** **English** · [简体中文](./README.zh-CN.md)

## Status

**1.1.6** — Windows coding agent (Phase-1+2 + Phase-3 + 1.0.x patch train + 1.1.x + F1 + compression LLM compact, goal sidecar, read_document, UI polish):

- Session loop: create / resume / stop / delete / rename + auto-title, streaming, tokens, compaction, **plan mode**, **sub-agents**
- **Session worker** (child process) for agent loop isolation; in-process fallback
- Access modes (变更前确认 / 自动编辑 / 计划 / 完全访问) · permission modal queue · timeout auto-deny
- Tools: `read_file` · `list_dir` · `grep` · `git_status` · `git_diff` · `git_show` · `git_commit` · `memory_*` · `write_file` · `apply_patch` · `shell` · `network_fetch` · `spawn_subagent` + live `mcp__*`
- Secrets in `credentials.json` (API keys / MCP auth headers)
- Memory 2.0 · Usage dashboard · Import wizard · `/goal` long-run + Tasks banner
- Skills store: curated catalog · local folder + **remote https zip/tar.gz** · SKILL.md preview / conflict / tags
- MCP: stdio + HTTP · Permissions + Audit · Changes · Terminal (one-shot) · Models
- Update check: multi-source fallback (ghproxy mirrors → ungh → direct GitHub); **manual download only** (D3 in-app download)
- Packaging: NSIS + portable · `pnpm release:check` / `pack:verify` · self-sign HFQ-ClodBreeze
- Providers: delete mock/last channel · empty fail-closed · `models:list` · baseURL normalize
- Session: open/send rebind to global active · identity pin against stale self-claims
- Chat UI: topbar provider · model · model-id-only composer control · menus open upward
- **1.1.6:** compression model drives LLM compact · goal `*.goals.json` cold-start · `read_document` (text/docx/pdf) · Settings `compactMaxChars` · profile chip hot update · mermaid streaming-safe · Tasks parent indent
- **1.1.5:** Coding Profiles (6 built-in) · mermaid chat rendering · skill progressive match · goal driver fields · memory links · bundled diagram skill
- **1.1.4:** abort isolation (only deny own session tree); live list enriched with `permissionMode`/`planMode`; permission queue (multi-session FIFO); Chat MessageBlock/copy/lazy routes/CSS tokens
- **1.1.3:** `listSessions` always exposes `model`/`providerId`; Tasks `goal_required` spawn cold-start; UI identity helpers

See [docs/PHASE3-STATUS.md](./docs/PHASE3-STATUS.md) · [docs/ROADMAP.md](./docs/ROADMAP.md) · [docs/PACKAGING.md](./docs/PACKAGING.md) · [docs/AUDIT.md](./docs/AUDIT.md) · [CHANGELOG.md](./CHANGELOG.md).

## Download & Windows SmartScreen

Official builds: [GitHub Releases](https://github.com/BB0813/HFQ-Code/releases) (NSIS installer + portable).

**Releases are Authenticode-signed with self-signed publisher `HFQ-ClodBreeze`** (not a commercial OV/EV cert). Windows may still show:

- 「无法验证发布者 / 未知发布者」 until the machine trusts the publisher root
- SmartScreen：「Windows 已保护你的电脑」 (reputation / new publisher)

This is expected for self-signed desktop apps, not a corrupt download. Details: [docs/PACKAGING.md](./docs/PACKAGING.md).

### What to do

1. Download only from **this repo’s Releases** (or a build you produced yourself).
2. Optionally verify the file against `SHA256SUMS.txt` on the same release.
3. In the open-file dialog, choose **运行**.
4. If SmartScreen appears: **更多信息 → 仍要运行**.
5. **NSIS install** may elevate and import the publisher trust pack (`resources/trust`). **Portable** users can run `resources/Launch-HFQ-Code.bat` or `Install-Trust.bat` (admin) once.

### Build / sign notes

| Approach | Effect |
|----------|--------|
| Confirm **运行 / 仍要运行** after checking the Release URL + SHA-256 | Practical for self-use and small internal tests |
| Use the **portable** build + trust launcher | Same publisher; optional silent trust import |
| Build from source (`pnpm pack:win`) with `HFQ_SIGN_ROOT` | Signs with local PFX; never commit `root.pfx` |
| `HFQ_SIGN_SKIP=1` | Unsigned local debug pack only |

Self-signed signing **does not** guarantee SmartScreen clearance. Commercial OV/EV certs + download reputation are a separate later option. Do **not** disable SmartScreen or UAC system-wide to “fix” this.

### Installer vs portable

| Artifact | Notes |
|----------|--------|
| `HFQ Code-*-x64.exe` | NSIS installer (per-machine; trust import on install) |
| `HFQ Code-*-portable.exe` | Portable; use `Launch-HFQ-Code.bat` for trust + start |
| `SHA256SUMS.txt` | Checksums for the above |

Update policy remains **manual**: in-app check → download → confirm open installer; no silent auto-install.

## Version history

Full notes: [CHANGELOG.md](./CHANGELOG.md). Release handoffs: `docs/RELEASE-*.md`.

| Version | Date | Summary |
|---------|------|---------|
| **[1.1.6](./docs/RELEASE-1.1.6.md)** | 2026-07-20 | Compression LLM compact · goal sidecar cold-start · `read_document` · compactMaxChars · UI polish (profile chip / mermaid stream / Tasks indent) |
| **[1.1.5](./docs/RELEASE-1.1.5.md)** | 2026-07-19 | Coding Profiles (6 built-in) · mermaid rendering · skill progressive match · goal driver fields · memory links · bundled diagram skill |
| **[1.1.4](./docs/RELEASE-1.1.4.md)** | 2026-07-19 | Abort permission isolation; live list access modes; permission queue; Chat MessageBlock+copy; lazy routes; CSS token migration |
| **[1.1.3](./docs/RELEASE-1.1.3.md)** | 2026-07-18 | Always expose session `model`/`providerId`; Tasks `goal_required` spawn cold-start; UI identity helpers; diagnostics test data-dir isolation |
| [1.1.2](./docs/RELEASE-1.1.2.md) | 2026-07-16 | Full product ship: 1.1.1 backend + Settings/Tasks/Changes/Models UI |
| [1.1.1](./docs/RELEASE-1.1.1.md) | 2026-07-16 | D3 install auto-download; `providerId`; Tasks children/spawn cold-start |
| [1.1.0](./docs/RELEASE-1.1.0.md) | 2026-07-16 | Provider lifecycle (delete mock); session model rebind + identity pin |
| [1.0.10](./docs/RELEASE-1.0.10.md) | 2026-07-17 | HFQ-ClodBreeze self-sign + trust pack; React shell; thinking / DPAPI / D3 / PTY backend train |
| [1.0.9](./docs/RELEASE-1.0.9.md) | 2026-07-15 | Remote Skills packages (zip/tar.gz); permission modal timeout + queue |
| [1.0.8](./docs/RELEASE-1.0.8.md) | 2026-07-15 | Topbar provider/model; model-id-only composer; menus open upward |
| [1.0.7](./docs/RELEASE-1.0.7.md) | 2026-07-15 | Update-check multi-source fallback (mirrors → ungh → direct) |
| [1.0.6](./docs/RELEASE-1.0.6.md) | 2026-07-15 | Skills preview/conflict/tags; `/goal` banner |
| [1.0.5](./docs/RELEASE-1.0.5.md) | 2026-07-15 | Update-check direct fallback; Skills store scaffold |
| [1.0.4](./docs/RELEASE-1.0.4.md) | 2026-07-14 | `/goal` long-run; default ghproxy update checks |
| [1.0.3](./docs/RELEASE-1.0.3.md) | 2026-07-14 | Chat UI polish (ZCode-style composer) |
| [1.0.2](./docs/RELEASE-1.0.2.md) | 2026-07-14 | Access modes; icon stamp; update check |
| [1.0.1](./docs/RELEASE-1.0.1.md) | 2026-07-14 | Logo / identity / data isolation |
| [1.0.0](./docs/RELEASE-1.0.0.md) | 2026-07-14 | First stable + CI/CD |

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
git tag -a v1.1.4 -m "HFQ Code 1.1.4"
git push origin v1.1.4   # triggers Release workflow
```

### Desktop try-out

1. `pnpm dev:desktop`
2. Open Workspace → select this repo
3. Session → New session
4. Explore **记忆 / 用量 / 导入** pages; plan mode + sub-agent on Chat toolbar
5. Tools: `list` / `read` / `git status` / write (approve) / MCP / shell

## License

TBD
