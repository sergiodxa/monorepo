---
title: Load live regions into markdown
description: Write a frame tag in a markdown document to hold a region a route renders per request, such as an interactive island, while the prose around it stays parsed once and cached.
section:
    title: Content & feeds
    order: 8
order: 32
lastUpdated: 2026-10-25
outcomes:
    - "How to write a frame tag that holds a region a route renders per request"
    - "How to register the tag and render it with `@sdxc/markdown`"
    - "Where the region goes when the document renders outside the page"
---

A guide reads best when its example runs on the page: a component you can press, a price
from today, the latest release. The prose around that example is static, so it parses once
and caches, and the live part is a region a route renders per request. This guide writes that
region as a `frame` tag in markdown and draws it with [`@sdxc/markdown`](/api/markdown).

```bash
npm add @sdxc/http @sdxc/markdown @sdxc/result remix
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

With a fallback, the page streams straight away and swaps the region in when it arrives. A
self-closing `<frame src="/frames/latest-release" />` has no fallback, so the page waits and
sends the region inline, for a region that has to read before any script loads.

## Register the tag

`FRAME_TAG` is the tag's definition. Register it under `tags` wherever the document is parsed:

```typescript {% title="app/services/content/guide.ts" %}
import { Markdown } from "@sdxc/markdown";
import { FRAME_TAG } from "@sdxc/markdown/plugin/frames";

export const MARKDOWN_OPTIONS = {
	tags: { frame: FRAME_TAG },
} satisfies Markdown.Options;

export function readGuide(source: string) {
	return Markdown.parse(source, MARKDOWN_OPTIONS);
}
```

> [!WARNING]
> The region's HTML becomes part of the page, so `src` must be a path on the site's own
> origin. A frame pointing anywhere else fails the parse at the tag's line, and a frame with
> no `src` fails the same way.

## Render it

`FrameTag` draws the tag as a Remix frame, with the tag's children as its fallback. Pass it
to `toRemix` under the tag's name:

```tsx {% title="app/http/controllers/guide.tsx" %}
import { internalServerError } from "@sdxc/http/response/html";
import { FrameTag, toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { readGuide } from "~/app/services/content/guide";
import COLORS_GUIDE from "~/resources/content/colors.md?raw";
import routes from "~/routes/web";

export default createAction(routes.guide, (ctx) => {
	let result = readGuide(COLORS_GUIDE);
	if (isFailure(result)) return internalServerError(result.error.message);

	return ctx.render(
		<article>
			{toRemix(result.data.document, { components: { frame: FrameTag } })}
		</article>,
	);
});
```

> [!NOTE]
> The page's renderer resolves each frame by requesting its `src`. Install `render()` from
> `remix/middleware/render` in the router's middleware, and that request goes through the same
> router, carrying the reader's cookies.

## Serve the region

The route at `src` answers with an HTML fragment. A client entry inside it hydrates the way
it would on a page of its own:

```tsx {% title="app/http/controllers/frame-preview.tsx" %}
import { createAction } from "remix/router";

import { ColorPickerPreview } from "~/resources/components/color-picker-preview";
import routes from "~/routes/web";

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

## Test it

Test the parse, which checks a frame's `src`, and the plain-text render a feed or search index
reads:

```typescript {% title="app/services/content/guide.test.ts" %}
import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { readGuide } from "~/app/services/content/guide";

test("reads the fallback where the page shows the region", () => {
	let result = unwrap(
		readGuide(
			'<frame src="/frames/latest-release">\nSee the latest release.\n</frame>',
		),
	);

	expect(toPlainText(result.document)).toContain("See the latest release.");
});

test("refuses a frame on another origin", () => {
	expect(isFailure(readGuide('<frame src="https://example.com/frame" />'))).toBe(
		true,
	);
});
```

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the parse,
  transform and render steps a frame tag joins.
- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — the other
  plugins `@sdxc/markdown` ships beside frames.
- [`@sdxc/markdown`](/api/markdown) — every tag, renderer and option the package exports.
