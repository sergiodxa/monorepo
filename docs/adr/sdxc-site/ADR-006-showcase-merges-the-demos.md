# ADR-006: The Showcase Holds Every Demo, Each Under Its Case Study

## Status

**Implemented** - 2026-11-21

## Background

sdxc.dev had two lists of things built on the packages. `/showcase` named the applications
running in production. `/demo` was a gallery of demos for invented products: eleven landings at
`/demo/:slug`, four docs sites at `/demo/docs/:site` and sixteen apps at `/demo/apps/:app`, with
their frames, streams, files and posts under each app's path. The gallery grew long, and a demo
card sat beside nothing that said it was a demo, so an invented product could read as an sdxc one.

## Decision

### One showcase, one address per item

- `/showcase` lists everything. A row of what runs in production comes first, then a grid of
  every demo. `?kind=` (`all`, `production`, `demo`, `app`, `landing`, `docs`) narrows it, and
  each filter is a plain link with its own address; `app`, `landing` and `docs` narrow the
  demos. Every tile carries a chip, "In production", "Source only" or "Demo", beside its
  category, and a case study names both together: "Production app", "Landing demo".
- An item has a kind, production or demo, and a category, app, landing or docs. Production
  holds the applications in this repository and the product landings an application serves
  (Wakaba and Encore, pages of the author's site), listed in `resources/content/apps.ts`; a
  landing's packages and components come from its views folder and what it imports.
- `/showcase/:slug` is a case study for every item, real applications included. Its copy is a
  Markdown file, `resources/content/showcase/<slug>.md`, so it is reviewed as prose. The
  `@sdxc/*` packages and `@sdxc/ui` entries an item uses come from its own imports, read at
  build time by `scripts/extract-showcase.ts`; the copy never lists them by hand.
- `/showcase/:slug/demo(/*page)` is the demo itself, whatever its kind, with `frames`,
  `streams` and `files` beneath it. An app's cookies are scoped to that path, so its pages,
  posts and frames share them and no other page receives them.

### A slug names one item across every kind

A landing, a docs site and an app share one address shape, so the router cannot tell them apart
by pattern. One dispatcher per shape (`app/http/controllers/showcase/demo.ts`) looks the slug up
in the demo folders (`app/services/demos.ts`) and hands the request to that kind's controller,
loaded only then. That holds only while a slug is unique across applications, landings, docs
sites and apps, which `app/services/case-studies.test.ts` checks. Landings took their product's
name (`ai` → `margin`, `saas` → `keel`), and the folder name is still the slug.

A docs site's `.md` twin is a path under the same route: the dispatcher sends a docs page ending
in `.md` to the Markdown controller, and an app's path ending in `.md` stays a screen, since a
code host names files that way.

### Old addresses redirect with 308

Every `/demo` address answers a `308`, which keeps a form post's method and body, with its query
string kept: the galleries to `/showcase?kind=demo`, every `/demo/apps/:slug(/*rest)` through
one route to `/showcase/:slug/demo(/rest)`, the docs sites and their frames likewise, the
landings through a map of old names to new, and clips from `/demo/media` to `/showcase/media`.

### Indexing

The showcase and the case studies may be indexed and are in the sitemap. Demos stay
`noindex, nofollow`, and robots.txt disallows `/showcase/*/demo` and `/demo`.

### Each case study has its own social card

A case study's `og:image` is drawn for its item, through the same card route and storage as
every other page: the item's name, its chips as the showcase words them, and a short `tagline`
from the front matter on the left, and its cover in a browser window running off the right and
bottom edges. The background is the colour the cover is mostly painted in and the accent its
most vivid colour, read at build time from `public/showcase/<slug>/card.png` (the cover scaled
to the card); an item whose brand colour the cover barely shows names it as `accent`. The
Worker reads that PNG through its `ASSETS` binding and draws it with `@sdxc/raster`'s
`imagePattern`, and the card URL's hash covers the image's, so a re-shot cover gets a new card.

## Consequences

- A new demo is still one folder; it needs a case study before the case-study test passes.
- The screenshots a case study shows are listed in its front matter and captured from a
  production build by `scripts/capture-showcase.ts`, so a demo's redesign is re-shot by running
  it again. Each is captured in light and in dark (`<id>-dark.webp`), and the page picks the
  one matching the reader's system scheme, as the site's own theme does.
- `sergiodxa.com/apps` stays the author's list of real products; the showcase links only to the
  applications in this repository.
