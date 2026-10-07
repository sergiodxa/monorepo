# ADR-005: Search Dialog And Client Islands

## Status

**Implemented** - 2026-10-07

## Background

[ADR-004](./ADR-004-full-text-search.md) added full-text search behind a `/search` page that a
reader reached from the navigation. The blog's owner wanted search available on every page, in
a dialog that shows matches while the reader types, with `/search` kept as the full results page.

Live results need script, and the blog had none: every public page was a server-rendered
document, and the client entry was kept off the document shell because loading it turned every
link into an in-place navigation that Safari repainted unstyled.

## Context

| Fact                                                        | Consequence                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `run()` intercepts same-origin links and forms by default   | Loading the client entry changes how every page navigates                     |
| The runtime keeps one adopted stylesheet and prunes on swap | An in-place navigation out of a post flashes unstyled on Safari               |
| A `<Frame>` reloads from its `src` through `resolveFrame`   | Server-rendered HTML can update one region of a page with no client rendering |
| A client entry keeps its DOM when its frame reloads         | A box inside a frame keeps focus, caret and typed text across reloads         |
| The page renderer resolved frames with a network `fetch()`  | A tutorial page's related tutorials rendered empty in production              |
| `<dialog>`, Invoker Commands and `autofocus` are native     | Opening and focusing the dialog need no script                                |
| A search box may spend Escape clearing itself               | Closing on Escape needs a key listener ahead of the box                       |

## Decision

### 1. Islands hydrate; navigation stays document navigation

The document shell loads the client entry as `<script type="module" async>` with a matching
`modulepreload`. Before `run()`, `bootstrap/browser.ts` stops the runtime's `navigate` listener
from seeing any event, so every link and form remains a full document navigation and only
components marked with `clientEntry()` hydrate. Explicit frame reloads bypass the Navigation API
and keep working.

Hydrated components live in `resources/components/`, one per file, each declaring its own
module path (`/resources/components/<file>.tsx#<Export>`), which is the key `loadModule` looks
up in the bundle's glob map.

### 2. The search dialog is a frame

The blog layout renders a search pill (`commandfor` + `command="show-modal"`) at the end of the
navigation and a native `<dialog>` whose body is `<Frame name="search" src="/frames/search">`.
The dialog is a single panel in the manner of a system search: anchored near the top of the
viewport at a fixed width, so it grows downward only, with a large box on top and the results
under a hairline. It carries no heading, visible label or close button; Escape and a click
outside close it, and narrow or touch screens add a Cancel button. On `/search?q=…` the frame
starts from `/frames/search?q=…`, so the dialog opens on that query with its results rendered.

`/frames/search` renders a `GET` form to `/search` around the box, a `role="status"` line that
announces the count (shown only for a message such as "No posts match"), and the top six
matches as activity rows: the kind's emoji, the title with matches marked by `@sdxc/ui`'s
`Highlight`, a line of the post around the first match, and the date. That line is the summary
when it holds a match, otherwise the body as plain text.

The box is the `SearchBox` island. A keystroke marks the results `aria-busy`, a spinner replaces
the magnifier once a search outlasts 350 ms, and each 200 ms pause in typing points its own
frame's `src` at `/frames/search?q=…` and reloads it. The runtime aborts a reload still in
flight when the next one starts, and the signal reaches `fetch()`, so only the newest answer
lands; the panel then animates from its old height to its new one. Submitting the form is a
document navigation to `/search`, except that Enter follows the only result when one shows.

The box is a WAI-ARIA combobox over the result rows (`role="listbox"`, each row an `option`):
ArrowDown chooses the next row and wraps from the last to the first, ArrowUp returns from the
first row to the box, Enter follows the chosen row, and focus never leaves the box, so every
other key types. The choice resets when new results land. Closing the dialog aborts what is
pending and returns the box and the frame to how the page rendered them: blank, or on
`/search?q=…` that page's query.

The `SearchTrigger` island adds the keys: ⌘K or Ctrl+K toggles the dialog, `/` opens it from
outside a field, and Escape closes it even from a search box that would spend Escape clearing
itself. It closes the dialog on a click that starts and ends on the backdrop, where
`closedby="any"` is unsupported, and on `pagehide`, so a page restored from the back/forward
cache comes back closed.

### 3. Server frames resolve in process

The page renderer resolves a `<Frame>` by dispatching its source through `ctx.router.fetch()`
with the page request's headers, so a frame renders wherever the page renders, at no
subrequest.

## Consequences

### Positive

- Search is one keystroke away on every public page, and the dialog works as a plain search
  form without script.
- The results are server-rendered HTML through the same view model `/search` uses; the client
  holds no search logic.
- Frames render on production pages, so related tutorials appear under every tutorial.

### Negative

- Every uncached page render also renders `/frames/search` through the middleware chain,
  including the redirect lookup and a log event of its own.
- Every page downloads the client entry and the two islands' modules.

### Neutral

- Soft navigation stays off; turning it on is a separate decision that needs the Safari
  repaint solved first.

## Alternatives Considered

### Fetching JSON and rendering results in the island

**Rejected because**: it duplicates the highlighting and markup the server already renders,
and a frame reload gives the same live update with the view model in one place.

### Targeting the frame with the form (`data-rmx-target`)

**Rejected because**: Enter should land on the full `/search` page, and form targeting goes
through the Navigation API listener this app keeps disabled.

## References

- [ADR-004: Full-Text Search Over A Search-Only Projection](./ADR-004-full-text-search.md)
- [Remix component frames](../../vendor/@remix-run/component/docs/frames.md)
- [Remix component hydration](../../vendor/@remix-run/component/docs/hydration.md)
