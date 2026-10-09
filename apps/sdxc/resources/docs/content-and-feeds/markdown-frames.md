---
title: Load live regions into markdown
description: Write a frame tag in a markdown document to hold a region a route renders per request, such as an interactive island, while the prose around it stays parsed once and cached.
section:
    title: Content & feeds
    order: 7
order: 32
lastUpdated: 2026-10-09
---

A guide reads best when its example runs on the page: a component you can press, a price
from today, the latest release. The prose around that example is static, so it parses once
and caches, and the live part is a region a route renders per request. This guide writes that
region as a `frame` tag in markdown and draws it with [`@sdxc/markdown`](/api/markdown).

```bash
npm add @sdxc/markdown @sdxc/result remix
```

This one is live. It is the [ColorPicker](/api/ui/color-picker) reference page's own preview,
served by its own route and hydrated inside this guide:

<frame src="/frames/previews/color-picker">
Loading the color picker…
</frame>

## Write a frame

A `frame` tag names the route that renders the region in `src`. What you write between the
opening and closing tags is markdown the page shows while the region loads:

```text
<frame src="/frames/previews/color-picker">
Loading the color picker…
</frame>
```

With a fallback, the page streams its first chunk straight away, and the client runtime swaps
the region in for the fallback when it arrives. A self-closing
`<frame src="/frames/latest-release" />` has no fallback, so the page waits for the region and
sends it inline, which is the form to pick when the region has to read before any script
loads. Add `name="…"` when a
client entry elsewhere on the page reloads the region through `handle.frames.get(name)`.

## Register the tag

`FRAME_TAG` is the tag's definition. Register it under `tags` wherever the document is parsed:

```typescript {% title="app/content/guide.ts" %}
import { Markdown } from "@sdxc/markdown";
import { FRAME_TAG } from "@sdxc/markdown/plugin/frames";

export const MARKDOWN_OPTIONS = {
	tags: { frame: FRAME_TAG },
} satisfies Markdown.Options;

export function readGuide(source: string) {
	return Markdown.parse(source, MARKDOWN_OPTIONS);
}
```

The region's HTML becomes part of the page, so `src` must be a path on the site's own
origin. A frame pointing anywhere else fails the parse at the tag's line, and a frame with
no `src` fails the same way.

## Render it

`FrameTag` draws the tag as a Remix frame, with the tag's children as its fallback. Pass it
to `toRemix` under the tag's name:

```tsx {% title="app/controllers/guide.tsx" %}
import { FrameTag, toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { readGuide } from "~/app/content/guide";
import COLORS_GUIDE from "~/content/colors.md?raw";
import routes from "~/routes";

export default createAction(routes.guide, (ctx) => {
	let result = readGuide(COLORS_GUIDE);
	if (isFailure(result)) throw result.error;

	return ctx.render(
		<article>
			{toRemix(result.data.document, { components: { frame: FrameTag } })}
		</article>,
	);
});
```

The page's renderer resolves each frame by requesting its `src`. Install `render()` from
`remix/middleware/render` in the router's middleware, and that request goes through the same
router, carrying the reader's cookies.

## Serve the region

The route at `src` answers with an HTML fragment. A client entry inside it hydrates the way
it would on a page of its own:

```tsx {% title="app/controllers/frame-preview.tsx" %}
import { createAction } from "remix/router";

import { ColorPickerPreview } from "~/components/color-picker-preview";
import routes from "~/routes";

export default createAction(routes.frames.preview, (ctx) => {
	return ctx.render(<ColorPickerPreview />);
});
```

Answer a missing region with a `404` fragment. The frame draws it in place, so a mistyped
`src` shows on the page that holds it.

## Where the region goes outside the page

`toHTML` and `toPlainText` render the tag's children, so a feed entry or a search index reads
the fallback where the page shows the region. Write a fallback that reads well on its own, a
sentence and a link to the live version, and every surface built from the document stays
whole.
