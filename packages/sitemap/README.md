# @sdxc/sitemap

XML sitemap generator for SEO optimization.

## Overview

This package provides a simple class for building XML sitemaps following the [sitemaps.org protocol](https://www.sitemaps.org/protocol.html). Use it to generate sitemaps for search engine crawlers.

The `Sitemap` class collects URLs and outputs valid XML that can be served as a response or written to a file.

## Usage

```typescript
import { Sitemap } from "@sdxc/sitemap";

let sitemap = new Sitemap();

sitemap.append(new URL("https://example.com/"));
sitemap.append(new URL("https://example.com/about"));
sitemap.append(new URL("https://example.com/blog"), { updatedAt: new Date("2024-01-15") });

let xml = sitemap.toString();
// Returns valid XML sitemap
```

## API

### `Sitemap`

A class for building XML sitemaps.

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

### Types

Types are exported via the `Sitemap` namespace:

```typescript
import { Sitemap } from "@sdxc/sitemap";

// Access types via namespace
type Frequency = Sitemap.Frequency;
type Entry = Sitemap.Entry;
type AppendOptions = Sitemap.AppendOptions;
```

#### `Sitemap.Frequency`

```typescript
type Frequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
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

## Related Packages

- [`@sdxc/rss`](/packages/rss) - RSS feed generation
- [`@sdxc/cache`](/packages/cache) - cache for sitemap caching

## Tips

1. **Use URL objects** - Pass `loc` as a `URL` instance
2. **Set `updatedAt` when you track modification dates** - it emits `<lastmod>` for that entry
3. **Cache in production** - serve the serialized XML from a cache and rebuild it on a miss
4. **Limit to 50,000 URLs** - Per sitemap spec, use sitemap index for larger sites
5. **Include in robots.txt** - Reference your sitemap in robots.txt for discovery
