# ADR-002: Social Card Images Per Page

## Status

**Accepted** - 2026-10-15

## Background

No page on sdxc.dev sets `og:image`, so a shared link shows a bare title. The site's
landing page has a distinctive look — a faded grid, a brand glow, dashed rails and rules
with indigo markers — and a card that repeats it makes every shared page recognisable.

## Decision

Render one 1200×630 PNG per page in the Worker with `@sdxc/raster`
([ADR-151](../ADR-151-raster-package.md)), and keep every rendered card in R2 through a
`remix/file-storage` `FileStorage`.

### Design

The card repeats the landing's closing band: background, a brand radial glow from the top
right, a 48 px grid masked by a radial fade from the centre, full-width rules at y=96 and
y=534, dashed rails at x=96 and x=1104, a brand square where each rule meets a rail, the
`sdxc` wordmark top left and the page's URL top right above the first rule, an eyebrow
(package name, guide section, or "Component") in mono and brand colour, the title in Inter
SemiBold with negative tracking (shrinking to fit two lines), the description in Inter
Regular (clamped to two lines), and a mono footer line under the second rule (the install
command on a package page). Colours are the site's oklch tokens, parsed with `color()`.

The fonts are Inter (Regular, SemiBold) and JetBrains Mono (Regular), both SIL OFL, shipped
as `.ttf` inside the Worker bundle. The site renders with the system font stack, whose
platform faces cannot be redistributed; Inter is the closest open face.

### Pieces

- **`app/services/social-card.ts`** — `renderSocialCard(card: SocialCard.Content)`, the
  template above, returning PNG bytes. Fonts parse once per isolate on first use, never at
  module scope.
- **`app/services/social-card-content.ts`** — resolves a page path to its card content
  (`eyebrow`, `title`, `description`, `url`, `footer`) from the same catalogue the page
  renders from, and returns nothing for a path that is not a page, so the route never
  renders arbitrary text.
- **`app/models/social-cards.ts`** — an R2-backed `FileStorage` (`get`, `has`, `list`,
  `put`, `remove`, `set`) over the `SOCIAL_CARDS` bucket binding. Keys are
  `<template version>/<sha-256 of the card content>.png`, so a content edit or a template
  change writes a new object and old objects are never served for new content.
- **`GET /social/*`** — the image route. It resolves the content, hashes it, returns the
  stored file when present, and otherwise renders, stores and returns it, with
  `Cache-Control: public, max-age=31536000, immutable`. A path that is not a page is 404.
- **`DocumentLayout`** sets `og.image` (with its alt, width and height) for every page to
  `/social/<page path>.png?v=<hash>`. The hash in the URL is what makes platforms that cache
  images per URL fetch the new card after an edit.

## Consequences

### Positive

- Every page, including ones added later, gets a card with no per-page work.
- After the first request a card costs one R2 read, and the edge cache serves most requests
  before that.

### Negative

- The first request for a card spends tens of milliseconds of CPU rendering it.
- A new R2 bucket must exist before the deploy that declares it.

### Neutral

- Unreferenced objects from old content or old templates stay in R2; a lifecycle rule on
  the bucket can expire them.
