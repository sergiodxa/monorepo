---
title: Publish RSS, Atom and JSON feeds
description: Serve one list of posts as RSS 2.0, Atom and JSON Feed, advertise them, and ping a WebSub hub when they change.
section:
    title: Content & feeds
    order: 8
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "How to serve one list of posts as RSS 2.0, Atom and JSON Feed"
    - "How to let browsers and feed readers find the feeds"
    - "How to ping a WebSub hub with `@sdxc/websub` when the feeds change"
---

A feed reader asks for a document in whichever format it was built around, so a site that
wants to be followed publishes more than one. This guide serves the same posts as RSS 2.0, Atom
1.0 and JSON Feed 1.1 from three small Remix v3 actions, advertises them, and tells a WebSub
hub the moment they change. The posts come from the pipeline in
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline).

```bash
npm add @sdxc/atom @sdxc/feed @sdxc/http @sdxc/jobs @sdxc/json-feed @sdxc/markdown \
	@sdxc/result @sdxc/rss @sdxc/websub remix
```

## One list of entries

Each format names the same facts differently, so build the facts once and let each action map
them. A feed item's body is HTML, which is what `toHTML` gives you from a parsed post:

```typescript {% title="app/services/feeds/entries.ts" %}
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

import { listPosts } from "~/app/services/content/list-posts";
import { readPost } from "~/app/services/content/posts";
import routes from "~/routes/web";

export interface FeedEntry {
	url: string;
	title: string;
	summary: string;
	html: string;
	publishedAt: Date;
	tags: string[];
}

export async function feedEntries(origin: string, limit = 20): Promise<FeedEntry[]> {
	let entries: FeedEntry[] = [];

	for (let post of (await listPosts()).slice(0, limit)) {
		let read = await readPost(post.slug);
		if (read === null || isFailure(read)) continue;

		let url = new URL(routes.posts.show.href({ slug: post.slug }), origin).href;
		let html = toHTML(read.data.document);
		let { title, description: summary, publishedAt, tags } = post;
		entries.push({ url, title, summary, html, publishedAt, tags });
	}

	return entries;
}
```

> [!WARNING]
> Write every URL in a feed as an absolute one. Readers fetch a feed from one place and display
> it in another, so a relative link in an item resolves against whatever the reader happens to
> use as its base.

Give each feed a route of its own:

```typescript {% title="routes/web.ts" %}
import { get, route } from "remix/routes";

export default route({
	posts: { index: get("/posts"), show: get("/posts/:slug") },
	feeds: {
		rss: get("/feed.xml"),
		atom: get("/atom.xml"),
		json: get("/feed.json"),
	},
});
```

## RSS 2.0

`RSS.stringify` takes the channel and its items as plain data, checks the fields RSS requires
and writes the XML, answering a `Result`. `xml` from `@sdxc/http/response` sets the content type.

```typescript {% title="app/http/controllers/feeds/rss.ts" %}
import { text, xml } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import { createAction } from "remix/router";

import { feedEntries } from "~/app/services/feeds/entries";
import routes from "~/routes/web";

export default createAction(routes.feeds.rss, async (ctx) => {
	let self = new URL(routes.feeds.rss.href(), ctx.url).href;
	let entries = await feedEntries(ctx.url.origin);

	let rss = RSS.stringify({
		channel: {
			title: "Example",
			description: "Notes on building for the web.",
			link: ctx.url.origin,
			language: "en",
			lastBuildDate: entries[0]?.publishedAt.toUTCString(),
			atomLink: { rel: "self", href: self, type: "application/rss+xml" },
		},
		items: entries.map((entry) => ({
			guid: { value: entry.url, isPermaLink: true },
			title: entry.title,
			description: entry.summary,
			link: entry.url,
			category: entry.tags,
			pubDate: entry.publishedAt.toUTCString(),
			contentEncoded: entry.html,
		})),
	});

	if (isFailure(rss)) {
		ctx.log.fail(rss.error);
		return text("Internal Server Error", { status: 500 });
	}

	return xml(rss.data);
});
```

