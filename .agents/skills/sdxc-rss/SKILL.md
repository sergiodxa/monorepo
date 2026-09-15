---
name: sdxc-rss
description: "@sdxc/rss builds and parses RSS 2.0 feeds through one `RSS` class: `new RSS(channel)` with `addItem()` and `toString()` to publish, and `RSS.parse`, `RSS.fromXML` and `RSS.fetch` to read. Use when generating a feed.xml, consuming a third-party feed, or working with `atom:link`, `content:encoded`, `dc:creator`, `slash:comments` and custom namespaced extensions that have to round-trip unchanged."
---

# @sdxc/rss

One class covers both directions: it builds feeds for publishing and reads feeds published by
other sites, across the whole set of standard channel and item fields plus the namespaced
extensions feeds lean on in practice — `atom:link`, `content:encoded`, `dc:creator`, and
`slash:comments`. Anything else namespaced is preserved through `extensions` rather than
discarded, so a feed carrying a custom module survives a read and a write unchanged. Reading is
`RSS.parse` (text), `RSS.fromXML` (an already-parsed `@sdxc/xml` document), or `RSS.fetch` (a URL);
writing is `new RSS(channel)`, `addItem`, `toString`. `RSS.fetch` uses the platform `fetch`, so it
runs on any fetch runtime.

Full API, options and examples: [packages/rss/README.md](packages/rss/README.md)

## When to reach for it

- A site needs a `feed.xml` with correct channel metadata and a self-referencing `atom:link`
- A reader has to pull items out of someone else's RSS, including full content from `content:encoded`
- A feed must be read, changed, and written back without losing the namespaced elements the publisher put there
- A malformed feed needs handling as an expected outcome rather than a crash

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/rss": "workspace:*" } }
```

```ts
import { RSS } from "@sdxc/rss";

let feed = new RSS({
	title: "My Blog",
	description: "Articles about web development",
	link: "https://example.com",
	language: "en-us",
	atomLink: {
		href: "https://example.com/feed.xml",
		rel: "self",
		type: "application/rss+xml",
	},
});

feed.addItem({
	guid: { value: "tag:example.com,2026:post-1", isPermaLink: false },
	title: "Hello World",
	description: "A short summary",
	link: "https://example.com/posts/hello-world",
	pubDate: new Date().toUTCString(),
	contentEncoded: "<p>Full post content</p>",
});

let xml = feed.toString();
```

## Suggestions

- Parsing throws on a document that is not RSS, and `RSS.fetch` throws when the response is not `ok` or does not carry an XML content type. Wrap both where a bad feed is an expected outcome.
- Dates are the strings the document holds, so write RFC 822 — which is what `Date.prototype.toUTCString()` produces.
- The namespaces the named extensions need are declared for you, but a custom namespaced element needs its prefix declared on `channel.namespaces` or it cannot be serialized.
- Nothing is sanitized: an item's markup is whatever the publisher wrote, and escaping it belongs to whatever renders it.
- `channel` and `items` are handed back as clones, so mutating what you read changes nothing; assign a whole new `channel` object to replace it.
- `packages/rss/spec` holds the RSS profile, autodiscovery, language-code and rssCloud references the implementation follows — check there before guessing at a field's semantics.

## Related

- `@sdxc/xml` — the parser and serializer underneath, and the document type `RSS.fromXML` takes; skill `sdxc-xml`
- `@sdxc/feed` — one normalized API over RSS and Atom, for a reader handed a URL whose format is unknown; skill `sdxc-feed`
