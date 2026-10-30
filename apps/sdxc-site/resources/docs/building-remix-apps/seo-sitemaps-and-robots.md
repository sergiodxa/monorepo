---
title: SEO, sitemaps and robots.txt
description: Give every page one canonical URL and structured data, and serve sitemap.xml, robots.txt and security.txt from routes.
section:
    title: Building Remix apps
    order: 4
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "How to give every page one canonical URL and structured data"
    - "How to serve `sitemap.xml` and `robots.txt` from routes"
    - "How to serve `security.txt` with `@sdxc/well-known`"
---

A crawler learns about your site from the head of each page, the sitemap, the robots file and
the documents under `/.well-known/`. This guide sets up all four from one source of truth:
[`@sdxc/seo`](/api/seo) for head tags and structured data, [`@sdxc/sitemap`](/api/sitemap) and
[`@sdxc/robots`](/api/robots) for the crawl files, and [`@sdxc/well-known`](/api/well-known)
for `security.txt`.

```bash
npm add @sdxc/http @sdxc/robots @sdxc/seo @sdxc/sitemap @sdxc/well-known remix
```

## Create one instance for the site

The same Worker answers on your custom domain, its `workers.dev` name and every preview, and a
page served from any of them must name one address. `createSeo` builds every URL from the
configured origin, whichever host served the request:

```typescript {% title="app/initializers/seo.ts" %}
import { createSeo } from "@sdxc/seo";

export const seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "Project planning for small teams, with an API.",
	twitter: { site: "@example", card: "summary_large_image" },
});
```

`seo.canonical(ctx.url)` swaps in that origin and drops the hash and a trailing slash, and
`seo.absolute("/og/cover.png")` does the same for an asset.

## Render head metadata from the layout

The document layout takes the page's metadata as a prop and renders it with `Seo`, so each
page decides its own copy and the tag set stays identical everywhere:

```tsx {% title="resources/layouts/document.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import { Seo } from "@sdxc/seo";

interface Props {
	children: RemixNode;
	locale: string;
	seo: Seo.Props;
}

export default function DocumentLayout(handle: Handle<Props>) {
	return () => (
		<html lang={handle.props.locale}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Seo {...handle.props.seo} />
			</head>
			<body>{handle.props.children}</body>
		</html>
	);
}
```

`Seo` writes the `<title>`, description, canonical link, robots directive, and the Open Graph
and Twitter tags, skipping any tag whose input is missing.

## Add structured data from a page

A page passes its own metadata, including any schema.org nodes. The builders on `seo.schema`
fill `@context` and `@type` and make URLs canonical and absolute. `Post` is your model, and
`ctx.locale` comes from [Translate your app](/docs/building-remix-apps/translate-your-app).

```tsx {% title="app/http/controllers/post.tsx" %}
import type { Seo } from "@sdxc/seo";

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Post from "~/app/models/post";
import defaultHandler from "~/app/http/controllers/default-handler";
import { seo } from "~/app/initializers/seo";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.post, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let post = await Post.find(ctx.db, slug);
	if (post === null) return defaultHandler(ctx);

	let meta: Seo.Props = {
		title: post.title,
		description: post.excerpt,
		canonical: seo.canonical(ctx.url),
		site: seo.site,
		og: { type: "article", image: seo.absolute(post.cover) },
		schema: [
			seo.schema.article({
				headline: post.title,
				datePublished: post.publishedAt,
				author: { name: post.author, url: "/about" },
				image: post.cover,
				url: routes.post.href({ slug }),
			}),
		],
	};

	return ctx.render(
		<DocumentLayout seo={meta} locale={ctx.locale}>
			<h1>{post.title}</h1>
		</DocumentLayout>,
	);
});
```

The JSON escapes every `<`, so a title containing `</script>` cannot break out of the element.
A page that should stay out of the index says so itself, with
`robots: seo.robotsTag({ index: false, follow: true })`.

## Serve the sitemap

Declare the machine-readable files next to your pages in the route table:

```typescript {% title="routes/web.ts" %}
import { get, route } from "remix/routes";

export default route({
	home: get("/"),
	blog: get("/blog"),
	post: get("/blog/:slug"),
	sitemap: get("/sitemap.xml"),
	robots: get("/robots.txt"),
});
```

`fromRoutes` builds the sitemap from that table and needs a decision for every `GET` route, so
a new page fails typechecking until you list it or pass `false`:

