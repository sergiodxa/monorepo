# @sdxc/sitemap

XML sitemap reader and writer, following the [sitemaps.org protocol](https://www.sitemaps.org/protocol.html).

## Overview

The `Sitemap` class goes in both directions. Collect URLs and serialize them as the XML a
search engine crawler expects, or read a published sitemap — the one request that gives you
the list of pages a site says it has, with the dates that say which are worth revisiting.

Reading answers with the same class writing produces, so one type covers both directions and
the element names and value rules have one implementation.

## Usage

Build a document:

```typescript
import { Sitemap } from "@sdxc/sitemap";

let sitemap = new Sitemap();

sitemap.append(new URL("https://example.com/"));
sitemap.append(new URL("https://example.com/about"));
sitemap.append(new URL("https://example.com/blog"), { updatedAt: new Date("2024-01-15") });

let xml = sitemap.toString();
// Returns valid XML sitemap
```

Read a published one:

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let result = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(result)) throw result.error;

let sitemap = result.data;

sitemap.kind; // "urlset"
sitemap.size; // 128

for (let entry of sitemap.entries) {
	entry.loc; // URL
	entry.updatedAt; // Date | undefined
	entry.frequency; // Sitemap.Frequency | undefined
	entry.priority; // number | undefined
}
```

## API

### `Sitemap`

A class for building XML sitemaps and for reading published ones.

#### `new Sitemap()`

Creates a new empty sitemap.

**Example:**

```typescript
let sitemap = new Sitemap();
```

#### `sitemap.append(loc: URL, options?: Sitemap.AppendOptions): void`

Add a URL to the sitemap.

**Parameters:**

- `loc`: The URL to add, as a `URL` instance
- `options`: Optional `Sitemap.AppendOptions` object with `updatedAt`, `frequency`, and `priority`

**Example:**

```typescript
// Simple - just URL
sitemap.append(new URL("https://example.com/page"));

// With updatedAt only
sitemap.append(new URL("https://example.com/updated"), { updatedAt: new Date() });

// With all options
sitemap.append(new URL("https://example.com/important"), {
	updatedAt: new Date(),
	frequency: "weekly",
	priority: 0.8,
});
```

`updatedAt` is serialized as `<lastmod>` and `frequency` as `<changefreq>`, the element
names the sitemap protocol expects.

#### `Sitemap.parse(xml: XML): Result<Sitemap, SitemapParseError>`

Read a parsed document as a sitemap. Takes an [`XML`](/packages/xml) instance rather than
source text, so a caller that starts from a string parses it first and reads an
`XMLParseError` from the layer that produced it.

The root element decides what arrived: `<urlset>` and `<sitemapindex>` are sitemaps, and
every other root is the failure. That is also the content check — a host that answers an
unknown path with its own not-found template fails here, with a message naming the root.

**Example:**

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";
import { XML } from "@sdxc/xml";

let xml = XML.parse(source);
if (isFailure(xml)) throw xml.error;

let sitemap = Sitemap.parse(xml.data);
```

Rows survive what individual fields do not:

- An entry without a `<loc>` that parses as an absolute URL is skipped, and the rest of the
  document is kept — one malformed row costs a caller that row.
- An unreadable `<lastmod>` leaves `updatedAt` undefined and keeps the entry. `<lastmod>` is
  [W3C Datetime](https://www.w3.org/TR/NOTE-datetime), so `2026-09-11` and
  `2026-09-11T14:32:00+02:00` both read.
- A `<changefreq>` outside the protocol's enum and a `<priority>` outside 0.0–1.0 are
  ignored, so what a consumer reads is what `append` accepts.
- `image:`, `video:`, `news:` and `xhtml:link` children are dropped. A consumer that wants
  image or hreflang metadata parses the document with [`@sdxc/xml`](/packages/xml) and reads
  those elements itself.

#### `Sitemap.fetch(input, init?): Promise<Result<Sitemap, SitemapFetchError | SitemapParseError | XMLParseError>>`

Retrieve one sitemap and parse it. Takes what `fetch` takes — a URL, a string, or a
`Request`, plus request options — and reports a refused request or an error status as a
`SitemapFetchError` naming what came back.

The body is read whenever the response is `ok`, and `Content-Type` plays no part: sitemaps
arrive as `application/xml`, as `text/xml` and as `text/plain`, and the root element is the
check that answers whether one arrived.

**Example:**

```typescript
let result = await Sitemap.fetch("https://example.com/sitemap.xml", {
	headers: { "User-Agent": "example-crawler" },
});
```

One call retrieves one document. Walking an index means looping over its entries, so how
many children to fetch and how fast stays the caller's budget:

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let index = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(index)) throw index.error;

