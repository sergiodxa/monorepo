# ADR-008: Social Card Images for Posts and Listings

## Status

**Accepted** - 2026-10-15

## Background

Post pages advertised a `summary` Twitter card with no image, and listings (the home feed,
each kind's index, topics) advertised no card at all, so a shared link showed a bare title.

## Decision

Draw a 1200×630 card per page in the Worker with `@sdxc/raster`, in the blog's reading
style, and keep every rendered card in R2 through a `remix/file-storage` `FileStorage`.

### Design

Both layouts sit on the pages' own background — the dark radial sheen from the top left —
with a faint emerald glow from the bottom right, the tracked `SERGIO XALAMBRÍ` line top left,
and the serif set in Source Serif 4 (SIL OFL), the open face closest to the system serif the
pages use.

- **Post card**: an emerald pill naming the kind top right, the title (shrinking from 76 to
  52 px, then wrapping to three lines), the summary under it, and a rule over the byline
  (`By Sergio Xalambrí · October 2, 2026`) and the site's host in emerald.
- **Listing card**: the page's address top right, the listing's heading and summary, and its
  three newest entries as the bordered rows the page draws, titles underlined in emerald
  with their dates, fading out toward the bottom.

### Pieces

- **`<page path>.png`** is every page's card, at the page's own address with `.png` added
  (`/articles/the-remix-way.png`, `/index.png` for the home page). The `socialCards()`
  middleware answers it ahead of routing, because the `post` and `topic` patterns take an
  extension and rank above any wildcard card route. It renders the page at that path in-process through the blog's
  own router, with the request's environment, as an anonymous visitor asking for HTML. It
  reads the card from the page's published microformats — a listing's `h-feed` name and
  first `h-entry` children, or a post's `h-entry` date with its `og:title` and description —
  so only a published page has a card and the card says what the page says. A `.png` path
  naming no published page continues to the router. The drawing code and fonts load on the
  first card drawn.
- **`app/services/social-card.ts`** reads the card, builds its URL and storage key, and
  hashes versions; **`app/services/social-card-image.ts`** draws it.
- **`app/models/social-cards.ts`** is an R2 `FileStorage` over the `SOCIAL_CARDS` bucket
  (`social-cards`, shared with the packages site), keyed `blog/<template>/<content hash>.png`
  so the two sites' cards stay apart and a lifecycle rule can target either prefix. A stored card is served
  again; a new one is stored after the response.
- **`BlogLayout`** takes a `card` reference (path and version) and emits `og:image`, its
  alt text and size, and a `summary_large_image` Twitter card in place of the page's own.
  The post, topic and feed views pass a version hashed from what the card shows, so a
  platform caching images per URL fetches the new card when the page changes.
- Cards are served with `Cache-Control: public, max-age=86400`: a listing's entries change
  with every post, and storage keeps every version the content has had.

The home page's meta description is now the profile summary rather than the author's name,
which its card shows under the heading.

## Consequences

### Positive

- Every post and listing, including future kinds that render through the same views, gets
  a card with no per-page drawing work.

### Negative

- The first request for a card renders its page and spends 150–350 ms of CPU drawing it.
- The shared `social-cards` bucket must exist before the first deploy that declares it.

### Neutral

- Objects for old content stay in R2; a lifecycle rule on the bucket can expire them.
