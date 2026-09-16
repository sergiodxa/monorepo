# ADR-008: Keyboard Navigation for the Reading Surfaces

## Status

**Proposed** - 2026-09-16

## Background

Everything a reader does all day happens on one of two surfaces, and both of them are the
same list: `/reading` and `/reading/:feed` render `resources/views/timeline.tsx`, a page of
rows with a mark at each end and a title between them. Working through a queue is moving
down that list, opening some of it and ticking the rest, several hundred times a week.

Today the only ways through it are the pointer and `Tab`, and `Tab` stops three times per
row. The audience this product is for arrives from readers where `j` and `k` are already in
their fingers, and arrives expecting `?` to tell them the rest.

Nothing in this app binds a key. `bootstrap/browser.ts` brings up an i18next instance and
the `remix/ui` client runtime and stops there. What follows is one client entry, two inert
attributes on a row, and no new route.

## Context

### The list is not a list

A page of posts is its own `<ol>`. The page below it arrives inside a `LazyFrame` rendered
after those rows, and the page above inside a frame rendered before them, and frames nest —
the page fetched into one carries the next frame inside itself. A reader eight pages into
their queue is looking at eight `<ol>` elements at eight different depths, not at one list
of two hundred rows.

The one property that survives all of that is document order. Each frame sits on the side of
the rows whose direction it continues, so the order `querySelectorAll` returns is the order
the reader reads in, at any depth and in both directions. It is worth naming because nothing
else about the shape of this list is stable.

### Content arrives at both ends, and one end moves the document

Downward is the easy half: a page lands below the rows and the document grows. Upward is
not. A frame marked `sitsAbove` holds newer posts, and what lands there pushes everything
under it down, so a `ResizeObserver` scrolls the document by exactly as much as the frame
grew to keep the reader's rows under their eyes.

So a selection held as an index into rows is wrong the moment a page lands above it, and a
selection held as a scroll offset is wrong the moment that correction runs. Only a reference
to the row itself comes through both untouched.

### A frame fetches once, and only when approached

`requested` latches before the frame stops watching and `loads.unwatch(node)` follows it, so
a mounted frame fetches exactly one page and its rows never change again. The thing a
selection has to survive is arrival, not replacement.

And an `IntersectionObserver` reaching 320px past the viewport is the only thing that ever
asks for the next page. A keyboard that moved a selection without moving the viewport would
walk a reader to the bottom of a list that then never continued.

### The address bar is already spoken for

`markPlace()` writes the page the reader is in into the address bar on every crossing of the
reading band, through `history.replaceState`. Whatever a keyboard put in the URL would be
rewritten by the next thirty pixels of scrolling, and pushing instead of replacing would
turn Back into a walk up the reader's own keystrokes.

### A single-letter handler on `document` is a hostile act

The sidebar carries a search box on every signed-in page and the queue's header carries the
field a feed is followed from, so a handler that fires on `s` fires while somebody is typing
a URL. Beyond that there are modifier chords the browser owns, an IME mid-composition, and
whatever dialog is open on top.

The deeper problem is who else is already using single letters. A screen reader's virtual
cursor binds most of the alphabet for its own navigation and, in browse mode, those
keystrokes never reach the document at all. A selection painted as a marker the browser
knows nothing about is therefore invisible to that reader twice over: their keys do not
reach the handler, and the handler's effect is not something their cursor follows. A
selection that is focus is the one kind a screen reader is guaranteed to announce, because
moving focus is the one thing every assistive technology tracks by contract.

### Free tier

Moving through a list is not a feature to sell, and a reader who cannot reach a post without
a mouse has no working product. Every binding below is available to everybody.

## Decision

### The current post is the focused row

Every row is server-rendered with `tabindex="-1"`, a `data-post` attribute that exists only
to be selected on, and a `scroll-margin-block-start` clearing the sticky header band. The
current post is whatever `document.activeElement.closest("li[data-post]")` answers. There is
no client variable holding it, no attribute the handler maintains, and nothing in the URL.

