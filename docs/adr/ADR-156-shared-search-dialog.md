# ADR-156: Shared Search Dialog Through Mixins

## Status

**Accepted** - 2026-10-16

## Background

sergiodxa.com (`apps/blog`) and sdxc.dev (`apps/sdxc-site`) open the same search dialog with ⌘K.
It is a server-frame design: a static trigger that links to `/search`, a `<dialog>` that holds a
`<Frame>` pointed at the app's search frame endpoint, and a search box island that reloads that
frame as the reader types, with kind tabs, counts, and `kind:` filters (ADR-117).

sdxc.dev was rebuilt from the blog's version, and the two were then brought into line: the tab
strip keeps a minimum height, the dialog closes once a soft navigation settles, and the box takes
its label as a prop. After that, most of the client code was the same file in two places, so
every fix had to be made twice.

## Context

### What differed between the two apps

| File in `resources/components/` | Lines | Difference                                                                                                                                                                          |
| ------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search-box.tsx`                |   455 | Import specifiers only                                                                                                                                                              |
| `search-surface.ts`             |   100 | Import specifiers only                                                                                                                                                              |
| `quiet-search-input.tsx`        |    97 | Import specifiers only                                                                                                                                                              |
| `search-tabs.tsx`               |    84 | Import specifiers, and the tab type's name; both types have the same shape                                                                                                          |
| `search-keys.ts`                |   136 | The blog opens the dialog from the trigger on wide screens only, and rewrites the ⌘K hint to "Ctrl K" in the browser; sdxc.dev renders the hint on the server with `keyComboGlyphs` |
| `search-trigger.tsx`            |    46 | Different look; same dialog id and trigger attribute                                                                                                                                |
| `search-result.tsx`             |   111 | Different by design                                                                                                                                                                 |
| `search-quick-links.tsx`        |   130 | Different by design                                                                                                                                                                 |
| `results-pager.tsx`             |    67 | Small, per-page markup                                                                                                                                                              |

### What the search box island did

`SearchBox` did six jobs in one closure:

1. Reload the frame from the box's text once typing pauses, ignoring answers to older text.
2. Mark the results busy at once and show a spinner once the wait turns slow.
3. Choose result rows with the arrows through `aria-activedescendant`, and follow one on Enter.
4. Switch kind tabs by click or by Left and Right while a row is chosen.
5. Animate the results card and rows from their old state into the new one.
6. Wire the dialog: page shortcuts, close on reset, lift on follow, close on same-page links.

Moving the whole island into a package as one component needs ten props (ids, label, query,
frame address, dialog id, option count, kinds, trigger attribute, trigger media query), because
island props must serialize and so every per-app choice becomes data. That is one component
doing too much, with an API that grows each time an app differs.

## Decision

Extract the generic jobs as mixins in `@sdxc/ui/mixins`, and keep each app's island as the
place that composes them. An island an app writes itself can pass callbacks to a mixin, so the
per-app choices stay ordinary code instead of props.

### Mixins

#### `liveFrame(options)` - jobs 1 and 2

```tsx
<input
	name="q"
	mix={[
		liveFrame({ src: (text) => searchFrameSrc(routes.searchFrame.href(), text, currentKind()) }),
		on("ui:live-frame", (event) => {
			if (event.state === "pending") markBusy(true);
			if (event.state === "slow") showSpinner();
			if (event.state === "settled") markBusy(false);
		}),
	]}
