---
title: Pinhole
headline: A photo and short-video network whose stories, reels and likes are links and forms first
summary: An invented photo and video network with a story tray, full-screen stories, a vertical reels feed and profile grids, every screen server-rendered and working before script loads.
tagline: Stories, reels and grids, server-rendered
accent: "oklch(0.565 0.2 29)"
cover: home
shots:
  - id: home
    page: ""
    alt: Pinhole's home feed, a row of story rings above a post card with a photo carousel, like and save buttons and a caption.
  - id: story-tray
    page: ""
    highlight: "nav[aria-label='Stories']"
    alt: The story tray, a row of avatars in rings, the unseen ones in a safelight-red gradient and the seen ones grey.
  - id: carousel
    page: "p/kiln-opening"
    highlight: "[data-slot='carousel']"
    alt: A post's photo carousel of glazed bowls, with previous and next arrows, dots and a one-of-three count.
  - id: stories-phone
    page: "stories/mara.quint/1"
    viewport: phone
    alt: A story filling a phone screen, segmented progress bars across the top, the author's name, and a drawn photograph of hands trimming a bowl.
  - id: reel
    page: "reels"
    highlight: "[data-slot='reel-feed-item'] [data-slot='reel-feed-stage']"
    wait: 1500
    alt: One reel at full height, a drawn moving scene with the author and caption at its foot and like, comment and share buttons in a column.
  - id: highlights
    page: "u/mara.quint"
    highlight: "nav[aria-label='Highlights']"
    alt: A profile's highlights row, round covers each labelled with a highlight's name.
  - id: topics
    page: "explore?topic=ceramics"
    highlight: "nav[aria-label='Topics']"
    alt: Explore's topic chips with Ceramics selected.
---

Pinhole is an invented social network for photographs and short videos. It has a home feed under a story tray, stories and highlights in a full-screen viewer, a vertical reels feed, profiles with highlights and tabs, an Explore page, and a page for every post. The people are made up, and every photograph is a drawn SVG scene built from a seed and a palette. The look is darkroom paper: warm cream, ink-brown type, one safelight red, an old-style serif for the name, and nearly square corners.

What makes it worth reading is how little of it depends on JavaScript. A story's next segment is a link. A like is a form. A reel is an address. Script adds the gestures a phone expects, such as hold to pause, swipe to the next person, double tap to like and a feed that plays itself, but each of those sits on top of a page the server has already rendered in full.

## The brief

A photo network asks a lot of the browser. Stories need timed progress, tap zones and swipes, and they have to feel instant. A reels feed has to play the right video, pause the rest and load the next one before it is needed, without downloading the whole catalogue. Likes and follows have to respond the moment they are tapped. And the feed has to feel like one continuous app as you move between screens.

Pinhole takes all of that on, with one constraint: every screen has its own address, renders on the server, and keeps working when script has not loaded. The media components it needs, [ReelFeed](/api/ui/reel-feed), [StoryViewer](/api/ui/story-viewer) and [StoryRing](/api/ui/story-ring), live in `@sdxc/ui/video`. Pinhole is the app they are proven in.

## Stories that step through with links

The home feed opens with the story tray: one avatar per person who posted today, each wrapped in a [StoryRing](/api/ui/story-ring). The ring is a gradient while a person's stories are unseen and a quiet grey once they are seen, and the server draws either state.

![The story tray, a row of avatars in rings, the unseen ones in a safelight-red gradient and the seen ones grey](/showcase/pinhole/story-tray.webp "Unseen stories get the gradient ring, seen ones the grey, both drawn on the server.")

Tapping an avatar opens the [StoryViewer](/api/ui/story-viewer) at `stories/<handle>/1`. Each person is a group of timed segments, and each segment is a drawn photograph that drifts slowly while it plays, sometimes with a short clip and a sticker over it. Segmented progress bars run along the top on CSS timing. The left and right tap zones are plain links to the previous and next segment's address, so stepping through a story works with script off and every segment can be shared or reloaded.

With script, the viewer adds what a phone expects: hold to pause, swipe down to close, and a sideways swipe to the next person. People sit side by side in a horizontal scroll-snap track, so that swipe is native scrolling. The arrow keys step, Escape closes, and Space pauses. Highlights use the same viewer, grouped by highlight.

