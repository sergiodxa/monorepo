# ADR-014: Reading Presentation

## Status

**Proposed** - 2026-09-16

## Background

The reader has one appearance. `resources/layouts/document.tsx` renders `<html class="system">`
with the class written into the source, so the page follows the operating system and there is no
way to disagree with it. Every post is one row on one line in `resources/views/timeline.tsx`, in
the sans stack `resources/css/colors.css` declares, and that is the whole of what a reader can
be shown.

Seven things have been asked for on top of that: a light and dark choice, a serif reading
face, the list/split/grid/magazine layouts other readers offer, swipe gestures on a phone, the
publisher's own page rendered inline, a player for podcast and video enclosures, an image-first
mode for feeds that are drawings rather than prose, and custom CSS. They arrive as separate
requests and they are one decision, because they all answer the same question — what a reader
may change about how their feed looks — and because answering them one at a time is how an
interface acquires four layouts, three of which nobody maintains. This ADR decides all of it,
including the parts it decides not to build. All of it is Free: a reader who cannot stand the
way the app looks does not stay long enough to consider paying for anything.

## Context

### A stored post is four fields

[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) settled what a post
is: `title`, `url`, a `summary` capped near what the timeline renders, and `author`, plus the
timestamps and the read and saved marks. There is no body — `0002-drop-item-content` removed it
and ADR-002 declined to bring it back — and no image, no duration, no attachment.

That is the most important fact here, because most of what was asked for is not a presentation
feature. A magazine layout is a title, an excerpt and a picture; a split view is a list beside
an article; a webcomic reader is an image. None of the three has anything to draw. They are
storage decisions wearing a layout's clothes, and taking them as layouts would quietly reopen a
decision ADR-002 made deliberately.

### What `@sdxc/u` already decides

The mixin layer's dark mode is further along than an app would guess.
`packages/u/src/theme.css` declares the semantic `--ui-{tone}-{property}` tokens three times: on
`:root` for light, under `:is(.dark, .dark *)` for a forced dark scheme, and under
`@media (prefers-color-scheme: dark) { :is(.system, .system *) }` for following the system. An
ancestor carrying `dark`, `light` or `system` is the entire switching mechanism, and `<html>`
already carries `system`. `resources/css/colors.css` is scheme-independent on purpose and says
so — one eleven-step ramp per scale, with the theme layer choosing which step each token points
at, "which is why nothing here is scheme-specific" — so dark mode needs no new colour.

For anything that must differ per scheme beyond a token, `u.scheme(mode, input)`, with
`u.dark()` and `u.light()` as sugar, emits the forced-class block and the system-preference
at-rule from one call, and `dark.test.ts` pins that the two halves carry identical styles. That
is the property worth having: a hand-written `@media (prefers-color-scheme: dark)` block applies
to a reader who has forced light, and there is no way to write that bug through the mixin.
`@media (prefers-contrast: more)` already promotes every tone's subtle border to its strong
variant in both schemes, and `--ui-font-serif` already ships, so a serif face costs no font stack.

What remains is small: the class on `<html>` has to become the reader's answer rather than a
literal, and `color-scheme` has to be set at all. Nothing sets it today, so a dark page is
painted with a light scrollbar, light form controls and — once there is one — a light native
media player. `u.colorScheme()` exists and is unused here.

### A theme that arrives after the first paint is a bug

This app renders on the server and enhances after. A preference read in the browser — from
`localStorage`, from a class applied on `DOMContentLoaded`, from a hydration pass — is read
after the document has been painted in whatever the markup said, and a reader who chose dark
watches a white page turn dark on every navigation. That is not polish deferred; it is the
reason the preference has to be an input to rendering rather than a correction applied to it.
The precedent is already here: `app/http/cookies.ts` keeps `LANGUAGE_COOKIE` outside the session
for exactly this reason — "a language is resolved before anybody is known" — and the i18n
middleware reads it to decide `<html lang>` on the server.

### Rendering somebody else's page is not a presentation decision

