---
title: Embed YouTube videos in markdown
description: Turn a YouTube URL pasted on its own line into a lazy-loaded, privacy-enhanced player, keeping its start time, with a plain link left for feeds.
section:
    title: Content & feeds
    order: 8
order: 33
lastUpdated: 2026-10-15
outcomes:
    - "How to turn a pasted YouTube URL into a lazy-loaded player with `@sdxc/markdown`"
    - "How to keep a video's start time and allow the player in your Content Security Policy"
    - "How to leave a plain link in feeds and email instead of the player"
---

An author sharing a video pastes its URL, the way they would in a chat. This guide turns that
URL into a player when the post renders: the markdown stays a plain link that reads fine on
GitHub and in an editor, and the page shows the video. It uses the `embeds` plugin from
[`@sdxc/markdown`](/api/markdown) to find the URL and
[`YouTubeEmbed`](/api/ui/youtube-embed) from [`@sdxc/ui`](/api/ui) to draw the player.

```bash
npm add @sdxc/markdown @sdxc/result @sdxc/security-headers @sdxc/ui remix
```

The player loads from `www.youtube-nocookie.com`, so a reader receives no YouTube cookies until
they press play, and it loads lazily, so a video further down the post costs nothing until the
reader scrolls to it.

## Paste the URL

Put the URL on a line of its own:

```text
Some songs never get old.

https://www.youtube.com/watch?v=dQw4w9WgXcQ

Some links never stop working either.
```

A paragraph becomes a player when it holds a single link that shows its own URL: written bare,
in angle brackets, or as a `www.` autolink. A link with a label of its own, like
`[the song](https://youtu.be/dQw4w9WgXcQ)`, or a URL in the middle of a sentence stays a link,
so an author decides which videos play in place.

Every URL form YouTube hands out works: a `watch?v=` page, a `youtu.be` share link, and the
`shorts`, `live` and `embed` paths. A `t` or `start` parameter carries over, so a link shared
from the chorus starts the player there:

```text
{% title="Rick Astley — Never Gonna Give You Up" %}
https://youtu.be/dQw4w9WgXcQ?t=43
```

The annotation on the line above is optional. Its `title` names the player for screen readers,
which announce it before a reader enters the frame.

## Turn the URL into a tag

`embeds()` is a visitor for `Markdown.walk`. Given the `youtube()` provider, it replaces each
pasted YouTube URL with a `youtube` tag and leaves every other paragraph as it was:

```typescript {% title="app/services/content/prepare.ts" %}
import { Markdown } from "@sdxc/markdown";
import { embeds, youtube } from "@sdxc/markdown/plugin/embeds";
import { unwrap } from "@sdxc/result";

export function preparePost(source: string) {
	let { document } = unwrap(Markdown.parse(source));
	return unwrap(Markdown.walk(document, embeds([youtube()])));
}
```

The share link with the annotation above becomes this node, shown without its `position`:

```json
{
	"type": "tag",
	"name": "youtube",
	"attributes": {
		"title": "Rick Astley — Never Gonna Give You Up",
		"id": "dQw4w9WgXcQ",
		"start": 43,
		"url": "https://youtu.be/dQw4w9WgXcQ?t=43"
	},
	"children": []
}
```

`id` is the video, `start` is in seconds whichever form the link wrote it in (`43`, `43s`,
`1m30s`), and `url` is the link as the author wrote it. Matching reads the URL alone, so the
walk makes no request and works the same in a build script and inside a request.

When a post already runs other visitors, `Markdown.compose` runs them in one walk:
`Markdown.compose(embeds([youtube()]), highlight)`.

## Draw the player

`YouTubeEmbed` takes `videoId`, an optional `start`, and a required `title`. A small component
maps the tag's attributes onto it, and supplies a title when the author wrote none:

```tsx {% title="resources/components/youtube-tag.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import { YouTubeEmbed } from "@sdxc/ui";

export function YouTubeTag(
	handle: Handle<{
		id: string;
		start?: number;
		title?: string;
		url: string;
		children: RemixNode;
	}>,
) {
	return () => (
		<YouTubeEmbed
			videoId={handle.props.id}
			start={handle.props.start}
			title={handle.props.title ?? "YouTube video player"}
		/>
	);
}
```

Register it under the tag's name when you render the document:

```tsx {% title="app/services/content/render-post.tsx" %}
import type { Markdown } from "@sdxc/markdown";

import { toRemix } from "@sdxc/markdown/remix";

import { YouTubeTag } from "~/resources/components/youtube-tag";

export function renderPost(document: Markdown.Document) {
	return toRemix(document, { components: { youtube: YouTubeTag } });
}
```

The pasted chorus link renders as this frame, plus the classes its styles generate:

```html
<iframe
	data-slot="youtube-embed"
	src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=43"
	title="Rick Astley — Never Gonna Give You Up"
	loading="lazy"
	referrerpolicy="strict-origin-when-cross-origin"
	allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
	allowfullscreen
></iframe>
```

The frame fills the width of its container at 16:9, so it follows the column it sits in. YouTube
plays only when it receives the embedding page's origin as referrer, which is why the frame sets
its own `referrerpolicy` whatever the page's policy is. `YouTubeEmbed` works outside markdown too:
`<YouTubeEmbed videoId="dQw4w9WgXcQ" title="Never Gonna Give You Up" />` in any view draws the
same player. A video at the top of a page can pass `loading="eager"` to start loading with it.

A `youtube` tag with no component registered renders nothing, so register `YouTubeTag` wherever
the walked document renders, or skip the walk there and the URL stays a link.

## Allow the player in your Content Security Policy

A page with a `frame-src` directive, or a `default-src` without one, blocks frames from any origin
it does not list. Add the player's host:

```typescript {% title="config/security-policy.ts" %}
import type { SecurityHeaders } from "@sdxc/security-headers";

export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["self"],
		frameSrc: ["https://www.youtube-nocookie.com"],
	},
};
```

[Security headers and CSP](/docs/identity-and-security/security-headers) covers the rest of the
policy and how to roll it out in report-only mode first.

## Keep a link in feeds and email

Feed readers and mail clients strip `<iframe>`, so the HTML you render for them should keep the
video as a link. `toHTML` renders a tag through the function registered under its name, and a
tag without one renders its children, which an embed has none of. Register a renderer that
writes the link back:

```typescript {% title="app/services/content/render-feed.ts" %}
import type { Markdown } from "@sdxc/markdown";
import type { HTMLTagRenderer } from "@sdxc/markdown/html";

import { toHTML } from "@sdxc/markdown/html";

const youtubeLink: HTMLTagRenderer = ({ attributes }) => {
	let url = new URL("https://www.youtube.com/watch");
	url.searchParams.set("v", String(attributes.id));
	if (typeof attributes.start === "number") {
		url.searchParams.set("t", `${attributes.start}s`);
	}
	let href = url.href.replaceAll("&", "&amp;");
	return `<p><a href="${href}">${href}</a></p>`;
};

export function renderFeedItem(document: Markdown.Document): string {
	return toHTML(document, { tags: { youtube: youtubeLink } });
}
```

The link is rebuilt from `id` and `start`, which the provider has already checked, so it never
carries anything else the author pasted. The `&amp;` keeps the markup valid in an Atom feed,
which an XML parser reads.

## Where to go next

- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — the Vimeo, Gist
  and X providers, and a provider of your own.
- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the parse, walk and
  render this guide plugs the player into.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — where the feed
  renderer above goes.