A failure means the data lacks a required field, so the action logs it and answers with a 500.
RSS dates are RFC 822 strings, which is what `toUTCString()` writes. The `guid` is the
permalink, so a reader never shows an item twice after you edit its title, and the `atomLink`
with `rel="self"` names the address readers and hubs key a subscription by.

## Atom 1.0

`Atom.stringify` works the same way, checking the `id`, `title` and `updated` Atom requires on
the feed and every entry. Dates are RFC 3339, which is `toISOString()`.

```typescript {% title="app/http/controllers/feeds/atom.ts" %}
import { Atom } from "@sdxc/atom";
import { text, xml } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { feedEntries } from "~/app/services/feeds/entries";
import routes from "~/routes/web";

export default createAction(routes.feeds.atom, async (ctx) => {
	let self = new URL(routes.feeds.atom.href(), ctx.url).href;
	let entries = await feedEntries(ctx.url.origin);

	let atom = Atom.stringify({
		feed: {
			id: self,
			title: "Example",
			updated: (entries[0]?.publishedAt ?? new Date()).toISOString(),
			author: { name: "Ada Lovelace", uri: ctx.url.origin },
			link: [
				{ href: ctx.url.origin, rel: "alternate", type: "text/html" },
				{ href: self, rel: "self", type: "application/atom+xml" },
			],
		},
		entries: entries.map((entry) => ({
			id: entry.url,
			title: entry.title,
			updated: entry.publishedAt.toISOString(),
			published: entry.publishedAt.toISOString(),
			summary: entry.summary,
			content: { type: "html", value: entry.html },
			link: { href: entry.url, rel: "alternate" },
			category: entry.tags,
		})),
	});

	if (isFailure(atom)) {
		ctx.log.fail(atom.error);
		return text("Internal Server Error", { status: 500 });
	}

	return xml(atom.data);
});
```

> [!WARNING]
> Keep an entry's `id` fixed for its whole life. Use the permalink only if permalinks never
> change on your site; a `tag:` URI minted from the post's creation date is the alternative when
> they might.

## JSON Feed 1.1

`JSONFeed.stringify` takes camelCase fields and writes them under the format's own names
(`homePageUrl` becomes `home_page_url`). Serve the text under `JSONFeed.mediaType`:

```typescript {% title="app/http/controllers/feeds/json.ts" %}
import { text } from "@sdxc/http/response";
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { feedEntries } from "~/app/services/feeds/entries";
import routes from "~/routes/web";

export default createAction(routes.feeds.json, async (ctx) => {
	let entries = await feedEntries(ctx.url.origin);

	let json = JSONFeed.stringify({
		feed: {
			title: "Example",
			homePageUrl: ctx.url.origin,
			feedUrl: new URL(routes.feeds.json.href(), ctx.url).href,
			language: "en",
			authors: [{ name: "Ada Lovelace", url: ctx.url.origin }],
		},
		items: entries.map((entry) => ({
			id: entry.url,
			url: entry.url,
			title: entry.title,
			summary: entry.summary,
			contentHtml: entry.html,
			datePublished: entry.publishedAt.toISOString(),
			tags: entry.tags,
		})),
	});

	if (isFailure(json)) {
		ctx.log.fail(json.error);
		return text("Internal Server Error", { status: 500 });
	}

	return new Response(json.data, {
		headers: { "content-type": JSONFeed.mediaType },
	});
});
```

## Let readers find them

Browsers and feed readers look for `<link rel="alternate">` in a page's head. Render all three
there, the one you want people to subscribe to first, since readers take the first as the
site's main feed:

```tsx {% title="resources/components/feed-links.tsx" %}
import routes from "~/routes/web";

export function FeedLinks() {
	return () => (
		<>
			<link
				rel="alternate"
				type="application/rss+xml"
				title="Example"
				href={routes.feeds.rss.href()}
			/>
			<link
				rel="alternate"
				type="application/atom+xml"
				title="Example (Atom)"
				href={routes.feeds.atom.href()}
			/>
			<link
				rel="alternate"
				type="application/feed+json"
				title="Example (JSON Feed)"
				href={routes.feeds.json.href()}
			/>
		</>
	);
}
```

