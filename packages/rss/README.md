# @pkg/rss

RSS 2.0 feed builder and parser for syndication.

## Overview

This package provides an `RSS` class for building and parsing RSS 2.0 feeds. Use it to generate feeds for your blog, podcast, or any content that benefits from syndication.

The class can both create feeds from scratch and parse existing feeds from URLs using the `htmlparser2` library.

## Usage

### Building a Feed

```typescript
import { RSS } from "@pkg/rss";

let feed = new RSS({
	title: "My Blog",
	description: "A blog about web development",
	link: "https://example.com",
});

feed.addItem({
	guid: "post-1",
	title: "Hello World",
	description: "My first blog post",
	link: "https://example.com/posts/hello-world",
	pubDate: new Date().toISOString(),
});

let xml = feed.toString();
```

### Parsing a Feed

```typescript
import { RSS } from "@pkg/rss";

let feed = await RSS.fetch(new URL("https://example.com/feed.xml"));

console.log(feed.channel.title);
for (let item of feed.items) {
	console.log(item.title, item.link);
}
```

## API

### `RSS`

A class for building and managing RSS feeds.

#### `new RSS(channel: Channel)`

Creates a new RSS feed with the given channel information.

**Parameters:**

- `channel.title`: The feed title
- `channel.description`: The feed description
- `channel.link`: The feed's website URL

**Example:**

```typescript
let feed = new RSS({
	title: "Tech News",
	description: "Latest technology news and updates",
	link: "https://technews.example.com",
});
```

#### `feed.channel: Channel`

The feed's channel information (read-only).

#### `feed.items: Item[]`

Array of items in the feed (read-only).

#### `feed.addItem(item: Item): void`

Add an item to the feed.

**Parameters:**

- `item.guid`: Unique identifier for the item
- `item.title`: Item title
- `item.description`: Item description or content
- `item.link`: URL to the full item
- `item.pubDate`: Publication date (ISO 8601 string)

**Example:**

```typescript
feed.addItem({
	guid: "article-123",
	title: "New Feature Released",
	description: "We just released an exciting new feature...",
	link: "https://example.com/blog/new-feature",
	pubDate: new Date("2024-01-15").toISOString(),
});
```

#### `feed.removeItem(guid: string): void`

Remove an item by its GUID.

**Parameters:**

- `guid`: The GUID of the item to remove

**Example:**

```typescript
feed.removeItem("article-123");
```

#### `feed.toJSON(): object`

Get the feed as a JSON object.

**Returns:**

- Object with `channel` and `items` properties

**Example:**

```typescript
let json = feed.toJSON();
// { channel: { title, description, link }, items: [...] }
```

#### `feed.toString(): string`

Generate the RSS XML string.

**Returns:**

- Valid RSS 2.0 XML string

**Example:**

```typescript
let xml = feed.toString();
// <?xml version="1.0" encoding="UTF-8"?>
// <rss version="2.0">
//   <channel>...</channel>
// </rss>
```

#### `static RSS.fetch(url: URL): Promise<RSS>`

Fetch and parse an RSS feed from a URL.

**Parameters:**

- `url`: URL of the RSS feed

**Returns:**

- Promise resolving to an RSS instance

**Throws:**

- Error if the feed cannot be fetched or parsed

**Example:**

```typescript
let feed = await RSS.fetch(new URL("https://example.com/feed.xml"));
```

### Types

Types are exported via the `RSS` namespace:

```typescript
import { RSS } from "@pkg/rss";

// Access types via namespace
type Channel = RSS.Channel;
type Item = RSS.Item;
```

#### `RSS.Channel`

```typescript
interface Channel {
	title: string;
	description: string;
	link: string;
}
```

#### `RSS.Item`

```typescript
interface Item {
	guid: string;
	title: string;
	description: string;
	link: string;
	pubDate: string;
}
```

## Integration with React Router

### RSS Feed Route

Create a route that generates an RSS feed:

```typescript
// app/routes/feed[.]xml.ts
import { RSS } from "@pkg/rss";
import type { Route } from "./+types/feed[.]xml";

export async function loader({ request }: Route.LoaderArgs) {
	let baseUrl = new URL(request.url).origin;

	let feed = new RSS({
		title: "My Blog",
		description: "Articles about web development",
		link: baseUrl,
	});

	let posts = await db.query.posts.findMany({
		orderBy: desc(posts.publishedAt),
		limit: 20,
	});

	for (let post of posts) {
		feed.addItem({
			guid: post.id,
			title: post.title,
			description: post.excerpt,
			link: `${baseUrl}/blog/${post.slug}`,
			pubDate: post.publishedAt.toISOString(),
		});
	}

	return new Response(feed.toString(), {
		headers: {
			"Content-Type": "application/rss+xml",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

### RSS Feed Aggregator

Aggregate multiple RSS feeds:

```typescript
import { RSS } from "@pkg/rss";

export async function loader() {
	let sources = ["https://blog1.example.com/feed.xml", "https://blog2.example.com/feed.xml"];

	let feeds = await Promise.all(sources.map((url) => RSS.fetch(new URL(url)).catch(() => null)));

	let allItems = feeds
		.filter(Boolean)
		.flatMap((feed) => feed.items)
		.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
		.slice(0, 50);

	return ok({ items: allItems });
}
```

## Pattern: Cached RSS Feed

Cache the generated feed:

```typescript
import { RSS } from "@pkg/rss";
import { Cache } from "@pkg/cache";

export async function loader({ context }: Route.LoaderArgs) {
	let cache = new Cache.KVStore(context.env.KV, context.waitUntil);

	let xml = await cache.fetch(
		"rss-feed",
		async () => {
			let feed = new RSS({
				title: "My Blog",
				description: "...",
				link: "https://example.com",
			});
			// ... populate feed
			return feed.toString();
		},
		{ ttl: 1800 }, // 30 minutes
	);

	return new Response(xml, {
		headers: { "Content-Type": "application/rss+xml" },
	});
}
```

## Pattern: Category-Specific Feeds

Generate multiple feeds for different categories:

```typescript
// app/routes/feed.$category[.]xml.ts
import { RSS } from "@pkg/rss";

export async function loader({ params, request }: Route.LoaderArgs) {
	let baseUrl = new URL(request.url).origin;
	let category = params.category;

	let posts = await db.query.posts.findMany({
		where: eq(posts.category, category),
		orderBy: desc(posts.publishedAt),
		limit: 20,
	});

	let feed = new RSS({
		title: `My Blog - ${category}`,
		description: `${category} articles`,
		link: `${baseUrl}/category/${category}`,
	});

	for (let post of posts) {
		feed.addItem({
			guid: post.id,
			title: post.title,
			description: post.excerpt,
			link: `${baseUrl}/blog/${post.slug}`,
			pubDate: post.publishedAt.toISOString(),
		});
	}

	return new Response(feed.toString(), {
		headers: { "Content-Type": "application/rss+xml" },
	});
}
```

## Related Packages

- [`@pkg/sitemap`](/packages/sitemap) - XML sitemap generation
- [`@pkg/cache`](/packages/cache) - Cache feeds for performance

## Tips

1. **Use ISO 8601 dates** - The `pubDate` should be an ISO 8601 string for compatibility
2. **Escape HTML in descriptions** - XML will be escaped automatically in `toString()`
3. **Limit feed size** - RSS readers expect feeds with 10-50 items, not thousands
4. **Add discovery link** - Include `<link rel="alternate" type="application/rss+xml">` in your HTML
5. **Cache aggressively** - RSS feeds don't need real-time updates; cache for at least 15-30 minutes
