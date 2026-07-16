# Developer Handoff — Obsidian Intelligence System

## Token mapping

| Design token | CSS variable | Tailwind |
|--------------|--------------|----------|
| `color.background.primary` | `--hfq-bg-primary` | `bg-hfq-bg-primary` |
| `color.background.secondary` | `--hfq-bg-secondary` | `bg-hfq-bg-secondary` |
| `color.background.surface` | `--hfq-bg-surface` | `bg-hfq-bg-surface` |
| `color.background.elevated` | `--hfq-bg-elevated` | `bg-hfq-bg-elevated` |
| `color.background.hover` | `--hfq-bg-hover` | `bg-hfq-bg-hover` |
| `color.text.primary` | `--hfq-text-primary` | `text-hfq-text-primary` |
| `color.text.secondary` | `--hfq-text-secondary` | `text-hfq-text-secondary` |
| `color.text.muted` | `--hfq-text-muted` | `text-hfq-text-muted` |
| `color.text.disabled` | `--hfq-text-disabled` | `text-hfq-text-disabled` |
| `color.brand.cyan` | `--hfq-brand-cyan` | `text-hfq-brand-cyan` / `bg-hfq-brand-cyan` |
| `color.brand.blue` | `--hfq-brand-blue` | `bg-hfq-brand-blue` |
| `color.brand.purple` | `--hfq-brand-purple` | `bg-hfq-brand-purple` |
| `color.status.success` | `--hfq-success` | `text-hfq-success` |
| `color.status.warning` | `--hfq-warning` | `text-hfq-warning` |
| `color.status.error` | `--hfq-error` | `text-hfq-error` |
| `color.border.default` | `--hfq-border-default` | `border-hfq-border` |
| `color.border.strong` | `--hfq-border-strong` | `border-hfq-border-strong` |
| `color.border.focus` | `--hfq-border-focus` | `border-hfq-border-focus` |

Spacing (8px grid): `4 8 12 16 20 24 32 40 48 64` → Tailwind `p-1`…`p-16` mapped in `tailwind.config.js`.

Radius: `sm 6` · `md 8` · `lg 12` · `xl 16`.

## Component mapping (Figma-style → React)

| Design system name | React |
|--------------------|--------|
| `Button.Primary` | `<Button variant="primary">` |
| `Button.Secondary` | `<Button variant="secondary">` |
| `Button.Ghost` | `<Button variant="ghost">` |
| `Button.Outline` | `<Button variant="outline">` |
| `Button.Danger` | `<Button variant="danger">` |
| `Button.AI` | `<Button variant="ai">` |
| `Button.Icon` | `<IconButton>` |
| `Input.Text` | `<Input>` |
| `Input.Search` | `<SearchInput>` |
| `Input.Textarea` | `<Textarea>` |
| `Badge.*` | `<Badge tone="ok\|warn\|cyan\|violet\|danger">` |
| `Card.Basic` | `<Card>` |
| `Card.Project` | `<ProjectCard>` |
| `Card.Metric` | `<MetricCard>` |
| `Card.AI` | `<AISuggestionCard>` / AI cards |
| `Shell.DesktopWindow` | `<DesktopWindow variant="normal\|maximized\|floating">` |
| `Shell.TitleBar` | `<TopBar>` |
| `Shell.Sidebar` | `<Sidebar>` |
| `Shell.StatusBar` | `<StatusBar>` |
| `Nav.Item` | sidebar `NavItemDef` |
| `AI.CommandBar` | `<AICommandBar>` |
| `AI.PromptBox` | `<AIPromptBox>` |
| `AI.ChatBubble` | `<AIChatBubble role="user\|assistant">` |
| `AI.Thinking` | `<AIThinkingIndicator>` |
| `AI.AgentStatus` | `<AIAgentStatus state="…">` |
| `AI.TaskCard` | `<AITaskCard>` |
| `AI.DiffViewer` | `<AIDiffViewer>` |
| `AI.ApprovalDialog` | `<AIApprovalDialog>` |
| `AI.ModelSelector` | `<AIModelSelector>` |
| `Editor.FileTree` | `<FileTree>` |
| `Editor.Tab` | `<EditorTabs>` |
| `Editor.CodeBlock` | `<CodeBlock>` |
| `Terminal.Window` | `<TerminalWindow>` |
| `Git.BranchSelector` | `<BranchSelector>` |
| `Git.CommitCard` | `<CommitCard>` |
| `Git.ChangeFile` | `<ChangeFile>` |
| `Git.PullRequestCard` | `<PullRequestCard>` |
| `Overlay.Modal` | `<Modal>` |
| `Overlay.CommandPalette` | `<CommandPalette>` |
| `Overlay.Toast` | `<Toast>` |

## Layout (from prototype, not Figma nodes)

| Region | Spec |
|--------|------|
| Desktop canvas | 1440×900 |
| Top bar | 48px · 3-column: brand \| command search \| actions |
| Sidebar | 240px · sections Workspace / AI / Development / Tools / System |
| Status bar | 28px mono |
| Page padding | 20–24px (`px-6 pt-5 pb-7`) |

## Screens wired

01 Dashboard · 02 Projects · 03 Repos · 04 AI Agent · 05 AI Chat · 06 Tasks · 07 Editor · 08 Terminal · 09 Debugger · 10 Git · 11 Review · 12 Plugins · 13 Marketplace · 14 Settings · 15 Account · Notifications · Search · Design System gallery

## Integrity note

Figma MCP was **not** used: link `https://www.figma.com/design/xxxxx/Name?node-id=1-2` is invalid, and the user instruction was **「不调用MCP 直接写出来整套」**. Re-run with a real `fileKey` + `node-id` if pixel-perfect node extraction is required.