/>
```

- Reloads the host's frame (`handle.frame` of the mixin) from `src(value)` once typing pauses
  (`debounce`, default 200 ms), and at once when the host receives `LIVE_FRAME_RELOAD_EVENT`.
  A consumer dispatches that event after changing anything `src` reads, such as the kind tab.
- Dispatches `LiveFrameEvent` with `state`: `pending`, `slow` (after `slowAfter`, default
  350 ms), `loading` (just before the frame is replaced, for a snapshot), and `settled`.
- Only the newest request settles, so an answer to older text never ends a newer wait.

#### `activeDescendantKeys()` - job 3

```tsx
<input role="combobox" aria-controls={listboxId} mix={[activeDescendantKeys()]} />
```

- Down chooses the first option of the `aria-controls` listbox and wraps around from the last;
  Up goes back toward the input. Enter follows the chosen option's link, or the only option when
  it sits in no `aria-busy` region.
- The choice lives in `aria-activedescendant` and `aria-selected`. `chooseOption(input, index)`
  and `chosenOption(input)` set and read it, for an island that replaced the options or that adds
  keys of its own (the kind tabs' Left and Right).
- It finds the listbox through the host's `aria-controls`, so it needs no ids passed to it.

### What each app keeps

| Piece                                                                                              | Why it stays in the app                                                                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| The island itself, which composes the mixins                                                       | It holds the app's choices: the frame address, the label, the tab order, which listbox an empty box controls |
| Kind tabs and results motion (jobs 4 and 5)                                                        | Both read the app's markup (tab attribute, results card); the next candidates once a third consumer appears  |
| Dialog wiring (job 6) and the trigger                                                              | Each site's trigger differs, and the blog opens the dialog on wide screens only                              |
| Route, frame endpoint, frame view, results and tabs model, result row, quick links, `/search` page | Server side and presentation, which are each site's own                                                      |

The two `search-box.tsx` files are still the same apart from import specifiers, and went from 455
to 395 lines each. What left them is the mechanism, which now has one copy, with its own tests, in
`@sdxc/ui`; what stays is the composition, plus the motion and tab helpers.

## Consequences

### Positive

- **One copy of the mechanism** - frame reloading, stale-answer handling, the slow-wait signal
  and combobox keys are fixed once, in a package with its own tests.
- **No prop list** - per-app choices are callbacks and markup in the app's own island, so a new
  difference needs no new option.
- **Reusable outside search** - any input that refreshes a frame (a filter, a picker) and any
  combobox over server-rendered options can use the mixins.

### Negative

- **Two islands remain** - the composition is still duplicated between the two apps, so a change
  to tabs, motion or dialog wiring is still made twice.
- **Coordination through events** - the island and the mixins agree through
  `LIVE_FRAME_RELOAD_EVENT`, `LiveFrameEvent` and the ARIA attributes, which a reader has to
  follow across files.

### Neutral

- **The island no longer renders `aria-activedescendant`** - the mixin owns that attribute on the
  element, so the island leaves it out of its JSX.

## Implementation Plan

### Phase 1: Mixins

1. Add `liveFrame` and `activeDescendantKeys` (with `chooseOption` and `chosenOption`) to
   `@sdxc/ui/mixins`, each with tests against a real frame runtime and document.
2. Move both apps' `SearchBox` islands onto them.

### Phase 2: Further extraction (not yet decided)

1. Revisit kind tabs, results motion and dialog wiring once a third site uses the dialog, or
   when one of them needs the same fix in both apps.
2. Render the blog's shortcut hint on the server, as sdxc.dev does, so the two `search-keys.ts`
   files match.
3. Show `liveFrame` in the sdxc.dev search dialog guide, whose example island reloads the frame by
   hand.

## Alternatives Considered

### 1. One configurable `SearchBox` island in a package

**Rejected because**: island props must serialize, so every per-app choice becomes a prop, and
the component carries all six jobs behind about ten of them.

### 2. Keep one copy per app

**Rejected because**: the three fixes listed in the Background each had to be made by hand in the
second app.

## References

- [ADR-109: Search Package](./ADR-109-search-package.md)
- [ADR-117: Search Query Syntax](./ADR-117-search-query-syntax.md)

## Current Progress

- [x] Phase 1: Mixins
  - [x] `liveFrame`
  - [x] `activeDescendantKeys`, `chooseOption`, `chosenOption`
  - [x] sdxc.dev island on the mixins
  - [x] Blog island on the mixins
- [ ] Phase 2: Further extraction