"Show the original site inline" sounds like a view toggle and is a decision about executing
untrusted code. There are two mechanisms. Injecting the publisher's HTML into this document runs
their script in a document holding this reader's session cookie, which is stored XSS; sanitizing
first is an adversarial, permanent job whose success condition — a page stripped of its script —
is no longer the page the reader asked for. An `<iframe>` moves execution to the publisher's
origin, which answers that and opens three more: most publishers refuse framing, the frame loads
their trackers with the reader's address from a page this app put them on, and their buttons
inside our chrome is the clickjacking shape by construction. The app also ships no
`Content-Security-Policy`, so any version of this needs one first, and a CSP is its own decision.

### Every layout is paid for on every future change

The timeline is one file and one row shape, and its own comment defends that: "a row that takes
one line puts twenty of them on a screen where a panel puts seven." A second arrangement adds a
branch that every later change to a row is made in twice — the read mark, the save toggle, the
outbound `ping`, the screen-reader notes, the reflow at 34rem, and whatever
[ADR-008](./ADR-008-keyboard-navigation.md) needs a row to expose — against the most frequently
edited markup in the app.

### Enclosures are parsed and then thrown away

`@sdxc/feed` does the hard half. `Feed.Item.enclosures` is `{ url, type?, length? }[]`, resolved
against the document's URL, populated from all three formats: RSS `<enclosure>` in its single
and repeated shapes, Atom `<link rel="enclosure">`, and JSON Feed `attachments` with `mimeType`
and `sizeInBytes`. What it cannot give is a duration or a poster image, because no format
reliably carries one. Storage is what throws it away: the `FeedDO` `items` table has no column
for an attachment, so a podcast episode arrives fully parsed and is stored as a title, a link
and a date. A play button is therefore a schema change on the shared side and a copy on the
reader's, and is worth naming as that rather than as a component.

## Decision

Two per-reader preferences, one per-subscription preference that is specified and not scheduled,
a player, a gesture, and three refusals.

### What is stored, and where

| Preference     | Scope      | Where                         |
| -------------- | ---------- | ----------------------------- |
| `theme`        | Per reader | `UserDO` `settings`           |
| `reading_face` | Per reader | `UserDO` `settings`           |
| `presentation` | Per feed   | `UserDO` `feeds` subscription |

```text
-- settings, the one-row table
theme         TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark'))
reading_face  TEXT NOT NULL DEFAULT 'sans'   CHECK (reading_face IN ('sans','serif'))

-- feeds, one row per subscription
presentation  TEXT NOT NULL DEFAULT 'text'   CHECK (presentation IN ('text','image'))
```

Named lists with a `CHECK` repeating them, spelled the way `VELOCITIES` already is, so the closed
set exists once in TypeScript and once in the database and no path can write outside it. The
first two are per reader because they are facts about eyes and screens: somebody who wants dark
wants it for every feed, and a per-feed theme is a setting whose only use is inconsistency.
Webcomic mode is the exception, and it lands on the subscription for ADR-002's velocity argument
exactly: two people following one comic may disagree about whether they want the picture or the
line, the feed is the same for both, and neither is wrong, so the answer belongs in the object
each of them owns rather than the one they share. It is a mode rather than a boolean `webcomic`,
so a third rendering would be a value rather than a second column. There is no `layout` column,
because there is one layout.

### How the preference reaches the first paint

The `UserDO` row is the record. A cookie is the render input.

`PRESENTATION_COOKIE` joins `RETURN_TO_COOKIE` and `LANGUAGE_COOKIE` in `app/http/cookies.ts`
with the same settings — path `/`, a year, `httpOnly`, `SameSite=Lax`, `Secure` in production —
holding one small object narrowed through a `remix/data-schema` shape, so an unrecognized value
falls back to the defaults rather than reaching a template. It is unsigned, for
`RETURN_TO_COOKIE`'s reason: the worst a tampered value achieves is rendering the reader's own
page in a scheme they did not pick. A presentation middleware parses it and publishes
`ctx.presentation` before any controller runs, and `DocumentLayout` writes the answer onto
`<html>`:

```text
<html lang={locale} class={theme} data-face={face} mix={[colorScheme(scheme)]}>
```

`theme` is `system`, `light` or `dark`, which is precisely the vocabulary the theme contract
reads, so nothing is translated. `colorScheme` is `"light dark"` for `system` and `"only light"`
or `"only dark"` for a forced choice, which is what makes browser-painted chrome follow the page.

