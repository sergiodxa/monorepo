---
title: The Keyboard Layer
impact: HIGH
tags: [keyboard, shortcuts, command-palette, focus, accessibility]
---

# The Keyboard Layer

People who use an app daily stop reaching for the mouse if the app lets them. A keyboard layer is
cheap to build once, and it only works if it is visible: every action shows its key.

## The keys every app has

| Key | Does |
| --- | --- |
| ⌘K / Ctrl+K | Command palette: go anywhere, run any command |
| `/` | Focus the page's search or filter |
| `j` / `k` (↓ / ↑) | Move through rows with a 2px **inset** focus ring (inset so it never clips) |
| Enter / `o` | Open the focused row |
| `x` | Toggle the focused row's selection |
| Space | Peek the focused row in a sheet |
| `g` then a letter | Go to a section (`g m` monitors, `g i` incidents) |
| `?` | Keyboard help, generated from the registered shortcuts |
| Esc | Close the top thing: clear selection, then filters, then the sheet |

Inboxes add next-unread and mark-read keys.

## The palette

- ⌘K is global and never reused for an in-page filter.
- ~600px wide, ~15% from the top, 36px items, grouped. Recent items before typing.
- Items are commands that act ("Pause monitor", "Copy account ID"), not only links, and each shows its
  key. Nested pages ("Switch team ›") pop with Backspace on an empty input.
- Matching ignores case and accents and knows aliases (old names find new places).
- No results still helps: offer search, or the closest commands.

## One registry with scopes

- Page < sheet < modal: the topmost open scope wins, and page keys go quiet while a dialog is open.
- Keys are ignored while typing in a field, except Esc and ⌘K.
- Register shortcuts from the HTML (`data-shortcut` on a link or button) so the server owns them and
  `?` lists them.
- Announce what a key did when the screen doesn't show it ("Marked as read").

## Rules

1. Ship `/`, j/k, `?` and ⌘K on every list screen.
2. Show the key beside every action that has one.
3. Register every shortcut once, with a label, so help is generated.
