---
title: SEO, sitemaps and robots.txt
description: Give every page one canonical URL and structured data, and serve sitemap.xml, robots.txt and security.txt from routes.
section:
    title: Building Remix apps
    order: 4
order: 5
lastUpdated: 2026-10-16
---

A crawler learns about your site from four places: the head of each page, the sitemap, the
robots file, and the documents under `/.well-known/`. This guide sets up all four from one
source of truth. [`@sdxc/seo`](/api/seo) resolves canonical URLs, head tags and structured
data; [`@sdxc/sitemap`](/api/sitemap) and [`@sdxc/robots`](/api/robots) write the two crawl
files; and [`@sdxc/well-known`](/api/well-known) serves `security.txt`. Each file is an
ordinary route answered through `@sdxc/http/response`.

```bash
npm add @sdxc/http @sdxc/robots @sdxc/seo @sdxc/sitemap @sdxc/well-known remix
```

## One instance for the site

The same Worker answers on your custom domain, its `workers.dev` name and every preview
deployment. A page served from any of them must still name one address, or a crawler indexes
the preview. `createSeo` takes the site's identity and builds every URL from that origin,
whichever host served the request. Build it once, at module scope, and import it everywhere.

```typescript {% title="app/initializers/seo.ts" %}
import { createSeo } from "@sdxc/seo";

export const seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "Project planning for small teams, with an API.",
	twitter: { site: "@example", card: "summary_large_image" },
});
```

`seo.canonical(ctx.url)` swaps in the configured origin, drops the hash and a trailing slash,
and keeps the query string. `seo.absolute("/og/cover.png")` does the same for an asset,
leaving a URL that is already absolute, such as a CDN's, alone.

## Head metadata from the layout

Let the document layout take the page's metadata as a prop and render it with the `Seo`
component, so each page decides its own copy and the tag set stays identical everywhere.

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

`Seo` writes the `<title>`, the description, the canonical link, the robots directive, and the
Open Graph and Twitter tags. Both social namespaces repeat the title and description, because
each consumer reads only its own. A tag whose input is missing is skipped rather than written
empty.

## Structured data from a page

A page passes its own metadata, including any schema.org nodes. The builders on `seo.schema`
fill `@context` and `@type`, run page URLs through the same canonical rules as the link tag,
and make image paths absolute. `Post` is your model, read through the `ctx.db` your database
middleware publishes, and `ctx.locale` comes from the middleware in
[Translate your app](/docs/building-remix-apps/translate-your-app).

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
			seo.schema.breadcrumbs([
				{ name: "Blog", url: routes.blog.href() },
				{ name: post.title, url: routes.post.href({ slug }) },
			]),
		],
	};

	return ctx.render(
		<DocumentLayout seo={meta} locale={ctx.locale}>
			<h1>{post.title}</h1>
		</DocumentLayout>,
	);
});
```

Several nodes go into one `application/ld+json` script as an array. The JSON escapes every
`<`, so a post titled with a `</script>` in it cannot break out of the element.

A page that should stay out of the index says so itself, with
`robots: seo.robotsTag({ index: false, follow: true })`, which writes `noindex, follow`. The
robots file below is for site-wide crawl policy, and a signed-in screen or a thin filtered
view is a per-page decision.

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
a new page fails typechecking until you list it or pass `false`. Resolving against
`seo.baseUrl` keeps a preview's sitemap pointing at production.

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

`updatedAt` is written as `<lastmod>` and `frequency` as `<changefreq>`. A real modification
date is what gets a crawler to revisit a page, so give it one whenever your data has it.

## Serve robots.txt

`stringify` from `@sdxc/robots` writes the file from a document of groups, sitemaps and other
records, and what it writes parses back to the same document. Serve it with `text()`.

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

Comparing the request's origin with `seo.baseUrl` is what keeps previews out of search
results: every host except the canonical one asks crawlers to stay away entirely, while
production only fences off the signed-in area. `contentSignals` writes a `Content-Signal`
line, which states what the content may be used for beyond crawling.

## Serve security.txt

A researcher who finds a vulnerability looks for `/.well-known/security.txt` before anything
else. The `wellKnown()` middleware answers `GET` and `HEAD` on the names you give it, with an
`ETag`, a `Cache-Control` and a `304` when the client's copy is current, and passes every
other path on to the router. JSON well-known documents, such as OAuth metadata, name a
refused member with a JSON Pointer from [`@sdxc/json-pointer`](/api/json-pointer); a text
file such as `security.txt` names a 1-based line instead.

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

Write `expires` as a literal date, not one computed from the clock. A computed date keeps the
file looking fresh while the contact behind it goes stale, whereas a literal one, plus a test
that fails 30 days before it passes, makes a person review the contact once a year.

## Where to go next

- [Draw social card images](/docs/building-remix-apps/social-card-images) — the `og:image`
  each page advertises, drawn per page in the Worker.
- [Address JSON with JSON Pointer](/docs/http-apis/json-pointer) — the pointers JSON
  well-known documents report on a refused member.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — the other file
  a reader's software looks for.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — the rest of what
  a response should say about itself.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — keeping a
  sitemap built from the database cheap to serve.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — the `locale` the
  layout writes into `<html lang>`.