A cookie rather than the object, because the document shell renders for pages with no other
reason to touch a reader's storage — the 404 handler, the sign-in page — and a Durable Object
wake on the critical path of a page to decide a class is the wrong cost in the wrong place. The
object as well, because a preference living only in a cookie is a preference per browser: a
reader signing in on a second machine finds the app has forgotten them. One form post stores the
value and sets the cookie on the same response, and the auth callback sets it from the stored
row, so a new device picks the choice up on its first authenticated page.

**The row wins wherever both are read**, which is the settings page and the sign-in callback and
nowhere else. Both already read the object, so reconciliation costs one comparison and one
`Set-Cookie` on a response that would otherwise set none, and no request renders a page in order
to discover that a cookie is stale — the cost being a window in which a reader who cleared
cookies while staying signed in renders as `system`. The control itself is a real form that
posts and reloads with no script; where script runs it also flips the class and `data-face`
immediately and posts in the background, so both paths land on the same state. Caching is
untouched, because every page here already varies on the session cookie.

### Theme, and the one thing it changes

Dark mode is the mixin layer's, unmodified. The app supplies the class and the `color-scheme`
and nothing else: the palette is scheme-independent already, the tokens are mapped for both
schemes already, and any per-scheme exception goes through `u.scheme()` so the forced and system
halves cannot drift. `u.dark()` should stay rare — a style that needs it usually named a palette
step where it should have named a tone.

### The reading face

One variable, `--ui-font-reading`, declared as `var(--ui-font-sans)` and redefined under
`html[data-face="serif"]` as `var(--ui-font-serif)`. Reading surfaces call `font("reading")`,
which `u.font()` already supports for an app-extended name, so no component branches on the
setting and no mixin is added. It is set from `html[data-face="serif"]` rather than from `:root`
deliberately: the app's palette file is linked before the theme it customizes, so a `:root`
declaration in it is outranked by the same declaration arriving from `@sdxc/u/theme.css`, and a
type-plus-attribute selector outranks `:root` whatever the link order turns out to be. The face
reaches a post's title and its words and never the chrome — a serif sidebar is not what anybody
asking for serif is asking for, and a dense navigation list is harder to scan in one.

### One layout

The dense list stays. Split, grid and magazine are not built — not because they are hard, but
because three of them have nothing to draw. A grid and a magazine are pictures with titles
beneath them, and a stored post has no picture. A split view is a list beside an article, and a
stored post has no article, only the summary the row already shows, which the pane would render
a second time at a larger size. Building any of them means first deciding to store what they
display, which is ADR-002's decision and not this one's. What a reader gets instead is the
reflow the list already does: below 34rem the row keeps the title to itself and drops the source
and time underneath, which is the comfortable phone reading a grid was standing in for. If
full-text extraction is ever built, split view is worth reopening on the day it lands with the
body it needs; it is named here so that reopening it is a decision rather than a rediscovery.

### Media attachments

Three nullable columns on the canonical `items` table, copied onto `feed_items` by the
synchronization that already copies the rest:

```text
enclosure_url     TEXT    NULL
enclosure_type    TEXT    NULL
enclosure_length  INTEGER NULL
```

**At most one, chosen at ingestion:** the first enclosure whose `type` begins with `audio/` or
`video/`. A podcast item has one episode; the feeds attaching fifteen files are attaching
images, and an arbitrary-length list is a second table and a join on the read path for a feature
whose whole value is a play button. An item with no media enclosure keeps three nulls and renders
as it does now.

Rendering is a native `<audio controls>` or `<video controls>` with `preload="none"`. The
browser's own player is keyboard operable, labelled for a screen reader, wired to the OS media
keys, present on the lock screen, and remembers a playback rate — all of which podcast readers
use, and none of which a hand-built transport gets without being rebuilt. `preload="none"`
because twenty podcast rows each fetching metadata are twenty requests to somebody's CDN for a
page on which nobody pressed play. It appears on a feed's own surface and in an expanded row,
never on a timeline row: a row is one line and a player is not. The element fetches from the
publisher's host with the reader's address, as an `<img>` would, and honours no
`referrerpolicy` — so `<meta name="referrer" content="strict-origin-when-cross-origin">` is what
bounds what a publisher learns, and it is one line in `DocumentLayout`.

