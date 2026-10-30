---
title: Read other people's pages
description: Save links for later by fetching each page under bounds in a job, pulling out its article, and building preview cards.
section:
    title: Content & feeds
    order: 8
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "How to fetch a saved link under bounds in a job and pull out its article with `@sdxc/distill`"
    - "How to keep a plain-text excerpt of the page"
    - "How to build a preview card from the page's head"
---

A "save for later" button looks like one line of work: fetch the URL, keep the article. The
URL is one a stranger chose, though, so the fetch has to refuse your own network, stop at a
byte cap and a deadline, and treat whatever comes back as hostile markup. This guide builds
that feature: an endpoint accepts a link, a background job reads the article out of the page,
and your app stores a sanitized copy and a plain-text excerpt.

[`@sdxc/distill`](/api/distill) fetches under bounds, finds the article and sanitizes it,
[`@sdxc/html`](/api/html) reads text and meta tags out of markup, [`@sdxc/robots`](/api/robots)
lets a publisher say no, and [`@sdxc/jobs`](/api/jobs) keeps the fetch off the request.

```bash
npm add @sdxc/distill @sdxc/html @sdxc/http @sdxc/jobs @sdxc/outbound @sdxc/result \
	@sdxc/robots @sdxc/validate remix
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

The message carries the link's id, so the job reads the row as it is now.

## Accept the link

`addressable(url)` is the check the fetch itself makes before any request: HTTP(S) only, no
credentials, no literal IP address, and no name that cannot be public. Running it in the
endpoint turns a link the job would refuse into an immediate `422`:

```typescript {% title="app/http/controllers/links/create.ts" %}
import { addressable } from "@sdxc/distill";
import { accepted, unprocessableEntity } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import { Links } from "~/app/models/links";
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

`Links` is your own model; `save` inserts a row with a `pending` status. `ctx.jobs` comes from
`jobEnqueuer(queue)` in the router's middleware, which
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) builds.

## Read the article in the job

`distill(url, options)` re-checks every redirect with the same `addressable` rule, reads at most
2 MB, and gives the whole chain eight seconds. It answers the page's article, sanitized:

```typescript {% title="app/jobs/links/read.ts" %}
import { distill } from "@sdxc/distill";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { fetchRobots } from "@sdxc/robots/fetch";

import jobs from "~/app/jobs";
import { excerptOf } from "~/app/services/excerpt";
import { Links } from "~/app/models/links";

const USER_AGENT = "Shelf/1.0 (+https://shelf.example/about/bot)";

export default createJobHandler(jobs.links.read, async (ctx) => {
	let link = await Links.find(ctx.db, ctx.input.linkId);
	if (link === null) return ctx.exit("The link was deleted");

	let robots = await fetchRobots(link.url, { userAgent: USER_AGENT });
	let article = await distill(link.url, { userAgent: USER_AGENT, robots });

	if (isFailure(article)) {
		let { outcome } = article.error;
		ctx.log.set({ link: { outcome } });
		if (outcome === "timeout" && ctx.attempts < 3) {
			return ctx.retry({ delay: "15 minutes" });
		}
		await Links.markUnreadable(ctx.db, link.id, outcome);
		return;
	}

	let { byline, html, mayCache, title, url } = article.data;
	let excerpt = excerptOf(html);
	await Links.markRead(ctx.db, link.id, {
		url,
		title,
		byline,
		excerpt,
		html: mayCache ? html : null,
	});
	ctx.log.set({ link: { outcome: "extracted", bytes: article.data.bytes } });
});
```

The user agent names your app and a page about it, so a publisher can refuse you in particular.
A path `robots.txt` disallows is refused before `distill` sends a request. Every failure carries
an `outcome`: `refused`, `timeout` or `empty`; only a timeout is worth trying again. On success,
`url` is the article's canonical address.

> [!NOTE]
> `mayCache` is `false` when the response's `X-Robots-Tag` says `noarchive`. That publisher is
> asking you not to keep a copy, so the row keeps the title and the excerpt and drops the body.

## Keep a plain-text excerpt

A list of saved links needs a line of text under each title. `HTML.parse` reads the sanitized
article back, and `text` is what a reader would see:

```typescript {% title="app/services/excerpt.ts" %}
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

The stored `html` is already safe to put in your page: scripts, forms, handlers and styles are
gone, and relative URLs point at the publisher. A
[Content-Security-Policy](/docs/identity-and-security/security-headers) on the page that
renders it is the second line behind that.

## Build a preview card from the head

A URL pasted into a comment only needs a card: a title, a description, an image.
`@sdxc/outbound` is the bounded fetch `distill` runs on, and `@sdxc/html` reads the head of what
it returns:

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

`follow` applies the same host rules to every redirect and answers the final response whatever
its status, so the card checks `response.ok` and releases a body it will not read. `url` is
where the chain ended, the base relative URLs resolve against. A card is optional, so every
failure becomes `null`; call `previewOf` from a job, the same way the article is read.

## Test the extraction

`distillFrom(source, url)` runs the job's extraction on a page in hand, so a fixture tests what
your app stores without the network:

```typescript {% title="app/services/excerpt.test.ts" %}
import { distillFrom } from "@sdxc/distill";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { excerptOf } from "~/app/services/excerpt";

const PARAGRAPH =
	"Workers run close to the reader, so a page answers before a round trip "
		.concat("to one region would finish. ")
		.repeat(3);

const PAGE = `<html><head><title>Edge reads</title></head><body>
<nav><a href="/">Home</a></nav>
<article><h1>Edge reads</h1><p>${PARAGRAPH}</p><p>${PARAGRAPH}</p>
<img src="/chart.png" alt="A chart" onerror="steal()"><script>steal()</script></article>
</body></html>`;

test("stores a sanitized article and a short excerpt", () => {
	let article = unwrap(distillFrom(PAGE, "https://blog.com/posts/edge"));

	expect(article.html).not.toContain("<script");
	expect(article.html).not.toContain("onerror");
	expect(article.html).toContain('src="https://blog.com/chart.png"');

	let excerpt = excerptOf(article.html);
	expect(excerpt?.length).toBeLessThanOrEqual(280);
	expect(excerpt).toMatch(/^Edge reads Workers run close to the reader.*…$/);
});
```

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  the queue and the middleware behind `ctx.db`.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — the policy for
  the page that renders someone else's article.
- [Join the IndieWeb: Webmention and Micropub](/docs/content-and-feeds/indieweb) — another
  place your app fetches a URL a stranger chose.
