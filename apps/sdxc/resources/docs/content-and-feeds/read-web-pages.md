---
title: Read other people's pages
description: Save links for later by fetching each page under bounds in a job, pulling out its article, and building preview cards.
section:
    title: Content & feeds
    order: 7
order: 5
lastUpdated: 2026-09-29
---

A "save for later" button looks like one line of work: fetch the URL, keep the article. The
URL is one a stranger chose, though, so the fetch has to refuse your own network, stop at a
byte cap and a deadline, and treat whatever comes back as hostile markup. This guide builds
that feature: an endpoint accepts a link, a background job reads the article out of the page,
and your app stores a sanitized copy and a plain-text excerpt.

[`@sdxc/distill`](/api/distill) fetches under bounds, scores the page to find the article and
sanitizes it. [`@sdxc/html`](/api/html) parses markup and answers questions about it: the
visible text, a meta tag, a canonical link. [`@sdxc/robots`](/api/robots) lets a publisher say
no, and [`@sdxc/jobs`](/api/jobs) keeps the fetch off the request.

```bash
npm add @sdxc/distill @sdxc/html @sdxc/robots @sdxc/jobs @sdxc/result \
	@sdxc/validate @sdxc/http remix
```

## Declare the job

Reading a page takes up to eight seconds, and nobody should wait on that when they press save.
The endpoint stores the link and enqueues a job that reads it:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	links: {
		read: job({ input: s.object({ linkId: s.string() }) }),
	},
});
```

The message carries the link's id rather than its URL, so the job always reads the row as it is
now, and a link deleted before the queue gets to it ends the run early.

## Accept the link

`addressable(url)` is the check the fetch itself makes before any request: HTTP(S) only, no
credentials in the URL, no literal IP address, and no name that cannot be public, such as a
single label, `localhost`, `.local`, `.internal` or `.test`. Running it in the endpoint turns a link
the job would refuse into an immediate `422`, instead of a row that fails later:

```typescript {% title="app/http/controllers/links/create.ts" %}
import { addressable } from "@sdxc/distill";
import { accepted, unprocessableEntity } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import { Links } from "~/app/repositories/links";
import routes from "~/routes/web";

const SAVE_LINK = s.object({ url: s.string() });

export default createAction(routes.links.create, async (ctx) => {
	let body = await validate(ctx.request, SAVE_LINK);
	if (isFailure(body)) return unprocessableEntity({ issues: body.error.issues });

	let url = addressable(body.data.url);
	if (isFailure(url)) return unprocessableEntity({ error: url.error.message });

	let link = await Links.save(ctx.db, { url: url.data.href });
	await ctx.jobs.enqueue(jobs.links.read, { linkId: link.id });
	return accepted({ id: link.id, status: link.status });
});
```

`Links` is your own repository; `save` inserts a row with a `pending` status. The route is a
`post("/api/links")`, and `validate` reads a JSON or form body alike, so a browser extension
and a plain form can share it.

`ctx.jobs` comes from `jobEnqueuer(queue)` in the router's middleware, over the queue your
dispatcher delivers from. [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)
builds both:

```typescript {% title="bootstrap/app.ts" %}
import { jobEnqueuer } from "@sdxc/jobs/router";
import { createRouter } from "remix/router";

import { queue } from "~/app/jobs/queue";

export const router = createRouter({ middleware: [jobEnqueuer(queue)] });
```

## Read the article in the job

`distill(url, options)` walks the redirect chain itself, re-checking every hop with the same
`addressable` rule, reads at most 2 MB off the stream, and gives the whole chain eight seconds.
It scores the page's containers, keeps the one holding the article, and sanitizes it before
answering:

```typescript {% title="app/jobs/links/read.ts" %}
import { distill } from "@sdxc/distill";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { fetchRobots } from "@sdxc/robots/fetch";

import jobs from "~/app/jobs";
import { excerptOf } from "~/app/lib/excerpt";
import { Links } from "~/app/repositories/links";

const USER_AGENT = "Shelf/1.0 (+https://shelf.example/about/bot)";

export default createJobHandler(jobs.links.read, async (ctx) => {
	let link = await Links.find(ctx.database, ctx.input.linkId);
	if (link === null) return ctx.exit("The link was deleted");

	let robots = await fetchRobots(link.url, { userAgent: USER_AGENT });
	let article = await distill(link.url, { userAgent: USER_AGENT, robots });

	if (isFailure(article)) {
		let { outcome } = article.error;
		ctx.log.set({ link: { outcome } });
		if (outcome === "timeout" && ctx.attempts < 3) {
			return ctx.retry({ delay: "15 minutes" });
		}
		await Links.markUnreadable(ctx.database, link.id, outcome);
		return;
	}

	let { byline, html, mayCache, title, url } = article.data;
	let excerpt = excerptOf(html);
	await Links.markRead(ctx.database, link.id, {
		url,
		title,
		byline,
		excerpt,
		html: mayCache ? html : null,
	});
	ctx.log.set({ link: { outcome: "extracted", bytes: article.data.bytes } });
});
```

The user agent is required, and it names your app and a page about it, so a publisher who wants
to refuse you in particular can do it without refusing browsers. `fetchRobots` retrieves the
origin's `robots.txt`, and a path it disallows is refused before `distill` sends a request.
Its outcome carries a `lifetimeMs`, so once many links share an origin, cache it as JSON for
that long instead of asking on every run.

Every failure carries an `outcome` your interface can have copy for: `refused` (the site said
no, by status or by `robots.txt`), `timeout` (time, bytes or hops ran out) and `empty` (the page
arrived with no article in it). Only a timeout is worth trying again, and only a few times;
the other two would give the same answer. `ctx.database` is published by job middleware,
the same way `ctx.db` is on a request.

On success, `url` is the article's canonical address, so two links to one article can be
recognized as one. `mayCache` is `false` when the response's `X-Robots-Tag` says `noarchive`:
that publisher is asking you not to keep a copy, so the row keeps the title and the excerpt
and drops the body.

## Keep a plain-text excerpt

A list of saved links needs a line or two under each title, and it must be text, not markup.
`HTML.parse` reads the sanitized article back, and `text` is what a reader would see, with
block boundaries turned into spaces:

```typescript {% title="app/lib/excerpt.ts" %}
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