### Touch gestures

One gesture: a horizontal swipe on a row toggles whether the post is read, at phone width. Not
swipe-to-advance, because the queue is a scrolling list rather than a card stack and advancing
through it is scrolling. Not two actions on two directions, because a swipe has no hover state
and so no way to say what it is about to do; both directions toggle the same thing, so an
accidental swipe is undone by repeating it.

The row carries `touch-action: pan-y` and the handler reads Pointer Events. That constraint is
the whole risk: a handler that captures vertical movement makes a list of posts unusable on the
device the gesture exists for, and the browser enforcing the axis is more reliable than a
threshold deciding it. The row's fill follows the finger past a threshold and springs back below
it, so the gesture is previewed and abandonable, and that travel sits behind `motion-safe`. It is
an accelerator and never a sole path: the read toggle stays a real button, the keyboard route is
[ADR-008](./ADR-008-keyboard-navigation.md)'s, and the swipe reaches the same
`POST /items/:itemId/read` both do.

### No original-site view

The publisher's page is not rendered inside this app, in a document or in a frame, for the
reasons in Context — and the `sandbox` that would neutralize a frame removes the scripting the
pages worth framing need. What the reader wants is already one click away and better: the title
is an ordinary link whose `ping` marks the post read, so opening a post opens it in the
browser's own top-level context, where the browser's protections and the reader's extensions
apply and this app is not a participant. This refuses to render, not to extract — fetching an
article, reducing it to a small element allowlist and storing the text is a different feature
with a different storage story, and this decision is not a down payment on it.

### No custom CSS

A reader cannot be given a stylesheet to apply to their own account. The usual defence is the
honest one — a reader styling their own account harms no other reader — and it is not the reason
to refuse. Four other things are. The support cost lands here rather than there: a report from an
account with a custom sheet is unfalsifiable until it has been reproduced with the sheet off, and
the reader who wrote it months ago does not remember it exists. It freezes the markup, because a
sheet written against `[data-post-title]` makes that attribute a public contract, and this ADR
declines three features precisely because the row is expensive to change. Hiding a control is a
product problem rather than a safety one: a reader who hides the save toggle and cannot find it
again has a broken app and files the bug against us. And injecting reader-authored CSS means
either a `<style>` element carrying their text — a sink that must be escaped perfectly forever,
where `</style>` inside a string, an `@import` to a third-party origin and a `url()` fetched at
paint time each leak something — or a `style-src` allowance that guts a CSP not yet shipped.

The request is also a proxy for something narrower: readers want a scheme, a face and a
comfortable line, which are enumerated settings testable in both themes. A reader who genuinely
wants arbitrary CSS has a userstyle extension that does it on their own machine today, with no
account and no support surface, and does it better.

### Webcomic mode, specified and not scheduled

The column above is real and the feature is not built yet. An image-first reader needs an image
and a stored post has none, so webcomic mode is an ingestion feature with a presentation on top:
`image_url` and `image_alt` on the canonical item, extracted by the `FeedDO` at parse time from
an `image/*` enclosure or the first `<img>` in the unsanitized `contentHtml`, which no format
marks as the main picture. That is a heuristic with a maintenance life of its own, in the shared
object every reader of that feed depends on.

Its shape is fixed now, so asking for it later is scheduling work rather than reopening a
decision: the image renders at the column's width with zoom and pan through the browser's own
scrolling rather than a gesture layer, `alt` becomes the image's accessible name, and the
publisher's `title` — where the joke lives in half the comics that would use this — is rendered
as visible text beneath the image, because a phone has no hover and a screen reader does not
announce it.

### What both themes have to survive

`colors.css` documents its ratios on the light side — brand 600 at 4.91:1 on neutral 50 — and
documents nothing about the dark side, where every token points at a different step. A theme
switch measured on one side is half tested, so a test computes the ratio for each pair the app
actually renders — `neutral.emphasis`, `neutral.fg` and `brand.fg` against `neutral.bg-tint` —
in both schemes against 4.5:1. `neutral.fg` is the one to watch: it is what a read row's title
becomes, and a read post is meant to stay readable rather than merely present.
`neutral.fg-muted` and `brand.fg-muted` stay off text in both schemes, not only in the one where
that was measured.

