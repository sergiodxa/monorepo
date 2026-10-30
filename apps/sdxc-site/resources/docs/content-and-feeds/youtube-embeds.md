---
title: Embed YouTube videos in markdown
description: Turn a YouTube URL pasted on its own line into a lazy-loaded, privacy-enhanced player, keeping its start time, with a plain link left for feeds.
section:
    title: Content & feeds
    order: 8
order: 33
lastUpdated: 2026-10-25
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

A paragraph becomes a player when it holds a single link that shows its own URL. A link with a
label of its own, like `[the song](https://youtu.be/dQw4w9WgXcQ)`, stays a link, so an author
decides which videos play in place. Every URL form YouTube hands out works, and a `t` or `start`
parameter carries over, so a link shared from the chorus starts the player there:

```text
{% title="Rick Astley — Never Gonna Give You Up" %}
https://youtu.be/dQw4w9WgXcQ?t=43
```

The optional annotation's `title` names the player for screen readers.

## Turn the URL into a tag

`embeds()` is a visitor for `Markdown.walk`. Given the `youtube()` provider, it replaces each
pasted YouTube URL with a `youtube` tag and leaves every other paragraph as it was:

```typescript {% title="app/services/content/prepare.ts" %}
import { Markdown } from "@sdxc/markdown";
import { embeds, youtube } from "@sdxc/markdown/plugin/embeds";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(document, embeds([youtube()]));
}
```

Each tag carries the video's `id`, its `start` in seconds, the author's `title` and the `url` as
written. Matching reads the URL alone, so the walk makes no request.

## Draw the player

`YouTubeEmbed` takes `videoId`, an optional `start`, and a required `title`. A small component
maps the tag's attributes onto it:

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

The player fills its container's width at 16:9, and `YouTubeEmbed` works in any view outside
markdown too.

> [!NOTE]
> A `youtube` tag with no component registered renders nothing, so register `YouTubeTag` wherever
> the walked document renders, or skip the walk there and the URL stays a link.

## Allow the player in your Content Security Policy

> [!WARNING]
> A page with a `frame-src` directive, or a `default-src` without one, blocks frames from any
> origin it does not list, and the player shows as an empty box. Add the player's host.

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
policy.

## Keep a link in feeds and email

Feed readers and mail clients strip `<iframe>`, so the HTML you render for them should keep the
video as a link. Register a `toHTML` renderer that writes the link back:

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

The link is rebuilt from the checked `id` and `start`, and the `&amp;` keeps it valid in an Atom
feed.

## Test it

One test covers the walk and the feed renderer: a pasted URL comes out as a link that keeps its
start time, and a labelled link stays as written:

```typescript {% title="app/services/content/render-feed.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { preparePost } from "~/app/services/content/prepare";
import { renderFeedItem } from "~/app/services/content/render-feed";

function feedItem(source: string): string {
	let { document } = unwrap(Markdown.parse(source));
	return renderFeedItem(unwrap(preparePost(document)));
}

test("writes a pasted video back as a link with its start time", () => {
	let html = feedItem("https://youtu.be/dQw4w9WgXcQ?t=43\n");

	expect(html).toContain(
		'href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=43s"',
	);
});

test("keeps a labelled link as a link", () => {
	let html = feedItem("Listen to [the song](https://youtu.be/dQw4w9WgXcQ).\n");

	expect(html).toContain('<a href="https://youtu.be/dQw4w9WgXcQ">the song</a>');
});
```

## Where to go next

- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — the Vimeo, Gist
  and X providers, and a provider of your own.
- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the parse, walk and
  render this guide plugs the player into.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — where the feed
  renderer above goes.
