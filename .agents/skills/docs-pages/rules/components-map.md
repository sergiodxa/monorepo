---
title: Components Map
impact: MEDIUM
tags: [components, sdxc-ui, reference]
---

# Components Map

Build docs from `@sdxc/ui` first. The shell, navigation and content blocks below are shared by
sdxc.dev, Uptime and the reader app; a piece a docs site needs that is missing here belongs in the
package once two sites need it, not in one app.

## Where to learn a component

1. Source and JSDoc: `packages/ui/src/{components,patterns}/<name>.tsx`; props on the namespace.
2. Guarantees: `<name>.browser.test.tsx` beside it.
3. Live catalogue: `https://sdxc.dev/api/ui/<name>` (listed under **Docs** in the catalogue sidebar).
4. Real use: `rg "<Name" apps/sdxc-site apps/uptime apps/reader`.

## The docs kit

| Need | Use | Import |
| --- | --- | --- |
| The page shell: docked sidebar, article measure, heading rail, phone drawer and sticky bar | `DocsLayout` | `@sdxc/ui/patterns` |
| Sidebar: sections, folding groups, badges, current page scrolled into view, title filter, support footer | `DocsNav` (data: `DocsTree`) | `@sdxc/ui`, `@sdxc/ui/utils` |
| "On this page" rail or phone bar with a sliding marker that reaches the last section | `TableOfContents` | `@sdxc/ui` |
| Breadcrumb, h1, lead, plan notice, updated date, actions | `DocsPageHeader` | `@sdxc/ui` |
| "Copy page" split button and Open-in menu | `PageActions` | `@sdxc/ui` |
| Heading with `#` link, scroll margin, target flash | `AnchorHeading` | `@sdxc/ui` |
| Hand-written next steps | `NextSteps` | `@sdxc/ui` |
| Previous / next | `DocsPager` + `findNeighbours(tree, path, { boundary })` | `@sdxc/ui`, `@sdxc/ui/utils` |
| "Was this helpful?" | `DocsFeedback` | `@sdxc/ui` |
| Titled code with marked lines and copy | `CodeBlock` | `@sdxc/ui` |
| Synced, remembered tabs over code | `CodeTabs`; install lines: `InstallCommand` | `@sdxc/ui` |
| Note, tip, warning, danger | `Callout` | `@sdxc/ui` |
| Numbered procedure | `Steps`, `Steps.Item` | `@sdxc/ui` |
| Project layout | `FileTree` | `@sdxc/ui` |
| Options and API fields, nested fields expanding | `PropsTable` | `@sdxc/ui` |
| A control's name, a click path, a plan requirement (product docs) | `UiLabel`, `UiPath`, `PlanNotice` | `@sdxc/ui` |
| Docs home routing by task | `DocsHub` | `@sdxc/ui/patterns` |
| Docs 404 that searches | `DocsNotFound` + `searchQueryFromPath(path)` | `@sdxc/ui/patterns` |
| Keys | `Keyboard`, one per key (it draws its children as one cap) | `@sdxc/ui` |
| Search match tint | `Highlight` | `@sdxc/ui` |

Islands the browser entry must map in `PACKAGE_MODULES`: `@sdxc/ui/table-of-contents`,
`@sdxc/ui/docs-nav-tools`, `@sdxc/ui/copy-button`, `@sdxc/ui/code-tabs-sync`,
`@sdxc/ui/page-actions`, `@sdxc/ui/dialog-dismiss`. Everything else is server HTML.

## Contracts worth knowing

- `DocsLayout` sets `--ui-docs-scroll-margin` for the chrome it keeps sticky; pass `stickyTop` for a
  site header drawn around it, and `main={false}` when the app's layout already draws `<main>`.
- `TableOfContents` reads where a section starts from the first heading's `scroll-margin-top`, so the
  marker and a jump agree; `minItems` (2) also decides whether `DocsLayout` draws a rail.
- `CodeTabs persist="cookie"` stores `ui-code-tabs.<syncKey>`; read it on the server with
  `readCodeTabsCookie(cookieHeader, syncKey)` and pass `selected` so the page renders the choice.
- `DocsFeedback` posts `helpful`, `page` and `note` (`DOCS_FEEDBACK_*_FIELD`); the app owns the handler.
- `Callout` is an aside named by its `label`; `Alert` is `role="alert"`, wrong for a static note.

## Not shared yet

Search (`SearchDialog`, `SearchTrigger`) is still app code: sdxc.dev's ⌘K dialog in
`apps/sdxc-site/resources/components/search-*.tsx`. Component pages' live preview with a code peek
stays in sdxc.dev's `component-preview.tsx`.
