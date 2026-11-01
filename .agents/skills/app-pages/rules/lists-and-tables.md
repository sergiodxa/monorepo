---
title: Lists and Tables
impact: CRITICAL
tags: [table, list, filters, url-state, selection, density, typed-cells]
---

# Lists and Tables

Most of an app's time is spent in a list: find the record, act on it, or act on many. A good list is a
query you can read, at a density you choose, with selection that costs nothing until you use it.

## One filter model, in the URL

- Every filter, the sort, the view and the density are search params, one param per filter. A filtered
  list is a link you can send; Back undoes the last filter; a reload keeps the view.
- Mouse users click facets, power users type; both write the same params.
- Facet popovers list values **with counts** ("Down 2 · Degraded 1 · Up 41").
- Applied filters show as chips `[Status][is][Down][✕]`; ✕ is a link to the URL without that param.
- "Clear filters [Esc]" appears only once something is applied.

## The toolbar

| Start | End |
| --- | --- |
| Count tabs ("Open 26 · Closed 2,828"), search (14–20rem, never the whole row), facet buttons with no chrome until hovered (dashed when empty) | Quiet status ("Updated 12:46"), then one **View** button |

Applied filters sit as chips on their own row below. A tab whose count is 0 stays, with its count muted,
so the reader sees the slice exists and is empty. At 375 the toolbar wraps to two lines; it never hides
filters.

**Row or View menu?** A control earns a place in the row when it changes _which records_ the list shows
and the reader reaches for it many times a session: tabs, search, facets. A control that changes _how
the same records are shown_ — sort, layout, grouping, density, visible properties, auto-refresh — goes
in the one View menu at the end (`FilterBar`'s `sort` and `options`), because it is set once and then
left alone. Status text ("Updated …") is neither: it goes in the `status` slot, small and muted, and is
the first thing dropped when the bar runs out of room.

## Density and rows

- Default ops lists to **compact ~40px rows**; offer **comfortable ~56px** in the display options.
  Measured references: GitHub Projects 37, Geist 40, Stripe 44, shadcn 49–53, Catalyst 57.
- The header sticks while the body scrolls. A wide table scrolls inside its own box, first column kept.
- One column is always sorted, and its header says so (`aria-sort`).
- At most one row action outside the kebab. Row actions reveal on hover where hover exists, and are
  always visible on touch. Destructive items go last, behind a divider.
- The whole row opens the record through the link in its first cell, without stealing clicks from
  checkboxes and menus.

## Cells have types

| Type | How it reads |
| --- | --- |
| Number | End-aligned, `tabular-nums`, unit muted ("182 ms") |
| Currency | Tabular amount, currency code muted after it |
| Id | Mono, middle-truncated, full value on hover and copy |
| Date | Relative up to 7 days ("2m ago"), absolute local + UTC on hover, the viewer's time zone |
| Status | Dot + word, tone from the status map |
| Proportion | An in-cell data bar, not a chart |
| Unknown | `—`, never `0` and never blank-by-accident |

Never show a time in UTC as if it were local; that was Uptime's "last checked" bug.

## Selection costs nothing until used

- Checkboxes in a narrow first column (or in the row's icon on hover, as Dub does). Select-all turns
  indeterminate; shift-click selects a range; `x` toggles the focused row.
- Selecting turns the floating footer ("Viewing 1–50 of 1,234") into the bulk bar ("✕ 7 selected |
  Pause P · Mute M · Delete ⌫"). It keeps the last count while it fades out, never flashes "0 selected".
- Esc clears the selection before it clears filters.
- Bulk actions are real form submits carrying the checked ids. A count with no bar (shadcn) is not
  selection.

## Live lists

- A list that refreshes itself says so: "Auto-refresh: 30s ▾", paused while the tab is hidden, with the
  last update time.
- Status dots change only when the state changes; a poll never flashes the row.
- Refetching dims the old rows in place (`aria-busy`); skeletons are for the first load only.

## Rules

1. Put list state in the URL; build the toolbar with `FilterBar`.
2. Give every cell a type; align numbers; write `—` for unknown.
3. Use `Table` selection with `SelectionBar`; never a count without actions.
4. Default to compact, offer comfortable.
