---
title: Rich Blocks
impact: HIGH
tags: [callouts, steps, cards, tables, accordions, file-tree, props-table, previews]
---

# Rich Blocks

Callouts, steps, cards, tabs and tables break up prose, and each has one job. Used for that job they
make a page scannable; used for variety they make it noisy. The test for every block: would a reader
skimming only the blocks still get the page's point?

## Why

- **A page of callouts is a page with no emphasis.** Starlight's asides are good because a page has one
  or two.
- **The right block replaces paragraphs.** A file tree replaces "create a folder called `routes` inside
  `app`, then…"; a props table replaces a paragraph per option.

## Which block for which content

| Content | Block | Notes from the references |
| --- | --- | --- |
| Sequence the reader performs | **Steps** | Starlight: a 28px numbered circle with a 1px inset ring, a 1px rail from the circle down that stops 6px short of the next one; content beside it. Tailwind puts each step's code beside the step at wide widths |
| Something the reader must not miss | **Callout** | Four kinds at most: note, tip, warning, danger, each with its own icon and colour. Bun's weight is right: 6% tint, 30% border, small radius. Starlight's 4px left border with saturated fill is louder. Static: no `role="alert"` |
| Where things go in a project | **File tree** | Starlight: folders as native `<details>`, per-type icons, the file being discussed as an accent pill, muted inline comments, `…` for "more files" |
| Choices that mirror each other (package manager, framework, OS) | **Tabs**, synced | One choice applies to every tab group with the same key and persists (Starlight's `syncKey` in localStorage; Fumadocs and shadcn the same; sdxc.dev uses a cookie so the server renders the right tab) |
| Routes onward or a set of options | **Cards** | Title + one line, whole card clickable, two or three columns. No icon-only cards with nothing to say |
| Every option of an API | **Props / reference table** | Name (code), type (code, muted), default, description. Required marked. Rows link-anchored. Wide types wrap, never truncate |
| Optional or edge-case material | **Accordion** | Stripe collapses optional steps ("Optional · Prefill customer data · Server-side"); Cloudflare puts troubleshooting in `<details>` right after the step it belongs to ("Seeing 523 errors?"); Fumadocs FAQ items each copy a deep link |
| A component or UI result | **Live preview** | shadcn: a framed demo with a short faded code peek and "View code" that expands in place |
| Labels on a heading | **Badge** | "Optional", "Server-side", "Team plan", "New". Small, muted, never a primary colour |

## Restraint

- One or two callouts per page. If everything is a warning, nothing is.
- Steps only for a sequence the reader does; a list of facts is a list.
- Cards only where there's something to choose; a paragraph with links is often better.
- Tabs only for alternatives; never hide a required step behind a tab the reader didn't pick.
- Nested blocks (a callout inside a step inside a tab) are a sign the page is two pages.

## Rules

1. Pick the block by the content's shape, using the table above.
2. Keep callouts rare, static and in four kinds.
3. Sync and persist tabs that mirror the same choice.
4. Put optional and troubleshooting material in disclosures next to the step it belongs to.
