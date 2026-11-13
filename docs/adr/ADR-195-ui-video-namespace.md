# ADR-195: `@sdxc/ui/video` Holds the Video Player and Its Controls

## Status

**Accepted** - 2026-11-13. Extends [ADR-186](./ADR-186-ui-component-namespaces.md).

## Background

A course landing needed a reusable video player: chapters, a transcript and captions written once
as data, time links that work without script, and an island that seeks in place. The user then
asked for a YouTube-style control bar and a settings menu that pages extend with their own rows
(ambient mode, a voice boost, a sleep timer) next to the built-in captions, speed and quality
submenus. Every one of those pieces is a part of one compound `VideoPlayer`, and the user asked
for them to live in their own namespace instead of the root.

## Context

- ADR-186 keeps the root for general components and gives each domain kit a namespace; a new kit
  is a folder plus two export entries.
- The player is used by docs, apps and landings alike, so it belongs in none of those kits, and its
  dozen parts plus their helpers would crowd the root.
- The page is server-rendered and only islands run script. A component's own mixins never run on
  server-rendered markup, so the player's behaviour has to come from one island inside it.

## Decision

1. **`@sdxc/ui/video` is a namespace** (`src/video/`, exported as `@sdxc/ui/video` and
   `@sdxc/ui/video/<module>`), holding `VideoPlayer` with all its parts, the `videoPlayerSync`
   mixin and the timeline helpers. The island's specifier is
   `@sdxc/ui/video/video-player#VideoPlayerSync`.
2. **Script is an enhancement over the native player.** The server renders `<video controls>` and
   the custom bar `hidden`; the island removes `controls` and reveals the bar, and restores both
   when it unmounts. Without script, the native controls and every `#t=` link still work.
3. **Settings rows are real form controls.** A page's toggle is a checkbox and its submenu a radio
   group under a `name`; the page follows them with ordinary `change` listeners, so the component
   holds no state a page cannot read. Built-in submenus are the same radios marked with
   `data-video-setting`.
4. **The menu keyboard is the shared one.** `menuKeys`'s logic is exported as
   `installMenuKeys(host, signal, options)`, so the island runs the same pattern on each
   server-rendered menu panel that the mixin runs on client-rendered menus.

## Consequences

- An app maps one more island specifier in its browser entry.
- A player without `.Controls` behaves exactly as before: native controls and the seek island.
- Full screen takes the screen with its bar, so the custom controls stay; the side column stays on
  the page.

## Alternatives Considered

- **A root component**: puts a dozen video-only parts and helpers beside general primitives.
- **Under `@sdxc/ui/landing`**: docs and apps would import a landing kit to show a video.
- **A settings menu built from data props**: hides each choice inside the component and stops a
  page from composing its own rows.
