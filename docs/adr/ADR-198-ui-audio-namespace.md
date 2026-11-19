# ADR-198: `@sdxc/ui/audio` Holds a Music App's Parts

## Status

**Accepted** - 2026-11-18. Extends [ADR-186](./ADR-186-ui-component-namespaces.md).

## Background

A music streaming demo on sdxc.dev needed a track table with a playing mark, artwork tiles with
their own play button, a player bar with a phone mini player, and a queue list. Its point is a
player that keeps playing while the rest of the app swaps beneath it, which also needs queue rules
(shuffle, repeat, Previous) and the Media Session API. None of those pieces is specific to that
demo, and none fits an existing kit.

## Context

- ADR-186 keeps the root for general components and gives each domain kit a namespace; a new kit
  is a folder plus two export entries.
- `@sdxc/ui/video` holds a video player whose parts are drawn on the picture and driven by one
  island inside it. A music app's player is the opposite shape: one bar drawn by the app's own
  island, outside the swapped frame, while tables and tiles in every screen start playback.
- Namespaces never import each other, so a music kit cannot borrow the video kit's helpers.

## Decision

1. **`@sdxc/ui/audio` is a namespace** (`src/audio/`, exported as `@sdxc/ui/audio` and
   `@sdxc/ui/audio/<module>`), holding `TrackList`, `MediaTile`, `PlayerBar` (with `.Track`,
   `.Button`, `.Range`, `.Seek` and `.Mini`), `QueueList` and `Equalizer`.
2. **The parts draw; the app's player drives them.** No part owns media or ships an island. The
   play queue (`createPlayQueue`, `nextInQueue`, `previousInQueue`, `toggleShuffle`,
   `cycleRepeat`) is plain data with pure functions, and `syncMediaSession` publishes a track to
   the system, so any player can use them without the components.
3. **One playing mark.** The playing row and queue item carry `aria-current="true"`; a
   `[data-audio-paused]` ancestor stills every `Equalizer`, so a player marks one attribute and
   every mark on the page follows.
4. **A row plays from anywhere on it.** `TrackList.PlayButton`'s hit area covers its row while
   the row's own links stay above it, so a table works by pointer, touch and keyboard alike.

## Consequences

- A music page composes the namespace with the root `Carousel` or `@sdxc/ui/video`'s shelf for
  its rows of tiles, imported by the app rather than by the namespace.
- The catalogue on sdxc.dev gains an Audio group with its own Foundations page.

## Alternatives Considered

- **Inside `@sdxc/ui/video`**: one "media" namespace would mix a picture-bound player with a
  frame-independent bar, and rename a namespace apps already import.
- **Root components**: track tables and player bars are useful to music apps only.
- **A player island in the package**: every app's audio source differs (files, streams, sound
  written in the browser), so the package would need a pluggable loader the parts do not need.
