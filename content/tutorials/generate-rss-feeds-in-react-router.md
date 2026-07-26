---
title: How to Generate RSS Feeds in React Router
excerpt: Create valid RSS feeds for your blog or content site using a resource route in React Router.
technologies: react-router@8.0.0
---

If you're building a blog, news site, or any content platform with React Router, you'll likely want to provide an RSS feed so readers can subscribe using their favorite feed reader. RSS feeds are XML documents that follow a specific format, and generating them correctly requires handling the channel metadata and individual items.

The challenge is that React Router is primarily designed for rendering HTML pages, but RSS feeds need to return XML with the correct content type. Fortunately, React Router's resource routes make this straightforward: you can create a route that returns any response type, including XML. The same pattern works for [generating sitemaps](/tutorials/generate-sitemaps-in-react-router) and [exposing routes as API endpoints](/tutorials/expose-remix-routes-as-api-endpoints).

## Create the RSS Class

First, create a simple class to build RSS feeds with proper structure:

```ts {% path="app/rss.ts" %}
export namespace RSS {
	export interface Item {
		guid: string;
		title: string;
		description: string;
		link: string;
		pubDate: string;
	}

	export interface Channel {
		title: string;
		description: string;
		link: string;
	}
}

export class RSS {
	private itemSet = new Set<RSS.Item>();

	readonly channel: RSS.Channel;
	constructor(channel: RSS.Channel) {
		this.channel = channel;
	}

	get items() {
		return Array.from(this.itemSet);
	}

	addItem(item: RSS.Item) {
		this.itemSet.add(item);
	}

	toString() {
		return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${this.channel.title}</title>
    <description>${this.channel.description}</description>
    <link>${this.channel.link}</link>
    ${this.items
			.map((item) => {
				return `<item>
        <guid>${item.guid}</guid>
        <title>${item.title}</title>
        <description>${item.description}</description>
        <link>${item.link}</link>
        <pubDate>${item.pubDate}</pubDate>
      </item>`;
			})
			.join("\n")}
  </channel>
</rss>`;
	}
}
```

The `RSS` class takes channel metadata (title, description, link) in its constructor and provides an `addItem` method to add feed entries. The `toString` method generates the complete XML document following the RSS 2.0 specification.

## Create the Resource Route

Now create a resource route that generates the RSS feed. Resource routes in React Router are routes that only export a `loader` (and optionally an `action`) without a default component export:

```ts {% path="app/routes/rss[.]xml.ts" %}
import type { Route } from "./+types/rss[.]xml";
import { RSS } from "~/rss";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let rss = new RSS({
		title: "My Blog",
		description: "Articles about web development",
		link: url.origin,
	});

	let posts = await getPosts(); // Your function to fetch posts

	for (let post of posts) {
		rss.addItem({
			guid: post.id,
			title: post.title,
			description: post.excerpt,
			link: `${url.origin}/posts/${post.slug}`,
			pubDate: new Date(post.publishedAt).toUTCString(),
		});
	}

	return new Response(rss.toString(), {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

The route file uses the `[.]` escape syntax in the filename so React Router treats the dot as a literal character, resulting in a `/rss.xml` URL. The loader fetches your posts, adds them to the RSS feed, and returns a `Response` with the XML content and appropriate headers.

## Add the Feed Link to Your HTML

To help feed readers discover your RSS feed, add a `<link>` tag to your document's `<head>`:

```tsx {% path="app/root.tsx" %}
export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="alternate" type="application/rss+xml" title="My Blog RSS Feed" href="/rss.xml" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
```

This `<link>` tag with `rel="alternate"` and `type="application/rss+xml"` tells browsers and feed readers that an RSS feed is available at the specified URL.

## Escape Special Characters in XML

If your content might contain special XML characters like `<`, `>`, or `&`, you should escape them to produce valid XML:

```ts {% path="app/rss.ts" %}
function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
```

Then use this function when building the XML output for fields that might contain user content, like titles and descriptions.

## Final Thoughts

RSS feeds are a simple but powerful way to let users subscribe to your content. By using React Router's resource routes, you can generate valid RSS XML alongside your regular pages without needing a separate server or build step. The pattern works well for blogs, podcasts, changelogs, or any content that updates over time. If you're building a blog, you might also want to [build a markdown pipeline](/tutorials/build-a-type-safe-markdown-pipeline-with-markdoc) for your posts.
