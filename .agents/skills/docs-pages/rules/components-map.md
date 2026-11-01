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

1. Source and JSDoc: `packages/ui/src/docs/<name>.tsx` (general pieces in `src/components/`); props on
   the namespace.
2. Guarantees: `<name>.browser.test.tsx` beside it.
3. Live catalogue: `https://sdxc.dev/api/ui/<name>` (listed under **Docs** in the catalogue sidebar).
4. Real use: `rg "<Name" apps/sdxc-site apps/uptime apps/reader`.
5. Overviews: sdxc.dev `/api/ui/docs-foundations` (what the namespace is for, its shared ideas
   and every variable it reads) and the demo gallery at `/demo`, which links each docs demo
   under `/demo/docs/{driftwood,lattice,tempo,parcelo}`.

## The docs kit

| Need | Use | Import |
| --- | --- | --- |
| The page shell: sidebar pinned header-to-viewport-foot, article measure, heading rail, footer slot, phone drawer and sticky bar | `DocsLayout` | `@sdxc/ui/docs` |
| Compact page footer over the article and rail: byline, feedback, edit link, one row of legal and site links | `DocsFooter` (into `DocsLayout footer`) | `@sdxc/ui/docs` |
| Sidebar: sections, folding groups, badges, current page scrolled into view, title filter, support footer | `DocsNav` (data: `DocsTree`) | `@sdxc/ui/docs` |
| "On this page" rail or phone bar with a sliding marker that reaches the last section | `TableOfContents` | `@sdxc/ui/docs` |
| Breadcrumb, h1, lead, plan notice, updated date, actions | `DocsPageHeader` | `@sdxc/ui/docs` |
| "Copy page" split button and Open-in menu | `PageActions` | `@sdxc/ui/docs` |
| Heading with `#` link, scroll margin, target flash | `AnchorHeading` | `@sdxc/ui/docs` |
| Hand-written next steps | `NextSteps` | `@sdxc/ui/docs` |
| Previous / next | `DocsPager` + `findNeighbours(tree, path, { boundary })` | `@sdxc/ui/docs` |
| "Was this helpful?" | `DocsFeedback` | `@sdxc/ui/docs` |
| Titled code with marked lines and copy | `CodeBlock` | `@sdxc/ui/docs` |
| Synced, remembered tabs over code | `CodeTabs`; install lines: `InstallCommand` | `@sdxc/ui/docs` |
| Note, tip, warning, danger | `Callout` | `@sdxc/ui/docs` |
| Numbered procedure | `Steps`, `Steps.Item` | `@sdxc/ui/docs` |
| Project layout | `FileTree` | `@sdxc/ui/docs` |
| Options and API fields, nested fields expanding | `PropsTable` | `@sdxc/ui/docs` |
| A control's name, a click path, a plan requirement (product docs) | `UiLabel`, `UiPath`, `PlanNotice` | `@sdxc/ui/docs` |
| Docs home routing by task | `DocsHub` | `@sdxc/ui/docs` |
| Docs 404 that searches | `DocsNotFound` + `searchQueryFromPath(path)` | `@sdxc/ui/docs` |
| Keys | `Keyboard`, one per key (it draws its children as one cap) | `@sdxc/ui` |
| Search match tint | `Highlight` | `@sdxc/ui` |

Islands the browser entry must map in `PACKAGE_MODULES`: `@sdxc/ui/docs/table-of-contents`,
`@sdxc/ui/docs/docs-nav-tools`, `@sdxc/ui/docs/copy-button`, `@sdxc/ui/docs/code-tabs-sync`,
`@sdxc/ui/docs/page-actions`, `@sdxc/ui/dialog-dismiss`. Everything else is server HTML.

## Contracts worth knowing

- `DocsLayout` sets `--ui-docs-scroll-margin` for the chrome it keeps sticky; pass `stickyTop` for a
  site header drawn around it, and `main={false}` when the app's layout already draws `<main>`.
- `DocsLayout` pins the docked sidebar from under `stickyTop` to the viewport's foot, and draws
  `footer` across the article and rail columns only. A docs page therefore drops the marketing
  site footer (`siteFooter={false}` or the app's equivalent); the sidebar never ends above a footer.
- `DocsLayout` caps running text (paragraphs, lists, headings, quotes, callouts, the page header) at
  `proseMeasure` (66ch) and lets code, images, tables, charts and disclosures fill `measure` (64rem);
  don't cap a page's prose yourself.
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
