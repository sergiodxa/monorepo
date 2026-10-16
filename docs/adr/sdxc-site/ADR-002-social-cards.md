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
inside the Worker bundle. The site renders with the system font stack, whose
platform faces cannot be redistributed; Inter is the closest open face.

The home page has a card of its own, since its name is the site's wordmark: the wordmark
set large and centred with the landing page's pitch under it, and a stats band below the
frame's rule with the collection's counts (packages, RFCs, UI components, styling
utilities), read from the same source as the landing page's own stats band.

### Pieces

- **`app/services/social-card.ts`** — derives a card's content (`eyebrow`, `title`,
  `description`, `url`, `footer`) from the title, description and path every page document
  already states. Titles read `Name — Section`: a section other than `sdxc` is the eyebrow
  (`Dialog — @sdxc/ui`), otherwise the path decides it (Package, API reference, Guide), and a
  package page gets `npm add <name>` as its footer. It also builds the card's URL and storage
  key from a fast synchronous hash of the content and `SOCIAL_CARD_TEMPLATE`.
- **`app/services/social-card-image.ts`** — `renderSocialCard(content, fonts)`, the template
  above, returning PNG bytes.
- **`app/initializers/social-card-fonts.ts`** — the three faces, bundled as `.ttf.bin` data
  modules (the Cloudflare Vite plugin hands a Worker a `.bin` import as an `ArrayBuffer`) and
  parsed on the first card an isolate renders, never at module scope.
- **`app/models/social-cards.ts`** — an R2-backed `FileStorage` (`get`, `has`, `list`,
  `put`, `remove`, `set`) over the `SOCIAL_CARDS` binding to the `social-cards` bucket,
  which the author's blog shares. Keys are `sdxc/<template>/<content hash>.png`, so the two
  sites' cards stay apart and a lifecycle rule can target either prefix, and a content edit or a template change writes a new
  object and old objects are never served for new content.
- **`<page path>.png`** — every page's card lives at the page's own address with `.png`
  added (`/api/jwt.png`, `/index.png` for the home page). The `socialCards()` middleware in
  `app/http/middleware/social-cards.ts` answers it ahead of routing, because route patterns
  rank by specificity and a page pattern such as `/docs/*slug` would claim the `.png` path
  over any wildcard card route. It renders the page at that path through
  the site's own router and reads `og:title` and `og:description` back, so only a real page
  has a card and the card says what the page says, with no per-page wiring. It then returns
  the stored card or renders, stores (after the response) and returns it. A request whose
  `v` matches the content hash is cached for a year as `immutable`; one without it for an
  hour. A `.png` path naming no page continues to the router, which answers as for any
  unknown address. The drawing code and fonts load on the first card drawn. A repeat
  request is answered from the colo's Workers Cache API, and a request whose `v` names a
  stored card is served from storage without rendering its page, since `v` is the hash the
  storage key is built from.
- **`DocumentLayout`** sets `og.image` and `og.image:alt` for every page with a canonical
  URL to `<page path>.png?v=<hash>` (`/index.png` for the home page). The hash
  in the URL is what makes platforms that cache images per URL fetch the new card after an
  edit.

## Consequences

### Positive

- Every page, including ones added later, gets a card with no per-page work.
- After the first request a card costs one R2 read, and the edge cache serves most requests
  before that.

### Negative

- The first request for a card spends tens of milliseconds of CPU rendering it.
- The shared `social-cards` R2 bucket must exist before the first deploy that declares it.

### Neutral

- The bucket's `expire-sdxc-cards` lifecycle rule deletes objects under `sdxc/` 90 days
  after they were written, so cards for old content and old templates do not accumulate; a
  current card that expires is drawn again on its next request.
