# @hfq/obsidian-ui

**HFQ Code v1.0 · Obsidian Intelligence System**  
React + Tailwind design system & desktop app prototype (1440×900).

## Source of truth

| Source | Role |
|--------|------|
| Design spec paste (PART 1–7) | Tokens, component catalog, screens |
| `docs/design-proposals/hfq-v1-obsidian/` | Pixel/layout reference (HTML/CSS prototype) |
| Figma URL in request | **Placeholder** (`xxxxx`) — MCP **not** called |

> Layout and tokens are **not guessed from a live Figma node tree**. They match the shipped Obsidian prototype + the written design system spec.

## Quick start

```bash
# from monorepo root
pnpm install
pnpm --filter @hfq/obsidian-ui dev
# → http://localhost:5179
```

## Structure

```
src/
  tokens/          # TS token objects + cssVarMap handoff
  styles.css       # CSS variables + Tailwind layers
  components/
    ui/            # Button, Input, Badge, Card, …
    shell/         # DesktopWindow, TopBar, Sidebar, StatusBar
    ai/            # Agent / chat / diff / approval
    editor/        # File tree, tabs, code block
    terminal/      # Terminal window + tabs
    git/           # Branch, commit, PR, changes
    overlay/       # Modal, CommandPalette, Toast
  screens/         # 15 application screens
  App.tsx          # Assembled desktop shell
```

## Handoff

See [HANDOFF.md](./HANDOFF.md) for Figma→React and token→CSS maps.
