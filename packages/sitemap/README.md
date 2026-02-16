# @pkg/sitemap

XML sitemap generator for SEO optimization.

## Overview

This package provides a simple class for building XML sitemaps following the [sitemaps.org protocol](https://www.sitemaps.org/protocol.html). Use it to generate sitemaps for search engine crawlers.

The `Sitemap` class collects URLs and outputs valid XML that can be served as a response or written to a file.

## Usage

```typescript
import { Sitemap } from "@pkg/sitemap";

let sitemap = new Sitemap();

sitemap.append(new URL("https://example.com/"));
sitemap.append(new URL("https://example.com/about"));
sitemap.append(new URL("https://example.com/blog"), new Date("2024-01-15"));

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

#### `sitemap.append(loc: URL, options?: Date | AppendOptions): void`

Add a URL to the sitemap.

**Parameters:**

- `loc`: The URL to add (must be a `URL` object)
- `options`: Either a `Date` for lastmod (legacy signature) or an `AppendOptions` object

**Example:**

```typescript
// Simple - just URL
sitemap.append(new URL("https://example.com/page"));

// With lastmod date (legacy signature)
sitemap.append(new URL("https://example.com/updated"), new Date());

// With full options
sitemap.append(new URL("https://example.com/important"), {
	lastmod: new Date(),
	changefreq: "weekly",
	priority: 0.8,
});
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
// <?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">...</urlset>
```

### Types

Types are exported via the `Sitemap` namespace:

```typescript
import { Sitemap } from "@pkg/sitemap";

// Access types via namespace
type URL = Sitemap.URL;
type ChangeFreq = Sitemap.ChangeFreq;
type AppendOptions = Sitemap.AppendOptions;
```

#### `Sitemap.URL`

```typescript
interface URL {
	loc: globalThis.URL;
	lastmod?: Date;
	changefreq?: ChangeFreq;
	priority?: number;
}
```

#### `Sitemap.ChangeFreq`

```typescript
type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
```

#### `Sitemap.AppendOptions`

```typescript
interface AppendOptions {
	lastmod?: Date;
	changefreq?: ChangeFreq;
	/** Priority value between 0.0 and 1.0, default is 0.5 */
	priority?: number;
}
```

## Integration with React Router

### Sitemap Route

Create a route that generates a sitemap dynamically:

```typescript
// app/routes/sitemap[.]xml.ts
import { Sitemap } from "@pkg/sitemap";
import type { Route } from "./+types/sitemap[.]xml";

export async function loader({ request }: Route.LoaderArgs) {
	let baseUrl = new URL(request.url).origin;
	let sitemap = new Sitemap();

	// Add static pages
	sitemap.append(new URL("/", baseUrl));
	sitemap.append(new URL("/about", baseUrl));
	sitemap.append(new URL("/contact", baseUrl));

	// Add dynamic pages from database
	let posts = await db.query.posts.findMany({
		columns: { slug: true, updatedAt: true },
	});

	for (let post of posts) {
		sitemap.append(new URL(`/blog/${post.slug}`, baseUrl), post.updatedAt);
	}

	return new Response(sitemap.toString(), {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

### Sitemap Index

For large sites, create a sitemap index:

```typescript
import { Sitemap } from "@pkg/sitemap";

export async function loader({ request }: Route.LoaderArgs) {
	let baseUrl = new URL(request.url).origin;

	// Generate sitemap index manually (not covered by this package)
	let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-blog.xml</loc></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-products.xml</loc></sitemap>
</sitemapindex>`;

	return new Response(xml, {
		headers: { "Content-Type": "application/xml" },
	});
}
```

## Pattern: Cached Sitemap

Cache the sitemap to avoid regenerating on every request:

```typescript
import { Sitemap } from "@pkg/sitemap";
import { Cache } from "@pkg/cache";

export async function loader({ context }: Route.LoaderArgs) {
	let cache = new Cache.KVStore(context.env.KV, context.waitUntil);

	let xml = await cache.fetch(
		"sitemap",
		async () => {
			let sitemap = new Sitemap();
			// ... populate sitemap
			return sitemap.toString();
		},
		{ ttl: 3600 }, // Cache for 1 hour
	);

	return new Response(xml, {
		headers: { "Content-Type": "application/xml" },
	});
}
```

## Pattern: Multiple Language Sitemaps

Generate sitemaps for multi-language sites:

```typescript
import { Sitemap } from "@pkg/sitemap";

let locales = ["en", "es", "fr"];

function generateLocalizedSitemap(locale: string, baseUrl: string) {
	let sitemap = new Sitemap();

	sitemap.append(new URL(`/${locale}`, baseUrl));
	sitemap.append(new URL(`/${locale}/about`, baseUrl));

	return sitemap.toString();
}
```

## Related Packages

- [`@pkg/rss`](/packages/rss) - RSS feed generation
- [`@pkg/cache`](/packages/cache) - KV cache for sitemap caching

## Tips

1. **Use URL objects** - The `loc` parameter must be a `URL` object, not a string
2. **Lastmod is optional** - Only include it if you track actual modification dates
3. **Cache in production** - Sitemaps don't need to be generated on every request
4. **Limit to 50,000 URLs** - Per sitemap spec, use sitemap index for larger sites
5. **Include in robots.txt** - Reference your sitemap in robots.txt for discovery