Reflow is the single-layout argument again: one row shape that already collapses at 34rem
reflows at phone width because there is nothing else for it to do. `color-scheme` on `<html>` is
what makes the native player, the scrollbars and the form controls belong to the page — the
difference between a dark page and a dark page with a white video player in it. Reduced motion
covers the swipe's travel, and increased contrast is already the mixin layer's.

### What ships, in order

1. **Theme and reading face.** First: cheapest, reaches every reader, and the hardcoded `system`
   with no `color-scheme` is already wrong today for everyone reading in the dark.
2. **Media attachments.** Next: the difference between a whole category of feed working and not
   working, and a schema change easier made before there are more readers.
3. **Touch gestures.** After: an accelerator for something that already works two other ways.
4. **Webcomic mode.** Specified above, scheduled by a reader asking for it.

Split, grid and magazine layouts, the original-site view and custom CSS are declined rather than
deferred. Split view alone has a stated condition for being reopened.

## Consequences

### Positive

- Dark mode costs the app a class and a `color-scheme`, because the mixin layer ships the token
  mapping for both schemes and the palette was written to be scheme-independent. It is decided
  before the first byte: no flash on any navigation, no blocking inline script in `<head>`, and
  no hydration correction to get wrong.
- The reading face is one CSS variable, so nothing branches on it, and a reader's choice follows
  them to a new device because the object holds it.
- There is still one row shape, so [ADR-008](./ADR-008-keyboard-navigation.md), the read mark,
  the save toggle and every future change to a post are made once.
- Podcast and video feeds become usable with three nullable columns and a native element whose
  keyboard operation, screen-reader labelling and OS media keys come for free.
- No third-party code runs in this origin and no third-party frame is embedded, so the app's XSS
  surface is unchanged by everything decided here.

### Negative

- One fact has two writers, and closing the window between them any sooner means waking an
  object to paint a page.
- A reader who wants a magazine or a split view is told no, and the honest reason — the posts to
  fill them are not stored — is not the reason they will hear it as.
- Enclosures put a schema change in the shared `FeedDO` for a feature only some feeds use, and
  keeping one attachment means a feed publishing two genuinely different files loses the second.
  Playback is then whatever the browser does: no cross-device resume, no persistent speed, no
  queue.
- The swipe is the one piece of real client behaviour added here, and gesture handling beside a
  scroll container is the code most likely to feel wrong on a device nobody tested.
- No original-site view means a reader whose feed is truncated to a headline still leaves the app
  to read anything, which is the complaint the feature was meant to answer; and with no custom
  CSS, every appearance request past the enumerations is answered by a person.

### Neutral

- `u.scheme()` becomes the only way a per-scheme exception is written here, which constrains
  style rather than capability, and responses vary on one more cookie at no cost.
- The `presentation` column exists from the migration that adds it, so a later implementation is
  a controller and a view rather than a schema change.

## Alternatives Considered

**Keep the preference in `localStorage` and apply it on load.** No cookie, no column, no
middleware, and it is what most sites do. It also paints the wrong theme on every navigation
before correcting it, which is the behaviour this decision exists to prevent.

**A blocking inline script in `<head>` that sets the class before paint.** The standard fix for
that, and it works. It also puts executable script in the head of a server-rendered app that
otherwise has none, blocks the parser on every page, and needs a `script-src` exception in the
CSP still to be shipped.

**Ship list and split now, the other two later.** Split is the most requested of the four and the
cheapest to justify. It still needs an article for its right-hand pane, and the only text stored
is the summary the left-hand row is already showing.

**An iframe with a strict `sandbox` for the original-site view.** It contains the script, and for
a static page it works. It fails for the majority of publishers that refuse framing, it fails
invisibly, and a sandbox strict enough to be safe removes the scripting the pages worth framing
need — unreliable in the way a reader reads as broken.

**A proxy that fetches and sanitizes the publisher's page onto this origin.** Full control of
what renders and no framing refusals. It is also an open fetcher taking reader-supplied URLs and
a sanitizer whose failures are session theft, for a feature whose alternative is a link.

