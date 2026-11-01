---
title: Verify Like a User
impact: HIGH
tags: [verification, testing, browser-tests, responsive, keyboard]
---

# Verify Like a User

An app screen is done when you have worked in it: found a record, filtered, selected, acted, undone,
saved a form wrong and then right, at every width, in both themes, by keyboard alone.

## The pass

1. Run the app's dev server with seeded data (Uptime has a development login; sdxc.dev's catalogue
   previews need none) and open the screen beside its reference.
2. At 320, 375, 768, 1024, 1280 and 1440, light then dark: no horizontal page scroll; tables scroll in
   their box; sticky header, page header and table header never overlap; the shell switches rail ↔
   sheet at 767/768 with the collapse cookie set.
3. **Use it**:
   - Reload with the sidebar collapsed: nothing jumps.
   - Apply two filters, copy the URL into a new tab, press Back: same view, then one filter fewer.
   - Select a range with shift-click; watch the footer become the bulk bar; press Esc, then Esc again.
   - Run a bulk action; Undo it from the toast.
   - Submit a form with an error: every value stays. Fix it and save: the quiet status, no toast.
   - Open a record in the sheet, step with ↑↓, close with Esc, land back on the same row.
   - Keyboard only: `/`, j/k, x, Enter, ⌘K to a page and to a command, `?`.
   - Turn on reduced motion: the rail peek, toasts and save status still work, without motion.
4. Write findings first (screen, width, theme, what's wrong, what the reference does), then fix.

## Tests to write

Every fix gets a `*.browser.test.tsx` that fails on the old code, in the package when the part is
shared.

- **Shell**: at 767 and 768px with the cookie collapsed, the sidebar is a sheet and a rail respectively;
  the sheet closes on link click; nothing overflows at 320.
- **Table**: the header stays visible while the box scrolls; numeric cells end-align with
  `tabular-nums`; row heights match the density; row actions show on hover and always under
  `hover: none`.
- **Selection**: select-all indeterminate, shift-click range, the bar keeps its count while fading,
  Esc order.
- **Toasts**: stack cap, a server flash adopted by the client region, Undo duration.
- **Saving**: Saving… held ≥1s; failed submits keep values; SaveBar appears only when dirty.
- **Keyboard**: modal keys win over page keys; typing in a field does not trigger shortcuts.
- **Contrast** of muted text and status tones at 4.5:1 in both themes.

## Rules

1. Six widths, two themes, keyboard only, reduced motion.
2. Work through the flows above on every layout change.
3. Turn every fix into a browser test that fails on the old code.