That single choice answers most of the first hard problem. A page arriving inside a frame
arrives already focusable, with no registration step, no hydration and no difference between
the markup a whole page renders and the markup a frame's response renders. A row removed
from the document takes focus to `<body>`, which is a state the handler can read rather than
a dangling reference it cannot. A screen reader announces the row as focus reaches it, so
`j` is a faster `Tab` rather than a second navigation model competing with the reader's own.
And `focus()` scrolls the row into view, which is what crosses the observer's band and
fetches the page below — the keyboard drives the paging through the same mechanism the
scroll wheel does, and needs to know nothing about frames to do it.

### Movement is a query, not a cursor

Each keystroke runs `document.querySelectorAll("li[data-post]")`, finds the current row in
the result, and focuses its neighbour. Nothing is cached between keystrokes: no index, no
`NodeList`, no `MutationObserver` watching for arrivals, and no protocol by which a frame
announces the rows it brought. Walking a few hundred elements per keypress is microseconds,
and it is the entire cost of being immune to appending, prepending, and removal at once.

With nothing focused — a cold page, or a row that was taken out from under the reader — `j`
takes the first row whose top edge is at or below the top of the viewport and `k` the last
one above its bottom. So the first press selects what the reader is already looking at
rather than walking them back to row one, and recovery from a lost row is the same code as
the cold start.

### `j` at the bottom does nothing

Pressing `j` on the last row while the frame below it is still in flight leaves focus where
it is. The alternative is to remember the intent and advance when the page lands, and that
is rejected: it moves focus asynchronously, some hundreds of milliseconds after the reader
pressed a key, which is precisely what a screen reader user experiences as the page running
away from them. The cost is one dead keystroke at a page boundary on a slow connection, paid
only by a reader outrunning their own network.

`k` at the top has a sharper version of the same limit. A frame sitting above the rows waits
to be scrolled past and turned back to before it fetches, deliberately, so a mid-list URL
does not walk itself to the top of a list nobody asked to return to. A reader who opened
such a URL and pressed `k` to the first row stays there until they scroll up out of the
frame, and the keyboard does not special-case around it.

### No binding names a frame

`getNamedFrame` falls back to the **top** frame when the name it is given is not mounted, and
says nothing about having done so, which turns a typo or a race into a full-page navigation.
This handler is never exposed to that, because no binding ever resolves a frame or calls
`navigate`. Every binding is a synthetic press of a control the server already rendered:

| Key | What it presses                         |
| --- | --------------------------------------- |
| `j` | Focus the next row                      |
| `k` | Focus the previous row                  |
| `o` | The focused row's title link            |
| `m` | The focused row's read form             |
| `s` | The focused row's save form             |
| `r` | The header's check-every-feed form      |
| `J` | The next feed's link in the sidebar     |
| `K` | The previous feed's link in the sidebar |
| `/` | Focus the sidebar's search box          |
| `?` | The shortcuts button                    |

So the only code in the app that resolves a frame by name is still `ReadToggle`'s
`handle.frames.get(SIDEBAR_FEEDS_FRAME)?.reload()`, which is optional-chained and answers
`undefined` for a sidebar that is not mounted rather than reaching for the document.

The set is the one this audience already has, with one departure: `J`/`K` for the feed list,
in place of a `g`-then-a-letter chord, because a chord needs a pending-key state, a timeout
and an escape hatch, and this app has one list of feeds sitting on screen next to the posts.
`j` only moves, where other readers expand a post under it — there is no expanded view here,
since a row that opens in place stops being one line, and one line is what puts twenty posts
on a screen.

Shift is not treated as a modifier. `Control`, `Alt` and `Meta` held means the browser or
the operating system owns the chord and the handler stands down; Shift is how a keyboard
produces `J` and `?` at all, and `event.key` already carries the shifted character, so the
handler reads the character and never asks about the key that made it.

### Marking read is the row's own form

`m` calls `requestSubmit()` on the `ReadToggle` form in the focused row. That form already
carries a submit handler which prevents the default and runs `move(!isRead)`, so the
keyboard inherits the whole of the existing path: the mark flips first, `POST
/items/:itemId/read` goes out under `READ_IN_PLACE_HEADER` so the server answers 204 rather
than a first page of a queue the reader is eight pages into, the sidebar's counts reload
after the server has recorded it, and a refusal puts the mark back and wears the `failed`
label. It is optimistic because that control is already optimistic, and the keyboard and
the pointer disagreeing about how fast a tick lands would be worse than either being wrong.

