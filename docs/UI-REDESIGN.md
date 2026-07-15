# UI redesign roadmap (TODO)

Status: **tracked for post-1.0.5** · Started noting in 1.0.5  
Last updated: 2026-07-15

## Why

`apps/desktop/renderer/app.js` is a large single-file page router (~4.5k+ lines). Chat polish (1.0.3) and Skills store (1.0.5) already strain maintainability. A gradual redesign should improve density, navigation, and component boundaries without a big-bang rewrite.

## Principles

1. **Ship-compatible** — redesign in slices; keep Electron IPC and agent-core contracts stable  
2. **Anti-slop** — keep HFQ dark-tech cyan cockpit language (`styles.css` tokens); no generic AI-purple  
3. **Chinese product UI** — labels stay CN; code/docs EN ok  
4. **No IM-gateway drift** — coding-agent workbench first  

## Phases (TODO checklist)

### R0 — Inventory (docs only) ✅ 1.0.5
- [x] Record this roadmap  
- [x] Note hotspots: `app.js` pages, chat composer, Skills store tabs, Settings update panel  

### R1 — Shell structure
- [ ] Split renderer into modules: `nav.js`, `pages/*`, `chat/*`, `settings/*` (still vanilla or light bundler)  
- [ ] Shared layout primitives: panel head, empty state, seg-tabs, data tables  
- [ ] Keyboard map doc (focus traps for modal / palette)  

### R2 — Chat / Session redesign
- [ ] Message virtualization for long transcripts  
- [ ] Tool-call cards with collapsible I/O  
- [ ] Sticky composer + clearer permission mode / model chips  
- [ ] Goal turn banner (budget + stop) first-class, not only system text  

### R3 — Skills / ClawHub store visual system
- [ ] Store grid polish (cover/icon optional, category rails)  
- [ ] Install progress + conflict UI  
- [ ] Detail drawer for SKILL.md preview  
- [ ] Remote package install (after security review)  

### R4 — Home / Tasks / Changes
- [ ] Home as “resume work” dashboard (recent + running goals)  
- [ ] Tasks tree for sub-agents + goals  
- [ ] Changes multi-file review layout (side-by-side optional)  

### R5 — Optional React / solid migration
- [ ] Only if R1 module split proves insufficient  
- [ ] Prefer incremental islands over full rewrite  

## Non-goals (near term)

- Full design-system package publish  
- Mobile / web SaaS shell  
- Theming marketplace  

## Related

- Product map: [PRODUCT.md](./PRODUCT.md)  
- Phase-3 backlog: [PHASE3-STATUS.md](./PHASE3-STATUS.md)  
- Skills compatibility: [COMPAT.md](./COMPAT.md)  
