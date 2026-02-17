---
title: How to Generate Sitemaps in React Router
excerpt: Build XML sitemaps dynamically using a builder pattern in React Router resource routes.
technologies: react-router@7.0.0
---

Sitemaps help search engines discover and index all the pages on your website. If you have a dynamic site with content that changes frequently, you need to generate sitemaps on the fly rather than maintaining a static XML file.

In React Router, you can create a resource route that builds the sitemap XML dynamically. This approach lets you pull URLs from your database, set update frequencies, and assign priorities based on your content structure. Resource routes are also useful for [generating RSS feeds](/tutorials/generate-rss-feeds-in-react-router) and [exposing API endpoints](/tutorials/expose-remix-routes-as-api-endpoints).

## Create the Sitemap Builder Class

First, create a `Sitemap` class that provides a builder pattern for constructing XML sitemaps:

```ts {% path="app/lib/sitemap.ts" %}
export namespace Sitemap {
	export type Frequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

	export interface URL {
		loc: globalThis.URL;
		updatedAt?: Date;
		frequency?: Frequency;
		priority?: number;
	}

	export interface AppendOptions {
		updatedAt?: Date;
		frequency?: Frequency;
		/** Priority value between 0.0 and 1.0, default is 0.5 */
		priority?: number;
	}
}

export class Sitemap {
	urls = new Set<Sitemap.URL>();

	append(loc: globalThis.URL, options: Sitemap.AppendOptions = {}) {
		this.urls.add({ loc, ...options });
	}

	get size() {
		return this.urls.size;
	}

	toString() {
		return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
			...this.urls,
		].map((url) => {
			let parts = [`<loc>${url.loc.toString()}</loc>`];
			if (url.updatedAt) {
				parts.push(`<lastmod>${url.updatedAt.toISOString()}</lastmod>`);
			}
			if (url.frequency) {
				parts.push(`<changefreq>${url.frequency}</changefreq>`);
			}
			if (url.priority !== undefined) {
				parts.push(`<priority>${url.priority}</priority>`);
			}
			return `<url>${parts.join("")}</url>`;
		})}</urlset>`;
	}
}
```

The class uses a `Set` to store URLs, preventing duplicates. The `append` method accepts a `URL` object and optional metadata like `updatedAt`, `frequency`, and `priority`. The `toString` method generates valid XML following the sitemap protocol.

## Create a Resource Route for the Sitemap

Create a resource route that will serve the sitemap at `/sitemap.xml`:

```ts {% path="app/routes/sitemap[.]xml.ts" %}
import { Sitemap } from "~/lib/sitemap";

export async function loader() {
	let sitemap = new Sitemap();
	let baseUrl = new URL("https://example.com");

	// Add static pages
	sitemap.append(new URL("/", baseUrl), {
		frequency: "daily",
		priority: 1.0,
	});

	sitemap.append(new URL("/about", baseUrl), {
		frequency: "monthly",
		priority: 0.8,
	});

	sitemap.append(new URL("/contact", baseUrl), {
		frequency: "monthly",
		priority: 0.5,
	});

	return new Response(sitemap.toString(), {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

The route file uses `[.]` in the filename to escape the dot, so React Router treats it as a literal character in the URL path. The loader creates a new `Sitemap` instance, appends URLs, and returns the XML with the correct content type.

## Add Dynamic URLs from Your Database

For dynamic content like blog posts or products, fetch the data and add each item to the sitemap:

```ts {% path="app/routes/sitemap[.]xml.ts" %}
import { Sitemap } from "~/lib/sitemap";
import { db } from "~/lib/db";
import { posts } from "~/lib/schema";

export async function loader() {
	let sitemap = new Sitemap();
	let baseUrl = new URL("https://example.com");

	// Add static pages
	sitemap.append(new URL("/", baseUrl), {
		frequency: "daily",
		priority: 1.0,
	});

	// Fetch all published posts
	let allPosts = await db
		.select({ slug: posts.slug, updatedAt: posts.updatedAt })
		.from(posts)
		.where(eq(posts.published, true));

	// Add each post to the sitemap
	for (let post of allPosts) {
		sitemap.append(new URL(`/blog/${post.slug}`, baseUrl), {
			updatedAt: post.updatedAt,
			frequency: "weekly",
			priority: 0.7,
		});
	}

	return new Response(sitemap.toString(), {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

This queries the database for published posts and adds each one with its actual `updatedAt` timestamp. Search engines use this date to determine when to recrawl pages.

## Set Appropriate Priorities and Frequencies

Use the `priority` and `frequency` options to guide search engines on how to crawl your site:

```ts {% path="app/routes/sitemap[.]xml.ts" %}
// Homepage: highest priority, changes daily
sitemap.append(new URL("/", baseUrl), {
	frequency: "daily",
	priority: 1.0,
});

// Category pages: high priority, change weekly
for (let category of categories) {
	sitemap.append(new URL(`/category/${category.slug}`, baseUrl), {
		frequency: "weekly",
		priority: 0.8,
	});
}

// Individual posts: medium priority, rarely change
for (let post of allPosts) {
	sitemap.append(new URL(`/blog/${post.slug}`, baseUrl), {
		updatedAt: post.updatedAt,
		frequency: "monthly",
		priority: 0.6,
	});
}

// Legal pages: low priority, almost never change
sitemap.append(new URL("/privacy", baseUrl), {
	frequency: "yearly",
	priority: 0.3,
});
```

Priority values range from 0.0 to 1.0, with 0.5 being the default. Frequency hints tell search engines how often the content typically changes, though crawlers may adjust based on their own observations.

## Add the Sitemap to Your robots.txt

Tell search engines where to find your sitemap by adding it to `robots.txt`:

```txt {% path="public/robots.txt" %}
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

Alternatively, create a resource route for `robots.txt` if you need dynamic content:

```ts {% path="app/routes/robots[.]txt.ts" %}
export function loader() {
	let content = `User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml`;

	return new Response(content, {
		headers: { "Content-Type": "text/plain" },
	});
}
```

This ensures search engines can automatically discover your sitemap when they crawl your site. For better SEO, also consider [adding dynamic canonical URLs](/tutorials/add-dynamic-canonical-url-to-remix-routes) to prevent duplicate content issues.