If the island never hydrated, `requestSubmit()` does a plain browser submission of the same
form to the same route, with the `returnTo` the server put in it. `s` is the same sentence
with `SaveToggle`. `o` clicks the title, which `ReadToggle` has already hooked, so opening a
post marks it read through the same `move(true)`; a row whose feed published no address has
no link and `o` does nothing. **No binding introduces a request the app was not already
making, and none of them needs to know an item's id or a route.**

### When the handler does not fire

One `keydown` listener on `document`, in the bubble phase, so anything nearer the event that
handled the key first has already stopped it. It returns without acting when
`event.defaultPrevented` is set, when `ctrlKey`, `altKey` or `metaKey` is held, when
`event.isComposing` is true, when the target is inside an `input`, `textarea`, `select`,
`[contenteditable]` or `[role="textbox"]`, and when the target is inside a `dialog` that is
not the shortcuts panel. Auto-repeat is allowed through, because holding `j` to scan is
something readers do on purpose.

`/` is bound anyway, and takes Firefox's quick-find away on these pages. It is worth it: it
is the convention every reader and search surface this audience touches has, and the sidebar
search box is otherwise several `Tab` stops behind the chrome. Firefox's links-only
quick-find on `'` is left alone.

### What gets announced

Movement announces nothing, because focus already speaks. `m` and `s` do need announcing:
each of them changes the `aria-label` of a button the reader is not focused on, and a label
change on an unfocused control reaches nobody. One polite live region in the app layout, fed
through `@sdxc/ui`'s `Announcer`, says the state the control now carries and says the
refusal when a move is put back.

### The help overlay

A shortcut nobody can discover is a shortcut nobody uses, so `?` is the second way in rather
than the only one. `resources/components/shortcuts.tsx` is one client entry mounted once in
the app layout, taking every string it prints as a serialized prop the way `ReadToggle`
takes its labels, with the keys under `shortcuts.*` in both `app/locales/en.ts` and
`app/locales/es.ts`. It renders nothing on the server. In a browser that ran it, it renders
a real button beside the reader's own menu, labelled and carrying `<Keyboard>?</Keyboard>`,
which is both where a reader finds out there are shortcuts and where they learn the key that
opens the list of them. `?` presses that button.

The panel itself is `Modal`, which is a native `<dialog>` opened with `showModal()`, chosen
for what closing it does: Escape dismisses it and the browser returns focus to exactly the
element that had it. Here that element is the selection, so the platform's own focus
restoration is the whole of "the reader gets their place back". The handler awaits
`handle.update()` before reaching for the dialog it has just asked to exist, for the same
reason a frame target is awaited rather than raced.

### Progressive enhancement

The server-side change is `tabindex="-1"`, `data-post` and a scroll margin on a row. A
negative tabindex is not in the tab sequence, so nothing about `Tab`, the pointer, or a
browser running no script changes at all. There is no new route, no new controller, and no
request that exists only for the keyboard, because every binding presses something a reader
can already press. Nothing in the product is reachable only by key.

## Consequences

### Positive

- The selection model has no state to keep in sync, so appending a page, prepending one,
  scroll-correcting the document and removing a row are all handled by having cached nothing.
- Keyboard movement fetches pages for free: focusing a row scrolls it, and scrolling is what
  the frames were already watching for.
- The bindings work with a screen reader's own navigation rather than beside it, because the
  selection is focus and every action is a real control being pressed.
- The optimism, the rollback, the failure label and the sidebar refresh are inherited rather
  than reimplemented, so the keyboard and the pointer cannot drift apart.

### Negative

- `j` is a dead key at a page boundary while the page below is in flight, and `k` is a dead
  key at the top of a list opened from a mid-list URL until the reader scrolls up.
- `/` takes Firefox's quick-find away on the reading surfaces.
- A selection that is focus cannot be styled as something quieter than focus, so the reading
  surfaces get one visible treatment for both, and a reader tabbing through controls and a
  reader pressing `j` see the same ring.
