# ADR-196: `@sdxc/ui/video` Also Holds the Pieces a Video Library Browses With

## Status

**Accepted** - 2026-11-17. Extends [ADR-195](./ADR-195-ui-video-namespace.md).

## Background

A streaming-service demo needed three pieces every video library has: a title as a card with its
art and how much of it was watched, a row of those cards that scrolls sideways, and a season's
episodes as a list. None of them is specific to that demo. A course site lists its lessons the
same way, and a conference site lists its talks the same way.

## Decision

1. **`@sdxc/ui/video` holds the catalogue pieces beside the player**: `VideoCard`, `VideoShelf`
   with `.Item`, and `EpisodeList` with `.Item`. Each also imports on its own, as
   `@sdxc/ui/video/<module>`.
2. **A shelf scrolls with no script.** It is a scroll-snapping list inside a labelled region, so
   touch, trackpad, wheel and Tab all move it. The `VideoShelfSync` island
   (`@sdxc/ui/video/video-shelf#VideoShelfSync`) only reveals the paging buttons at its edges and
   disables them at either end. The browser entry maps that specifier, as it does for the player.
3. **Watched progress is drawn and spoken separately.** The bar is decorative, and the consumer
   passes the words a screen reader hears (`progressLabel`), since the library ships no copy.
4. **Cards and rows answer to their own box.** Item sizes come from the shelf's container
   (`cqi`), and an episode row moves its still beside the text through a named container query.
   Neither reads the viewport.

## Consequences

- An app that shows shelves maps one more island specifier in its browser entry.
- A page sets `--ui-video-shelf-inset` to its gutter, so the first card lines up with the page
  while the row still runs edge to edge.

## Alternatives Considered

- **Build the shelf on `Carousel`**: its controls need a mixin the page hydrates itself, and its
  slides are a fixed width, not a share of the row.
- **A new `@sdxc/ui/media` namespace**: it would split one domain across two imports, with the
  card and the player that plays it in different namespaces.
