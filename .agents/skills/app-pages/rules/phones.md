---
title: Phones Are Their Own Layout
impact: HIGH
tags: [mobile, responsive, sheet, tables, touch]
---

# Phones Are Their Own Layout

An app on a phone is used for a different job: check, approve, triage. Shrinking the desktop screen
gets that job wrong. Each piece has a phone form.

| Desktop | Phone |
| --- | --- |
| Sidebar column or rail | A sheet from the menu button that closes when a link is followed |
| Mode rail (inbox, reader) | A bottom tab bar of four |
| Index sidebar (settings nav, folders) | The parent page; each section is its own route with a back link |
| Filter sidebar or facet row | Toolbar wraps to two lines, or facets move into one "Filters (2)" sheet |
| Split view | One pane per route; the URL picks the pane |
| Detail sheet | A full-width panel or bottom sheet |
| Properties column | A sheet behind a "Details" button, or stacked under the content |
| Data table | Scrolls inside its own box with the first column kept |
| Card-like list | Title and status, with a disclosure for the other columns |

- The page header shows a parent link only on narrow screens; wide screens have the breadcrumb.
- Controls scale for touch: 16px text in inputs (no zoom on focus), 44px targets
  (`--ui-target-size`), row actions always visible because there is no hover.
- At 320 nothing scrolls the page sideways. Long ids and URLs break or truncate.

## Rules

1. Design the phone form of every piece, from the table above.
2. Let the URL choose the pane on phones; avoid drawer state.
3. Test at 320 and 375 with touch emulation.