![A story filling a phone screen, segmented progress bars across the top, the author's name, and a drawn photograph of hands trimming a bowl](/showcase/pinhole/stories-phone.webp "On a phone the story fills the screen, its segments timed by CSS and stepped by links.")

## A reels feed that loads only what is next

The reels screen is a [ReelFeed](/api/ui/reel-feed): a full-height vertical scroll-snap feed with one reel per screen. The feed sets each video's `preload` from its distance to the reel on screen. The next reel's video preloads in full, the one after loads only its metadata, and the rest load nothing. Reels off screen pause. The address follows the active reel through `replaceState`, and the next reel's page is prefetched into the `main` frame, so a link to it renders without waiting.

![One reel at full height, a drawn moving scene with the author and caption at its foot and like, comment and share buttons in a column](/showcase/pinhole/reel.webp "Each reel is its own address, with the actions in one column at the edge.")

The feed plays through. When a reel ends the next one starts, and after the last one it runs on to the first again, whether the visitor swipes, scrolls, presses a key or taps an arrow. Comments open as a bottom sheet over the video on phones and tablets, and beside the video on a wide screen. The props Pinhole passes say most of this:

```tsx
<ReelFeed
	label="Reels"
	followAddress
	autoAdvance
	loop
	prefetchTarget="main"
>
```

Each `ReelFeed.Item` gets its own `href`, an `offset` from the current reel, the clip's `sources` and a drawn `backdrop` that keeps moving behind the transparent clip. A reel opened directly at `reels/<id>` renders with the page already scrolled to it.

## Carousels, grids and a double tap

A post's photos are a [Carousel](/api/ui/carousel) on a native snap track, with previous and next arrows, `Carousel.Dots` and a `Carousel.Count` that reads `1 / 3`. `CarouselSync` keeps the dots and count in step with the scroll. On a wide post page the photos fit the card, so the count stays visible for tall 4:5 posts.

![A post's photo carousel of glazed bowls, with previous and next arrows, dots and a one-of-three count](/showcase/pinhole/carousel.webp "The carousel is a native snap track, with arrows, dots and a count kept in step by CarouselSync.")

Profiles, Explore and Saved lay their tiles out in a [MediaGrid](/api/ui/media-grid), where every tile is a link named after its post. A profile adds a highlights row, each cover a [StoryRing](/api/ui/story-ring) that opens the story viewer at that highlight, and tabs for posts, reels, saved and tagged that are links with `?tab=`.

![A profile's highlights row, round covers each labelled with a highlight's name](/showcase/pinhole/highlights.webp "Each highlight opens the same story viewer, at its own address.")

The one interaction Pinhole writes itself is double tap to like. It is a small island, `double-tap-like.tsx`, that listens for `dblclick` on a post's media. It presses the post's own like button, unless the post is already liked, and plays a heart burst over the photo. Without script, the heart under the post is the way to like it, and it is the same form either way.

## Likes that answer at once and stay yours

Like, save, follow and liking a comment are each an [OptimisticToggle](/api/ui/optimistic-toggle) around a real form. The button flips the moment it is pressed, and the form posts in the background. Every toggle is written to a cookie of its own, keyed by the post, reel, person or comment. Two quick taps on different posts therefore never overwrite each other. Comments a visitor writes, up to 300 characters, go into one more cookie.

The server reads those cookies to draw every count and button. A request that carries any of them is marked personal, so it renders fresh and never comes from, or goes into, the edge cache that serves everyone else. The More menu resets everything with one post and a toast.

## One frame, two layouts

The shell mounts the content area once as the `main` frame. Moving between screens and posting a form replace only that region, so the rail, the tab bar and any playing media around them stay put, and each screen still answers its own address in full. A thin loading bar shows while a screen swaps.

Desktops get a left rail whose labels appear at 80rem and wider, and icons alone below that. Phones get a top bar and a [TabBar](/api/ui/tab-bar). Explore reads `?q=` and `?topic=`, so a search for bread, a person's name, a topic chip and an empty result are each a screen with its own address.

![Explore's topic chips with Ceramics selected](/showcase/pinhole/topics.webp "Topics are links that set ?topic=, so every filtered grid is an address.")

## Takes after

- [Instagram](https://www.instagram.com) — the story tray over the feed, highlights on a profile, the three-column grid and double tap to like. Pinhole draws its own darkroom look and keeps every story segment a link.
- [TikTok](https://www.tiktok.com) — one full-height video per swipe with the actions in a column at the edge. Pinhole's feed loops back to the first reel and gives each reel its own address.

## Where to start reading

- [`pinhole/reels.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/pinhole/reels.tsx) — the reels screen built on `ReelFeed`, with its comment sheet.
- [`pinhole/stories.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/pinhole/stories.tsx) — stories and highlights grouped into a `StoryViewer`.
- [`pinhole/double-tap-like.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/pinhole/double-tap-like.tsx) — the one island Pinhole writes itself.
- [`pinhole/state.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/pinhole/state.ts) — a cookie per toggle, read on the server.
