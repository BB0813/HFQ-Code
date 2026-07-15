# HFQ Code

Windows desktop **coding agent** (WorkBuddy / ZCode class): full GUI, workspace-bound sessions, skills, MCP, multi-provider models, permissions & audit.

> Repo folder may still be named `HFQ_Clod-Agent`; product name is **HFQ Code**.

## Status

**1.0.9** — Windows coding agent (Phase-1+2 + Phase-3 M3.0/M3.1/M3.3/M3.4) with post-1.0 patch train:

- Session loop: create / resume / stop / delete / rename + auto-title, streaming, tokens, compaction, **plan mode**, **sub-agents**
- **Session worker** (child process) for agent loop isolation; in-process fallback
- Access modes (变更前确认 / 自动编辑 / 计划 / 完全访问) · permission modal queue · timeout auto-deny
- Tools: `read_file` · `list_dir` · `grep` · `git_status` · `git_diff` · `git_show` · `git_commit` · `memory_*` · `write_file` · `apply_patch` · `shell` · `network_fetch` · `spawn_subagent` + live `mcp__*`
- Secrets in `credentials.json` (API keys / MCP auth headers)
- Memory 2.0 · Usage dashboard · Import wizard · `/goal` long-run + Tasks banner
- Skills store: curated catalog · local folder + **remote https zip/tar.gz** · SKILL.md preview / conflict / tags
- MCP: stdio + HTTP · Permissions + Audit · Changes · Terminal (one-shot) · Models
- Update check: multi-source fallback (ghproxy mirrors → ungh → direct GitHub); **manual download only**
- Packaging: NSIS + portable · `pnpm release:check` / `pack:verify`
- Chat UI: topbar provider · model · model-id-only composer control · menus open upward

See [docs/PHASE3-STATUS.md](./docs/PHASE3-STATUS.md) · [docs/ROADMAP.md](./docs/ROADMAP.md) · [docs/PACKAGING.md](./docs/PACKAGING.md) · [docs/AUDIT.md](./docs/AUDIT.md) · [CHANGELOG.md](./CHANGELOG.md).

## Download & Windows SmartScreen

Official builds: [GitHub Releases](https://github.com/BB0813/HFQ-Code/releases) (NSIS installer + portable).

**Current releases are not Authenticode code-signed.** Windows may show:

- 「无法验证发布者 / 未知发布者」
- SmartScreen：「Windows 已保护你的电脑」

This is expected for unsigned desktop apps, not a corrupt download.

### What to do

1. Download only from **this repo’s Releases** (or a build you produced yourself).
2. Optionally verify the file against `SHA256SUMS.txt` on the same release.
3. In the open-file dialog, choose **运行**.
4. If SmartScreen appears: **更多信息 → 仍要运行**.

### Free alternatives (no paid certificate)

| Approach | Effect |
|----------|--------|
| Confirm **运行 / 仍要运行** after checking the Release URL + SHA-256 | Practical for self-use and small internal tests |
| Use the **portable** build | Same trust model; often fewer reinstall prompts |
| Build from source (`pnpm pack:win`) | You trust your own tree; the resulting exe is still unsigned |
| Self-signed certificate | Does **not** remove the warning (Windows does not trust it by default) |

There is **no reliable free way** to make Windows show a verified publisher for public `.exe` downloads. Paid OV/EV code signing is planned later ([docs/ROADMAP.md](./docs/ROADMAP.md) Track D · 1.2). Do **not** disable SmartScreen or UAC system-wide to “fix” this.

### Installer vs portable

| Artifact | Notes |
|----------|--------|
| `HFQ Code-*-x64.exe` | NSIS installer |
| `HFQ Code-*-portable.exe` | Portable; no install wizard |
| `SHA256SUMS.txt` | Checksums for the above |

Update policy remains **manual**: in-app check → open download page; no silent auto-install.

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
