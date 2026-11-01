---
title: Detail Without Losing the List
impact: HIGH
tags: [detail, sheet, split-view, master-detail, property-list, timeline]
---

# Detail Without Losing the List

Opening a record should not throw away the list you found it in: its filters, its scroll, the next
record you will open. Pick one of three shapes by how people move through records.

| People… | Use | Example |
| --- | --- | --- |
| Glance at a record, then go back to the list | `DetailSheet`: a non-modal side sheet | Peek a monitor from the monitors list |
| Work through records one after another | `SplitView`: list and detail side by side, j/k swaps the detail | An inbox, a reader, triage |
| Spend a long time in one record | A full detail page with `PageHeader` | A monitor's own page, a post editor |

## The detail sheet

- The open record is in the URL (`?pane=monitor-42`), so a link opens it, a reload keeps it, Back closes
  it. Close is a link to the list URL.
- It is non-modal: the list behind stays clickable and scrollable. It never confirms a delete itself;
  that is a dialog's job.
- `n / N` with ↑↓ steps to the next record without closing. Copy link sits in the header.
- On phones it becomes a full-width panel or bottom sheet.

## Split view

- `sidebar | list | detail` on wide screens, `list | detail` with the sidebar as a sheet at ~1024px, and
  one pane per route below 768px. The URL decides which pane a phone shows; there is no drawer state.
- The split is a cookie preference, like the sidebar. The list keeps its scroll while the detail swaps.
- The detail pane has its own empty state: "Select a conversation", not a blank half-screen.

## The detail page

- Main column plus a 280–320px properties column (GitHub PR, WordPress, Sentry).
- **PropertyList** for facts: a fixed label column, values that are links, badges or avatars, and
  empty values named ("No reviewers", "None yet") rather than blank. An editable value opens a popover
  anchored to its row, with each option described.
- **Timeline** for history: a 2px rail, 16px icons, one line per event — avatar, bold actor, muted verb,
  relative time. Old events fold into "12 more events".
- The header compacts and sticks once you scroll past it.

## Rules

1. Choose sheet, split or page by how people move through records, then put the record in the URL.
2. Never make a detail view modal; never confirm inside a sheet.
3. Name every empty value.
