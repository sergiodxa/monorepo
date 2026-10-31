---
name: docs-pages
description: Design, build, redesign or review documentation in this monorepo with taste — developer docs (guides, quickstarts, API and component reference, like sdxc.dev) and product help docs for non-developers (task and troubleshooting pages, like Uptime's or a reader app's). Teaches the judgment that makes docs good: one kind of page at a time, a sidebar and hub that route by task, search that answers questions, an "On this page" rail whose marker always knows where you are, a hand-written path to the next page, type set for long reading, code that names its file and fits the reader's setup, rich blocks used for their one job, motion only where state changes, and the small finish (anchors, copy feedback, Markdown twins, feedback, a 404 that searches). Use before planning or writing a docs layout, a docs component or a docs page, when redesigning docs, or when reviewing docs that "work but feel like a template".
---

# Docs pages

Good docs are fast to navigate and pleasant to read for an hour. The references below don't win on
features — they all have a sidebar, search and a TOC — they win on judgment: a search that has
somewhere to send you before you type, a TOC marker that slides to every section in view and reaches the
last one, a "Next steps" that follows from the task, a code block that is already in your package
manager. This skill teaches that judgment. The components are the easy part (@rules/components-map.md).

## When to apply

- Building or changing a docs shell, sidebar, search, TOC, pager or content component
- Writing or restructuring docs pages, for developers or for product users
- Reviewing docs before they ship, or after a reviewer said "it works"

## The references

Studied at 1440 and 375, light and dark, by using them (@rules/study-the-references.md):

- **Developer docs**: Fumadocs (shell, TOC band), Cloudflare Workers (TOC rail, procedures), Stripe
  (code walkthrough, choosers), Bun (search), shadcn/ui (routing, previews), Tailwind (steps, code),
  Next.js (switchers), Starlight (content components).
- **Product docs**: Notion Help Center (UI chips, troubleshooting), Linear (redrawn UI, plan notices),
  Readwise Reader (pages as the user's questions).

## Principles

### One kind of page at a time (CRITICAL) — @rules/structure-and-page-kinds.md

Tutorial, how-to, reference or concept; a page that is two kinds is two pages. The sidebar follows the
reader's journey two levels deep, the hub routes by task, every page has the same skeleton.

### Search is the front door (CRITICAL) — @rules/search.md

⌘K and `/`, somewhere to go before typing, results grouped by page with clean highlights and scopes, and
a no-results state that still helps.

### The TOC always knows where you are (CRITICAL) — @rules/on-this-page.md

A marker that slides to the sections in view, marks the last one at the bottom, stays inside the rail,
and survives on phones as a current-section bar.

### Hand the reader on (HIGH) — @rules/where-next.md

Hand-written next steps and choosers first; a pager whose whole card links to a named destination second.

### Set it for reading (HIGH) — @rules/reading-experience.md

16px / ~1.7, 60–75ch, headings clearly larger with room above, anchors on every heading, a designed dark
mode, nothing scrolling sideways at 320.

### Write for the task (HIGH) — @rules/write-for-the-task.md

Guides titled as tasks, the answer in the first sentence, copyable examples with believable values and
their results.

### Code that fits the reader (HIGH) — @rules/code-blocks.md

Titled with its file, copy without prompts, changed lines marked, mirrored tabs synced and remembered.

### Each block for its one job (HIGH) — @rules/rich-blocks.md

Steps for sequences, callouts rarely, file trees for structure, props tables for options, disclosures
for optional and troubleshooting material.

### Product docs meet non-developers (HIGH) — @rules/product-docs.md

Task and symptom pages in the reader's words, UI named with chips and → paths, cropped real screens, plan
notices, and a human one click away.

### Motion only where state changes (HIGH) — @rules/motion-and-finish.md

Marker, dialog, sheet, tab, copy, feedback: 150–300ms, ease-out, off under reduced motion. Then the
finish: `kbd` hints, focus rings, the sidebar opened at the current page.

### Quiet, living furniture (MEDIUM) — @rules/page-furniture.md

Breadcrumb, a muted actions row (Copy page, Open in Claude), Markdown twins and `llms.txt`, feedback,
last updated, a 404 that searches.

## Workflow

1. **Study** the reference for what you're building and note the moment to match.
2. **Plan the page**: its kind, its title as a task or name, its sections as questions, its next steps.
3. **Build** from `@sdxc/ui`; build missing pieces in the package, not the app, once two sites need them.
4. **Use it like a reader** at six widths in both themes, then turn each fix into a browser test
   (@rules/verify-like-a-reader.md).

## The bar

Put your page beside Fumadocs and Cloudflare. A body-only word finds it in search. The TOC marker follows
End, Home and a jump, and reaches the last section. The sidebar opens at the current page. The code is
in the reader's package manager after a reload. The page ends with where to go next. Nothing scrolls
sideways at 320, dark mode looks designed, and every motion stops under reduced motion.