- The selection does not survive leaving the page and coming back. The address bar carries
  the page, so a reader returns to where they were reading, not to the post they were on.

### Neutral

- The handler is a few dozen lines with no dependencies on the frame model, and it stops
  working — rather than misbehaving — in any part of the app that renders no rows.
- Every future binding is a control that has to exist on the page first, which is a
  constraint on what can be bound and the reason none of this can regress without script.

## Alternatives Considered

**A painted marker and `aria-activedescendant`.** The usual answer for a list widget: keep
focus on a container, mark the current item with an attribute, and point at it. It requires
the container to be a composite widget — a `listbox` or a `grid` — and a `listbox` option may
not contain interactive children, which every row here has three of. Turning a list of
articles with links and buttons into a set of options to make a keyboard work would be
paying for navigation with the semantics the rows already have.

**A client-held index, kept current with a `MutationObserver`.** Faster per keystroke, and
it has to be told about every arrival, every prepend and every removal, in an app where
content lands at both ends of the document from frames that know nothing about it. It buys
microseconds and costs the entire correctness argument.

**The current post in the URL.** Attractive because it would survive a reload, and
impossible because `markPlace()` owns the address bar and rewrites it on every crossing of
the reading band.

**Remembering `j` at a page boundary and advancing when the page lands.** Rejected above:
focus that moves without a keystroke is the failure mode this design exists to avoid.

**`g`-then-a-letter chords for the feed list and the saved list.** A second keyboard mode,
with a timeout and a way out of it, for destinations that are links on the screen.

## Tests

Fourteen behaviours, in plain Vitest against a rendered document, alongside the app's
existing component tests.

| #   | Behaviour                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------- |
| 1   | `j` moves focus down the rows of one page, and `k` back up it                                        |
| 2   | `j` on the last row of a page crosses into the first row of the page a frame appended below          |
| 3   | A page landing above the rows leaves the focused row focused, and `k` walks into it                  |
| 4   | With nothing focused, `j` takes the first row at or below the top of the viewport                    |
| 5   | A focused row removed from the document leaves `j` recovering to the viewport rather than to row one |
| 6   | `j` on the last row with no further page focuses nothing new and moves no scroll                     |
| 7   | `m` submits the focused row's read form, flipping the mark before the request resolves               |
| 8   | A refused `m` puts the mark back and the row wears the failure label                                 |
| 9   | `o` follows the focused row's title, and marks the post read through the same path a click does      |
| 10  | `o` on a row whose post has no address does nothing and does not move focus                          |
| 11  | No binding fires while the target is the sidebar search box or the follow field                      |
| 12  | No binding fires with `Control`, `Alt` or `Meta` held, or mid-composition                            |
| 13  | `?` opens the panel, and closing it returns focus to the row that was current                        |
| 14  | Every binding resolves the control it presses from the document, naming no frame                     |

## Implementation

- [ ] `tabindex="-1"`, `data-post` and the header-clearing scroll margin on the timeline row
- [ ] `resources/components/shortcuts.tsx`: the `keydown` listener, the guard, and the bindings
- [ ] Movement by `querySelectorAll` per keystroke, with the viewport fallback
- [ ] `m`, `s`, `o` and `r` as `requestSubmit()` and `click()` on existing controls
- [ ] `J` / `K` over the sidebar's feed links, and `/` onto the search box
- [ ] The `Modal` panel, its `Keyboard` hints, and the button beside the reader's menu
- [ ] The polite live region, fed through `@sdxc/ui`'s `Announcer`
- [ ] `shortcuts.*` copy in `app/locales/en.ts` and `app/locales/es.ts`
- [ ] Mount the island in `resources/layouts/app.tsx`
- [ ] The tests above

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader read path these surfaces page
- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the lazy timeline, its frames, and the saved posts `s` reaches
- [ADR-014](../ADR-014-r3-ui-component-library-on-remix-ui.md) — the components the panel and its hints are built from
- [ADR-015](../ADR-015-remix-ui-utility-mixin-layer.md) — the mixin layer the row's focus treatment is written in