**A hand-built media player with our own controls.** Consistent styling in both themes, a
persistent playback rate, a queue across posts. It also reimplements keyboard operation,
screen-reader labelling, OS media keys and lock-screen controls, and would be worse at all four.

## Tests

Eighteen behaviours, in the layout the app already uses: the pure paths in plain Vitest, the
`UserDO` paths in `*.workers.test.ts` with `@sdxc/cloudflare-mocks`, and the contrast check over
the declared palette.

| #   | Behaviour                                                                                           |
| --- | --------------------------------------------------------------------------------------------------- |
| 1   | A reader with no presentation cookie renders `<html class="system">` and `color-scheme: light dark` |
| 2   | A stored `dark` renders `class="dark"` and `color-scheme: only dark` in the first response body     |
| 3   | No response carries a script that sets the theme, and the class precedes `<body>`                   |
| 4   | A malformed or unknown cookie value renders the defaults rather than reaching the template          |
| 5   | Posting a theme stores it in the `UserDO` and sets the cookie on the same response                  |
| 6   | The sign-in callback sets the cookie from the stored row for a browser that has none                |
| 7   | A cookie disagreeing with the row is corrected on the settings page, and nowhere else               |
| 8   | A theme or face outside its `CHECK` set is refused by the database                                  |
| 9   | `data-face="serif"` resolves `--ui-font-reading` to the serif stack and leaves the chrome sans      |
| 10  | Every rendered token pair clears 4.5:1 against its background in both schemes                       |
| 11  | The timeline renders one row shape at every width, collapsing rather than branching at 34rem        |
| 12  | An audio enclosure is stored once per item and copied to the reader's row by synchronization        |
| 13  | An item with several enclosures keeps the first audio or video one and no other                     |
| 14  | A rendered player carries `controls` and `preload="none"`, and no timeline row carries a player     |
| 15  | Every document carries the referrer meta that bounds what a publisher's host learns                 |
| 16  | A swiped row posts the same read toggle the button does, and the button works without script        |
| 17  | A row declares `touch-action: pan-y`, and reduced motion drops the travel and keeps the toggle      |
| 18  | A subscription's `presentation` defaults to `text` and refuses a value outside its set              |

## Implementation

- [ ] `theme` and `reading_face` on `settings`, and `presentation` on `feeds`, with their `CHECK`s
- [ ] `PRESENTATION_COOKIE` in `app/http/cookies.ts`, with its `remix/data-schema` shape
- [ ] Presentation middleware publishing `ctx.presentation`, declared in `router-context.d.ts`
- [ ] `class`, `data-face`, `colorScheme()` and the referrer meta in `DocumentLayout`
- [ ] `--ui-font-reading` under `html[data-face="serif"]`, and `font("reading")` on the reading surfaces
- [ ] Theme and face controls on `/settings`, with copy in `app/locales/en.ts` and `es.ts`
- [ ] The cookie set alongside the stored write and from the auth callback, and reconciled on `/settings`
- [ ] The contrast test over every token pair the app renders, in both schemes
- [ ] `enclosure_url`, `enclosure_type` and `enclosure_length` on `FeedDO` `items` and `feed_items`, filled at ingestion from the first `audio/` or `video/` attachment and no other
- [ ] The native player on a feed's surface and the expanded row, with copy for its label
- [ ] Swipe-to-toggle behind `clientEntry`, with `touch-action: pan-y` and `motion-safe` travel
- [ ] The presentation middleware in `AGENTS.md`'s reference list, and the settings in the README
- [ ] The tests above

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — what a stored post holds, and the per-subscription argument webcomic mode reuses
- [ADR-008](./ADR-008-keyboard-navigation.md) — the keyboard route to the actions a swipe accelerates
- [ADR-013](../ADR-013-remix-ui-for-application-interfaces.md) — the `remix/ui` rendering model every control follows
- [ADR-014](../ADR-014-r3-ui-component-library-on-remix-ui.md) — the component library the controls are built from
- [ADR-015](../ADR-015-remix-ui-utility-mixin-layer.md) — the mixin layer whose theme contract dark mode is
- [ADR-052](../ADR-052-feed-facade-package.md) — the façade that parses the enclosures a player renders
