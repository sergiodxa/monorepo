---
title: Saving Is a Model, Not a Toast
impact: CRITICAL
tags: [forms, saving, settings, editor, validation, autosave, optimistic]
---

# Saving Is a Model, Not a Toast

People trust an app when they always know whether their work is safe. That comes from one consistent
model of saving, not from a toast after every click.

## Explicit or instant, never both in one section

- **Typed input saves explicitly**: one Save button per section, never disabled, bottom-start on a page
  and bottom-end in a dialog. ⌘S saves.
- **Switches and segmented controls save instantly**, with no button, and show the change where it
  happened.
- A section that mixes both leaves people unsure whether the switch they flipped was saved with the
  text they typed. Split it into two sections.
- Feedback goes only where the change is not visible already.

## A failed submit keeps every character

- The action re-renders the form with the submitted values and the issues on each field. Never redirect
  back to an empty form with a toast; that was Uptime's worst form bug.
- A dialog with inputs goes full-screen on phones, and its backdrop does not dismiss a dirty form.
- A long form shows a sticky `SaveBar` ("Unsaved changes · Discard · Save") once dirty, and asks before
  leaving with unsaved changes.

## Two signals in an editor

- **Persistence is quiet text**: Saving… (held at least 1s, so it never flickers) → Saved (about 3s) →
  "Edited 2m ago". A failure says "Couldn't save · Retry".
- **Publication is the loud primary button**, and its label carries the state: Publish → Publishing… →
  Published, disabled when there is nothing new to publish.
- Autosave drafts only. Published content changes through an explicit Update. WordPress, Sanity,
  Payload and Ghost all converged on this.

## Settings

- Grouped sections: a title and description, then a bordered card of 1px-ruled rows, then the
  section's own footer with Save. Rows are split (label and help at the start, control at the end) and
  stack on phones.
- A row whose control holds a value (an input, a select, a switch) is an input row: the label and
  control share the row in two columns. A row whose control is a button that acts at once ("Open
  billing portal", "Export data") is an action row (`layout="action"`): the text takes the row's
  width and the button keeps its own. Put the button at the row's end, centred on the title line,
  when the description runs a line or two; put it under the text (`actionPlacement="below"`) when
  the description is longer or holds a list or warning. Phones always stack it under the text.
- A section nav on the start side; on phones the nav is the parent page and each section its own route.
- The danger zone is its own section with a danger border. Each action lists its consequences, with
  its button under them (`DangerZone.Action`'s default); `actionPlacement="end"` only for a short row
  with no list. Type-the-name confirmation only for big, irreversible actions.

## Optimistic toggles

- Read/unread, star, save, pause: flip at once, post in the background, and if it fails, flip back and
  say "Failed" in place. The same control works as a plain form post without JS.

## Rules

1. Decide explicit or instant per section, and say which in the API.
2. Re-render failed submits with their values and issues.
3. Keep persistence quiet and publication loud.
4. Use `SettingsSection`, `SaveBar`, `SaveStatus`, `DangerZone` and `OptimisticToggle`.