Place `<FeedLinks />` in your document layout's `<head>`, so someone can paste your homepage
into a reader instead of hunting for `/feed.xml`.

## Push updates with WebSub

Readers poll, and a poll interval is how long a new post waits to be seen. A WebSub hub removes
the wait: your feed names a hub, subscribers register with it, and when you ping it the hub
fetches the feed and pushes the change. The hub URL goes in a `WEBSUB_HUB` variable on your
Worker.

A subscriber may look for the hub in the response's `Link` header or in the document, so
advertise it in both:

```typescript {% title="app/services/feeds/hub.ts" %}
import { links } from "@sdxc/websub/publisher";
import { env } from "cloudflare:workers";

export function advertiseHub(self: string, type: string) {
	return {
		links: [
			{ rel: "self", href: self, type },
			{ rel: "hub", href: env.WEBSUB_HUB },
		],
		headers: { link: links({ hubs: [env.WEBSUB_HUB], self }) },
	};
}
```

In the RSS action, write `let hub = advertiseHub(self, "application/rss+xml")`, pass
`hub.links` as the channel's `atomLink` in place of the lone `self` link, and answer with
`xml(rss.data, { headers: hub.headers })`. The Atom action spreads the same `links`
after its `alternate` link, and JSON Feed takes `hubs: [{ type: "WebSub", url: env.WEBSUB_HUB }]`
on the feed plus the same headers on its `Response`.

The ping is an outbound request to someone else's server, so run it as a job and a hub that is
down gets retried (see [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)):

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	feeds: {
		ping: job({ input: s.object({ topics: s.array(s.string()) }) }),
	},
});
```

```typescript {% title="app/jobs/feeds/ping.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { publish } from "@sdxc/websub/publisher";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";

export default createJobHandler(jobs.feeds.ping, async (ctx) => {
	let pinged = await publish(env.WEBSUB_HUB, ctx.input.topics);
	if (!isFailure(pinged)) return;

	let { status } = pinged.error;
	ctx.log.set({ websub: { status, topics: ctx.input.topics.length } });

	if (status === null || status >= 500 || status === 429) {
		return ctx.retry({ delay: "5 minutes", cause: pinged.error });
	}
	return ctx.ack(pinged.error.message);
});
```

A failure carries the hub's status, or `null` when there was no answer. A server error, a rate
limit or no answer is worth another attempt; any other 4xx will be refused again. The topics
are the absolute URLs of every feed a new post changes:

```typescript {% title="app/services/feeds/topics.ts" %}
import routes from "~/routes/web";

export function feedTopics(base: URL): string[] {
	let feeds = [routes.feeds.rss, routes.feeds.atom, routes.feeds.json];
	return feeds.map((feed) => new URL(feed.href(), base).href);
}
```

Enqueue the job from whatever action publishes a post, after the post is stored, with
`await ctx.jobs.enqueue(jobs.feeds.ping, { topics: feedTopics(ctx.url) })`.

> [!WARNING]
> The hub fetches each topic the moment it is pinged. If you cache the feeds at the edge, purge
> them before enqueuing the ping, or the hub reads the copy without the new post.

## Test the feeds

Read each feed back through [`@sdxc/feed`](/api/feed) and check that it parses in its format
and that every item links back with an absolute URL:

```typescript {% title="app/http/controllers/feeds/feeds.test.ts" %}
import { Feed } from "@sdxc/feed";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

test.each([
	["rss", routes.feeds.rss],
	["atom", routes.feeds.atom],
	["json", routes.feeds.json],
] as const)("serves the %s feed with absolute links", async (format, route) => {
	let response = await createWebRouter().fetch(
		new URL(route.href(), "https://example.com"),
	);
	let feed = unwrap(Feed.parse(await response.text()));

	expect(feed.format).toBe(format);
	for (let item of feed.items)
		expect(item.url).toMatch(/^https:\/\/example\.com\//);
});
```

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — where the posts
  and their HTML come from.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — keep feeds
  cheap to serve without delaying a hub's fetch.
- [`@sdxc/feed`](/api/feed) — read RSS, Atom and JSON Feed through one normalized shape.
