---
title: Feedback and States
impact: HIGH
tags: [toast, banner, confirm, empty, loading, error, skeleton]
---

# Feedback and States

Feedback belongs where the user is already looking. Every state a region can be in (empty, loading,
refreshing, failed) is designed on purpose, typed by its cause.

## Where feedback goes, in order

1. **Inline**, next to the control that caused it ("Couldn't verify domain" under the field).
2. **Inside the dialog**, which stays open, rather than closing it and toasting.
3. **A banner** for account state that needs resolving (billing failed, an integration broke): above the
   frame, pushing it down, non-dismissible until fixed, one at a time, with the fixing action.
4. **A toast**, last: the outcome of something that left the screen.

## Toasts

- Past participle, six words or fewer: "Monitor deleted". The toast's verb matches the button's verb.
- Undo instead of "Are you sure?" for reversible destructive actions; hold it 5–10s.
- One toast per flow. A long operation updates one toast in place (pending → done or failed).
- Errors end with what to do: "Couldn't pause monitor. Try again."
- Server flash messages land in the same region as client toasts: one system per app.
- Stack bottom-end, three visible, back toasts peeking at 0.95/0.9, fanning out on hover.

## Confirm only what can't be undone

- Title names the action and the item type: "Delete monitor?". The body names the item. The button
  repeats the action: "Delete monitor". Focus starts on Cancel.
- Type-the-name only for big, irreversible things (a team, a domain). On routine deletes it reads as
  melodrama; offer Undo instead.

## Empty states by cause

| Cause | What it shows |
| --- | --- |
| First run | A welcome, what this list will hold, one action ("Create monitor") |
| No results | The query quoted, "Clear filters"; the toolbar stays with its zero counts |
| Cleared | "All caught up" — a small reward, no action |
| No permission | Who can grant it |
| Failed | What failed, Retry, a copyable request id |

Inside a card or table body use the compact size; a full-page empty state inside a small card shouts.

## Loading by expected wait

- Under 1s: nothing. 1–3s: indeterminate. 3–10s: determinate. Over 10s: a background task with a toast
  when done.
- Skeletons match the real shape and row height (`Skeleton.Row`, `Skeleton.Stat`), so nothing shifts.
- Refetching dims the old content in place; it never swaps a full list for skeletons.
- An error replaces only its region, with Retry. Never a full-page dialog over a skeleton.

## Rules

1. Inline, then dialog, then banner, then toast.
2. Undo over confirm; confirm names the thing.
3. Give each empty state its cause; keep the toolbar on no-results.
4. Dim on refetch; skeleton only on first load; errors stay in their region.
