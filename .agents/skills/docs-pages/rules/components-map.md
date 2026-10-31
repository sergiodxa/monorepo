---
title: Components Map
impact: MEDIUM
tags: [components, sdxc-ui, reference]
---

# Components Map

Build docs from `@sdxc/ui` first. The shared docs pieces (shell, TOC, pager, callout, code block, steps,
file tree, props table, page actions, search) are being consolidated there from the two apps that each
grew their own copy; check `packages/ui/src/components/` and `packages/ui/src/patterns/` for what has
landed before writing anything, and update this file when a piece moves.

## Where to learn a component

1. Source and JSDoc: `packages/ui/src/{components,patterns}/<name>.tsx`; props on the namespace.
2. Guarantees: `<name>.browser.test.tsx` / `<name>.test.tsx` beside it.
3. Live catalogue: `https://sdxc.dev/api/ui/<name>`.
4. Real use: `rg "<Name" apps/sdxc-site apps/uptime`.

## Primitives that already exist

| Need | Start from |
| --- | --- |
| Sidebar, groups, current link, phone drawer | `Sidebar` (`Provider`, `Nav`, `Group`, `MenuLink`, `MobileNav`), `DialogDismiss` |
| Breadcrumb | `Breadcrumbs` |
| Prose | `Typeset preset="docs"` |
| Search dialog | `Dialog`, `Command`, `Highlight`, `Keyboard`, `SearchField` |
| Accordion / FAQ / disclosures | `Accordion`, `Disclosure`, native `<details>` |
| Tables | `Table` |
| Tree | `Tree` |
| Cards | `Card`, `Feature` |
| Titled code panel | `CodeStage` (pattern) |
| Install command tabs | `InstallTabs` (pattern) |
| Empty states, 404 | `Empty` |

Known traps: `Alert` is `role="alert"` (a live region), wrong for a static callout; `Tabs` is
route-based, not for code; `StepList` and `InstallTabs` are styled for landings; `Highlight`'s mark
needs to stay inside its glyphs.

## App-local pieces that show the bar today

sdxc.dev: `resources/components/{table-of-contents,docs-pager,page-actions,copy-markdown,code-block,code-tabs,install-command,option-groups,files,reference-table,component-preview,search-*}.tsx`.
Uptime: `resources/components/{docs-toc,docs-pager,docs-markdown,docs-copy-button,docs-start-card,docs-trail}.tsx`.
