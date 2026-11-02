---
title: Frames and Placeholders
impact: HIGH
tags: [performance, frames, streaming, caching, placeholders, skeleton]
---

# Frames and Placeholders

A screen exists for one thing: the list, the table, the record. Everything else on it (a chart, a
feed, a side panel) should never make that one thing wait. A Remix `<Frame>` with a `fallback` lets
the document answer with the shell and the primary content at once, then stream each secondary
part in when its own route answers. Navigation shows the new page as soon as its document arrives,
and the frames fill in after.

## What stays in the document

- The shell, the page header and the screen's primary content: the list a list screen exists for,
  the record a detail screen shows, the form an editor edits.
- Anything a keyboard shortcut, a `SaveBar` or a form spans. One form must live in one document.
- Small things. A frame is a request; a part smaller than about one card costs more than it saves.

## What becomes a frame

- Charts and stat cards on overviews.
- Activity feeds, timelines, history, deploy logs.
- Side panels and sheets whose open state is in the URL: a peek sheet, quick edit, the reading pane
  of an inbox. The frame's part names the record (`conversation/2041`), so it caches per record.

## Frames carry their own state

A frame reads what it needs from its own `src` query (`overview/chart?metric=latency&range=7d`),
never from the page around it. That makes its response a function of its address, so it caches
on its own and can be reloaded or targeted by itself.

## Placeholders reserve the final size

The fallback is a `Skeleton` in the content's shape: the same rows, the same row height, an
`aspect-ratio` box for a chart. When the frame lands, nothing below it moves. Hold that with a
browser test that measures the placeholder and the content at a phone's and a desktop's column
width and allows at most one pixel of difference. Make sure the test can fail: a wrapper with a
`min-height` hides every difference.

A feed whose length depends on data gets a placeholder that matches its count for that state, or a
fixed height with scroll inside.

## Caching per frame

- Each frame route caches like a page: a policy, a validator, and an edge copy keyed by its
  address and by the cookies it renders from.
- Keep the response a stream. A frame route that buffers its body and rebuilds it from a string
  loses the streaming and, on workerd, reaches a blocking frame in 4 KB pieces, of which it inlines
  only the first.
- A page showing a one-time toast is never cached; the frames under it still are.

## Prefetch the next page

- `data-rmx-prefetch="intent"` (100ms of hover or focus, or a press) on the links people open
  next: sidebar items, list row links, tabs, pagination.
- `viewport` only on one or two obvious next steps ("View all"), never on every row of a list.
- Only pages that are safe to load twice: nothing that posts, signs out or carries a one-time id
  such as a toast.
- Remix keeps no response it prefetched. A prefetch pays off only when the next navigation can
  reuse it: hold prefetched pages briefly in memory through `run({ prefetch, resolveFrame })`
  (single use, a short lifetime, emptied by any submission), or give the HTML a browser cache
  lifetime the navigation is allowed to reuse.
- A response that changes with `X-Remix-Target` needs `Vary: X-Remix-Target` before it is cached.

## When not to use a frame

- Content a reader without scripts must see. A non-blocking frame streams as a template that only
  the runtime swaps in, so use a blocking frame (no `fallback`), or keep it in the document.
- The primary content, or anything above it that would shift it.
- A part that renders as fast as the document and is never reloaded alone.

Worked example: the Pulse, Inkwell and Relay demos on sdxc.dev (`/demo/apps/*`), with the size
tests beside each app in `apps/sdxc-site/resources/views/demo-apps/<app>/frames.browser.test.tsx`.