const EXCERPT_LENGTH = 280;

export function excerptOf(html: string): string | null {
	let page = HTML.parse(html);
	if (isFailure(page)) return null;

	let text = page.data.text;
	if (text.length <= EXCERPT_LENGTH) return text;

	let cut = text.slice(0, EXCERPT_LENGTH - 1);
	let space = cut.lastIndexOf(" ");
	return `${space > 0 ? cut.slice(0, space) : cut}…`;
}
```

The stored `html` is already safe to put in your page. The sanitizer keeps prose, lists,
tables, figures, links and images, drops scripts, iframes, forms, every `on*` handler, `style`
and `class`, restricts URLs to `http:`, `https:` and `mailto:`, and resolves relative ones
against the article's address. A
[Content-Security-Policy](/docs/identity-and-security/security-headers) on the page that
renders it is the second line behind that. An image still loads from the publisher, who sees
the reader's address when it does; closing that takes an image proxy of your own.

## Build a preview card from the head

Not every link needs its article. A URL pasted into a comment only needs a card: a title, a
line of description, an image. `@sdxc/outbound` is the bounded fetch `distill` runs on, and
`@sdxc/html` reads the head of what it returns:

```typescript {% title="app/services/link-preview.ts" %}
import { HTML } from "@sdxc/html";
import { follow, readText, release } from "@sdxc/outbound";
import { isFailure, isSuccess } from "@sdxc/result";

const USER_AGENT = "Shelf/1.0 (+https://shelf.example/about/bot)";

export interface LinkPreview {
	url: string;
	title: string | null;
	description: string | null;
	image: string | null;
}

export async function previewOf(input: string): Promise<LinkPreview | null> {
	let followed = await follow(input, {
		headers: { accept: "text/html", "user-agent": USER_AGENT },
		timeout: "3 seconds",
		literals: "refuse",
	});
	if (isFailure(followed)) return null;

	let { response, url } = followed.data;
	if (!response.ok) {
		release(response.body);
		return null;
	}

	let body = await readText(response, { maxBytes: 512 * 1024 });
	let page = isSuccess(body) ? HTML.parse(body.data.text) : body;
	if (isFailure(page)) return null;

	let doc = page.data;
	let title = doc.meta("og:title");
	let description = doc.meta("og:description");
	let image = doc.meta("og:image");

	return {
		url: url.href,
		title: isSuccess(title) ? title.data : (doc.title ?? null),
		description: isSuccess(description) ? description.data : null,
		image: isSuccess(image) ? (URL.parse(image.data, url)?.href ?? null) : null,
	};
}
```

`follow` applies the same host rules as `addressable` to the first URL and to every redirect,
and answers the final response whatever its status, so the card checks `response.ok` itself
and lets go of a body it will not read. `url` is where the redirect chain ended, which is the
address to show and the base every relative URL in the page resolves against. The timeout
covers the chain and the body read after it. `doc.meta` matches `name` or `property`, so Open
Graph tags and plain `<meta name>` tags are one lookup, and each answers a `Result` because a
page is free to leave any of them out.

A card is optional, so every failure here becomes `null` and the comment renders without one.
The shorter deadline is for the same reason: a card that takes eight seconds is not worth
having. Call `previewOf` from a job, the same way the article is read.

## Clean markup that arrives another way

Some markup reaches you without a fetch: the `content` of a feed item, or an HTML email.
`HTML.sanitize(source, policy)` is the same allow-list `distill` applies, run on markup in
hand:

```typescript {% title="app/lib/feed-content.ts" %}
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

export function cleanContent(source: string, itemUrl: string): string | null {
	let clean = HTML.sanitize(source, { baseUrl: itemUrl });
	return isFailure(clean) ? null : clean.data;
}
```

`baseUrl` is where the markup came from, so a relative `src` points at the publisher's site
rather than yours. When you already hold a whole page, from a test fixture or a response
something else retrieved, `distillFrom(source, url)` from `@sdxc/distill` runs the scoring and
sanitizing without a fetch, which is how to test the job's extraction without the network.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  the queue and the middleware behind `ctx.database`.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — the policy for
  the page that renders someone else's article.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — publish the
  saved links as a feed of their own.
- [Join the IndieWeb: Webmention and Micropub](/docs/content-and-feeds/indieweb) — another
  place your app fetches a URL a stranger chose.
