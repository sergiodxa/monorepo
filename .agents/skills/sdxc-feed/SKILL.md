---
name: sdxc-feed
description: "@sdxc/feed reads RSS 2.0 and Atom 1.0 through one normalized shape, sniffing the format from the root element: `Feed.parse`, `Feed.fromXML`, `Feed.fetch` with `If-None-Match`/`If-Modified-Since` conditional requests, and `Feed.discover` for `<link rel=\"alternate\">` autodiscovery. Use when building a feed reader or poller, when a user pastes a site URL instead of a feed URL, or when polling a feed cheaply with stored ETag and Last-Modified validators."
---

# @sdxc/feed

Someone hands a reader a URL without knowing or caring which syndication format is behind it. This package sniffs the document's root element, parses it as RSS 2.0 or Atom 1.0, and normalizes both into one shape with `format`, `title`, `siteUrl`, `feedUrl`, `updatedAt` and `items`. It also owns the two capabilities that are about fetching a feed rather than about either format: `Feed.fetch` sends stored validators and reports a 304 without parsing anything, and `Feed.discover` follows a page's alternate links to the feeds it advertises. Every entry point returns a `Result`. Any fetch runtime.

Full API, options and examples: [packages/feed/README.md](packages/feed/README.md)

## When to reach for it

- A subscription list has to be polled on a schedule without re-downloading feeds that have not changed.
- A user pastes `example.com` and the product has to find the feed behind it.
- Items from mixed RSS and Atom sources have to be stored in one table with one set of fields.
- A feed has to be parsed and each item given a stable identity, even when the publisher supplied no `guid`.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/feed": "workspace:*" } }
```

```ts
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let result = Feed.parse(xml, { url: "https://example.com/feed.xml" });
if (isFailure(result)) throw result.error;

let feed = result.data;
console.log(feed.format); // "rss" | "atom"

for (let item of feed.items) {
	console.log(item.title, item.publishedAt);
}
```

```ts
let result = await Feed.fetch(feed.feedUrl, {
	etag: stored.etag,
	lastModified: stored.lastModified,
});

if (isFailure(result)) return recordFailure(result.error);

if (result.data.notModified) {
	await touch(feed.id);
	return;
}

await save(result.data.feed.items);
await storeValidators(feed.id, result.data.etag, result.data.lastModified);
```

## Suggestions

- Always pass `options.url`: it is the base relative links resolve against and the fallback for `feedUrl`.
- Store `etag` and `lastModified` from every response and send them back on the next poll. A 304 may omit them, so whatever you passed in is carried forward rather than dropped. `notModified` discriminates the result union, so `feed` is `undefined` on that branch with no optional check needed.
- Nothing is sanitized: `contentHtml` and `summary` hold exactly what the publisher wrote, and escaping them belongs to whatever renders them.
- Format is sniffed from the root element, never from `Content-Type`, and `Feed.fetch` accepts any content type — feeds are served as `text/xml`, `application/octet-stream` and worse. RSS 1.0 (RDF) is reported by name via `FeedFormatError` rather than as a parse failure.
- The normalized shape is deliberately lossy. Reach past it to the format-specific parsers when you need a format's own vocabulary.
- Discovery accepts only `application/rss+xml` and `application/atom+xml`; `text/xml` and `application/xml` are excluded on purpose, since they also appear on sitemaps and stylesheets.

## Related

- `@sdxc/rss` — the RSS 2.0 parser underneath, and the place to go for RSS-specific fields; skill `sdxc-rss`
- `@sdxc/atom` — the Atom 1.0 parser underneath, and the place to go for Atom-specific fields; skill `sdxc-atom`
- `@sdxc/xml` — the XML layer both parsers read through, and the source of the `XML` value `Feed.fromXML` takes; skill `sdxc-xml`
