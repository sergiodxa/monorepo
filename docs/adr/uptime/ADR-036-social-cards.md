# ADR-036: Social Card Images for Marketing and Status Pages

## Status

**Accepted** - 2026-10-16

## Background

Every public page advertised a `summary_large_image` card with no image, so a shared link to
the product or to a customer's status page showed a bare title. Status page links are shared
most during incidents, which is when a card that shows the status helps most.

## Decision

Draw a 1200×630 card per public page in the Worker with `@sdxc/raster`, keep rendered cards in
the shared `social-cards` R2 bucket under `uptime/` through `@sdxc/file-storage-r2`, and serve
each at its page's address with `.png` added (`/vs/pingdom.png`, `/status/acme.png`,
`/index.png` for the home page).

### Marketing and docs cards

The product's dark field with an emerald glow, the brand mark and name, the page's address,
a pill naming the section (Feature, Comparison, Use case, Docs…), the page's visible `<h1>`
with its highlighted `<span>` phrase in emerald, and its description in the mono face. The
card's text is read from the page rendered in-process, so it says what the page says. The
card carries no uptime bars or figures: a marketing page has no uptime of its own to report.

### Status page cards

The page's title, a banner with the overall status in its colour and when it began, and up
to three services, each with its uptime and a bar per day for the last 90 days, coloured by
that day's status as the page's own bars are.

- **When the status began.** An operational page reads "No downtime in N days", counted from
  the daily stats; a page in an incident reads "Since Oct 16, 14:32 UTC" from the earliest
  open down or degraded alert event of its affected services
  (`alertEvents.openIncidentSince`), or "As of <date>" when no alert recorded one. A cached
  preview then reads as a snapshot of its moment rather than a claim about now.
- **Versioned by status and day.** Uptime counts completed days only and today's bar follows
  today's status, so the card's content, and with it its hash, `?v=` and storage key, change
  with a status change or a new day, never with each check.
- The status page controller and the card both load through `loadStatusPageOverview`, so the
  page and its card always report the same status.

### Serving

`socialCards()` middleware answers `<page>.png` after `models()` and before routing, since
page patterns would claim the path. It checks the Workers Cache API, then (for a status card)
storage by `?v=`, then computes the content, reads storage by its hash, and otherwise draws,
stores after the response and returns the card. Status cards are cached for five minutes;
marketing cards for a day, since their `?v=` follows the page's title and description and a
day bounds how long an edited headline takes to show. A `.png` path naming no public page
continues to the router. The drawing code and fonts (Inter and JetBrains Mono, standing in for
the product's system faces) load on the first card drawn.

The brand mark moved to `config/brand.ts` so the header and the cards draw one shape;
`@sdxc/raster`'s `Path.fromSVG` fills it from its SVG path data.

## Consequences

### Positive

- Shared links to any public page, and to every customer's status page, show a card.
- A status card shared during an incident states when the incident began.

### Negative

- The first request for a card renders its page (or loads the status overview) and draws.
- A status page in an incident reads its affected services' alert events for every view.

### Neutral

- The bucket's `expire-uptime-cards` lifecycle rule deletes objects under `uptime/` 90 days
  after they were written; a current card that expires is drawn again on its next request.