let pages: URL[] = [];

for (let entry of index.data.entries) {
	let child = await Sitemap.fetch(entry.loc);
	if (isFailure(child)) continue;
	for (let page of child.data.entries) pages.push(page.loc);
}
```

A `.xml.gz` sitemap served as `application/gzip` carries a gzip member in the body. Pipe the
response through a `DecompressionStream("gzip")` and hand the text to `Sitemap.parse`.

#### `sitemap.kind: Sitemap.Kind`

Which document this instance carries: `"urlset"` for one listing pages, `"index"` for one
listing other sitemaps. A sitemap built by appending is always a `"urlset"`; a parsed one
carries whichever root it was read from, and `toString()` writes that root back, so an index
that is read, filtered and re-serialized stays a `<sitemapindex>`.

**Example:**

```typescript
if (sitemap.kind === "index") {
	// every entry.loc is another sitemap to fetch
}
```

#### `sitemap.entries: Set<Sitemap.Entry>`

The entries themselves, as the live set, whether they were appended or parsed.

**Example:**

```typescript
let recent = [...sitemap.entries].filter((entry) => entry.updatedAt);
```

#### `sitemap.size: number`

Get the number of URLs in the sitemap.

**Example:**

```typescript
sitemap.append(new URL("https://example.com/a"));
sitemap.append(new URL("https://example.com/b"));
console.log(sitemap.size); // 2
```

#### `sitemap.toString(): string`

Generate the XML sitemap string.

**Returns:**

- A valid XML sitemap string

**Example:**

```typescript
let xml = sitemap.toString();
// <?xml version="1.0" encoding="UTF-8"?>
// <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">...</urlset>
```

An empty sitemap serializes to a self-closing root:

```typescript
new Sitemap().toString();
// <?xml version="1.0" encoding="UTF-8"?>
// <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>
```

### Errors

#### `SitemapParseError`

A document is not a sitemap. The message names the root element that arrived, so an HTML
error page served under a `200` reports itself as `received <html>`.

#### `SitemapFetchError`

A sitemap could not be retrieved: the request was refused, or the response carried an error
status. The message names what came back.

### Types

Types are exported via the `Sitemap` namespace:

```typescript
import { Sitemap } from "@sdxc/sitemap";

// Access types via namespace
type Frequency = Sitemap.Frequency;
type Kind = Sitemap.Kind;
type Entry = Sitemap.Entry;
type AppendOptions = Sitemap.AppendOptions;
```

#### `Sitemap.Frequency`

```typescript
type Frequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
```

#### `Sitemap.Kind`

```typescript
type Kind = "urlset" | "index";
```

#### `Sitemap.Entry`

```typescript
interface Entry {
	loc: globalThis.URL;
	updatedAt?: Date;
	frequency?: Frequency;
	priority?: number;
}
```

#### `Sitemap.AppendOptions`

```typescript
interface AppendOptions {
	updatedAt?: Date;
	frequency?: Frequency;
	/** Priority value between 0.0 and 1.0, default is 0.5 */
	priority?: number;
}
```

## Integration with Remix

### Sitemap Route

Declare the URL alongside the pages it lists, so the sitemap and the links it points at
come from one route table:

```typescript
// routes/web.ts
import { get, route } from "remix/routes";

export default route({
	home: get("/"),
	about: get("/about"),
	sitemap: get("/sitemap.xml"),
	sectionSitemap: get("/sitemap-:section.xml"),
	post: get("/blog/:slug"),
});
```

Build the document in a controller, resolving every entry against the request's own URL so
one controller serves production and every preview deployment:

```typescript
// app/http/controllers/sitemap.ts
import { xml } from "@sdxc/http/response";
import { Sitemap } from "@sdxc/sitemap";
import { createAction } from "remix/router";

import routes from "~/routes/web";