```typescript {% title="app/http/controllers/sitemap.ts" %}
import { xml } from "@sdxc/http/response";
import { fromRoutes } from "@sdxc/sitemap/remix";
import { createAction } from "remix/router";

import Post from "~/app/models/post";
import { seo } from "~/app/initializers/seo";
import routes from "~/routes/web";

export default createAction(routes.sitemap, async (ctx) => {
	let posts = await Post.listPublished(ctx.db);

	let sitemap = fromRoutes(routes, seo.baseUrl, {
		home: { priority: 1, frequency: "weekly" },
		blog: true,
		post: posts.map((post) => ({
			params: { slug: post.slug },
			updatedAt: new Date(post.updatedAt),
		})),
		sitemap: false,
		robots: false,
	});

	return xml(sitemap.toString(), {
		headers: { "Cache-Control": "public, max-age=3600" },
	});
});
```

`updatedAt` is written as `<lastmod>`, which is what gets a crawler to revisit a page.

## Serve robots.txt

`stringify` from `@sdxc/robots` writes the file from a document of groups and sitemaps:

```typescript {% title="app/http/controllers/robots.ts" %}
import { text } from "@sdxc/http/response";
import { stringify } from "@sdxc/robots";
import { createAction } from "remix/router";

import { seo } from "~/app/initializers/seo";
import routes from "~/routes/web";

export default createAction(routes.robots, (ctx) => {
	let production = ctx.url.origin === seo.baseUrl;

	let body = stringify({
		groups: [
			{
				userAgents: ["*"],
				rules: production
					? [{ allow: false, pattern: "/account" }]
					: [{ allow: false, pattern: "/" }],
				contentSignals: { search: true, "ai-input": true, "ai-train": false },
			},
		],
		sitemaps: [seo.absolute(routes.sitemap.href())],
		records: [],
	});

	return text(body, { headers: { "Cache-Control": "public, max-age=3600" } });
});
```

> [!WARNING]
> Comparing the request's origin with `seo.baseUrl` is what keeps previews out of search
> results: every host except the canonical one asks crawlers to stay away entirely, while
> production only fences off the signed-in area. A `baseUrl` that differs from the production
> origin, such as `http://` where the site serves `https://`, blocks crawlers from production
> too.

## Serve security.txt

A researcher who finds a vulnerability looks for `/.well-known/security.txt`. The `wellKnown()`
middleware answers `GET` and `HEAD` on the names you give it, with an `ETag` and a `304` when
the client's copy is current, and passes every other path on to the router.

```typescript {% title="config/security-txt.ts" %}
import type { SecurityTxt } from "@sdxc/well-known/security-txt";

export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:security@example.com")],
	expires: new Date("2027-09-30T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en"],
	canonical: [new URL("https://example.com/.well-known/security.txt")],
	policy: [],
	hiring: [],
	extensions: {},
};
```

```typescript {% title="app/initializers/router.tsx" %}
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";
import { createRouter } from "remix/router";

import { SECURITY_TXT } from "~/config/security-txt";

export function createWebRouter() {
	return createRouter({
		middleware: [
			headRequests(),
			wellKnown({ "security.txt": serve(securityTxt, () => SECURITY_TXT) }),
			// …the rest of your chain
		],
	});
}
```

> [!NOTE]
> Write `expires` as a literal date. A computed date keeps the file looking fresh while the
> contact behind it goes stale, whereas a literal one, plus a test that fails 30 days before it
> passes, makes a person review the contact once a year.

## Test the crawl files

The robots file decides by host, so a test asks the router for it on a preview host and on
production. The `security.txt` test fails a month before the date passes:

```typescript {% title="app/http/controllers/robots.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { SECURITY_TXT } from "~/config/security-txt";
import routes from "~/routes/web";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

async function robotsOn(origin: string) {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.robots.href(), origin)),
	);
	return response.text();
}

test("robots.txt keeps every host but production out of the index", async () => {
	expect(await robotsOn("https://preview.example.workers.dev")).toMatch(
		/^Disallow: \/$/m,
	);
	expect(await robotsOn("https://example.com")).toMatch(/^Disallow: \/account$/m);
});

test("security.txt is at least 30 days from expiring", () => {
	expect(SECURITY_TXT.expires.getTime() - Date.now()).toBeGreaterThan(THIRTY_DAYS);
});
```

## Where to go next

- [Draw social card images](/docs/building-remix-apps/social-card-images) — the `og:image`
  each page advertises, drawn per page in the Worker.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — the other file
  a reader's software looks for.
- [Sign files and security.txt with OpenPGP](/docs/identity-and-security/openpgp-signatures) —
  serving `security.txt` signed, as RFC 9116 recommends.