export default createAction(routes.sitemap, async ({ url }) => {
	let sitemap = new Sitemap();

	sitemap.append(new URL(routes.home.href(), url), { priority: 1, frequency: "weekly" });
	sitemap.append(new URL(routes.about.href(), url), { priority: 0.5, frequency: "yearly" });

	let posts = await db.query.posts.findMany({
		columns: { slug: true, updatedAt: true },
	});

	for (let post of posts) {
		sitemap.append(new URL(routes.post.href({ slug: post.slug }), url), {
			updatedAt: post.updatedAt,
		});
	}

	return xml(sitemap.toString(), {
		headers: { "Cache-Control": "public, max-age=3600" },
	});
});
```

Map the controller to its route where the router is assembled:

```typescript
// bootstrap/app.tsx
import { createRouter } from "remix/router";

import sitemap from "~/app/http/controllers/sitemap";
import routes from "~/routes/web";

let router = createRouter();

router.map(routes.sitemap, sitemap);
```

### Sitemap Index

A site past 50,000 URLs splits into one sitemap per section, listed by an index document.
The index root is `<sitemapindex>` rather than `<urlset>`, so serialize it with
[`@sdxc/xml`](/packages/xml) and serve each section from its own route:

```typescript
// app/http/controllers/sitemap.ts
import { xml } from "@sdxc/http/response";
import { unwrap } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { createAction } from "remix/router";

import routes from "~/routes/web";

const SECTIONS = ["pages", "blog", "products"];

export default createAction(routes.sitemap, ({ url }) => {
	let source = unwrap(
		XML.stringify({
			declaration: { version: "1.0", encoding: "UTF-8" },
			root: {
				name: "sitemapindex",
				attributes: { xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" },
				children: SECTIONS.map((section) => ({
					name: "sitemap",
					children: [
						{
							name: "loc",
							children: [new URL(routes.sectionSitemap.href({ section }), url).toString()],
						},
					],
				})),
			},
		}),
	);

	return xml(source);
});
```

## Pattern: Cached Sitemap

A sitemap over a full corpus costs a query per section, so serve it from
[`@sdxc/cache`](/packages/cache) and rebuild it on a miss. Passing `waitUntil` hands the
write over, so the request that paid for the rebuild returns without waiting on KV:

```typescript
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { xml } from "@sdxc/http/response";
import { Sitemap } from "@sdxc/sitemap";
import { env, waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";

import routes from "~/routes/web";

export default createAction(routes.sitemap, async ({ url }) => {
	let cache = new WorkerKVCache(env.CACHE, { waitUntil });

	let source = await cache.fetch(
		"sitemap",
		async () => {
			let sitemap = new Sitemap();
			sitemap.append(new URL(routes.home.href(), url));
			return sitemap.toString();
		},
		{ ttl: "1 hour" },
	);

	return xml(source);
});
```

## Pattern: Multiple Language Sitemaps

Generate sitemaps for multi-language sites:

```typescript
import { Sitemap } from "@sdxc/sitemap";

let locales = ["en", "es", "fr"];

function generateLocalizedSitemap(locale: string, baseUrl: string) {
	let sitemap = new Sitemap();

	sitemap.append(new URL(`/${locale}`, baseUrl));
	sitemap.append(new URL(`/${locale}/about`, baseUrl));

	return sitemap.toString();
}
```

## Pattern: Auditing a Published Sitemap

A sitemap is one request for the list of pages a site claims to publish, which makes it the
starting point for a crawl that checks those pages actually answer:

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let result = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(result)) throw result.error;

let stale = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

for (let entry of result.data.entries) {
	if (entry.updatedAt && entry.updatedAt > stale) continue;
	let response = await fetch(entry.loc, { method: "HEAD" });
	if (!response.ok) console.warn(`${entry.loc} answered ${response.status}`);
}
```

## Related Packages

- [`@sdxc/rss`](/packages/rss) - RSS feed generation
- [`@sdxc/xml`](/packages/xml) - the XML tree `Sitemap.parse` reads and `toString` writes
- [`@sdxc/cache`](/packages/cache) - cache for sitemap caching

## Tips

1. **Use URL objects** - Pass `loc` as a `URL` instance
2. **Set `updatedAt` when you track modification dates** - it emits `<lastmod>` for that entry
3. **Cache in production** - serve the serialized XML from a cache and rebuild it on a miss
4. **Limit to 50,000 URLs** - Per sitemap spec, use sitemap index for larger sites
5. **Include in robots.txt** - Reference your sitemap in robots.txt for discovery
6. **Check `kind` before reading entries** - an `"index"` lists sitemaps and a `"urlset"` lists pages
