# @sdxc/feed

One feed API over RSS and Atom, with conditional fetching and autodiscovery.

## Overview

A feed reader is handed a URL by someone who neither knows nor cares which syndication format is behind it. `@sdxc/feed` closes that gap: it sniffs a document's root element, parses it with `@sdxc/rss` or `@sdxc/atom`, and normalizes both into one shape.

It also owns the two capabilities that are about _fetching a feed_ rather than about either format, and so belong to neither parser:

- **Conditional requests.** `Feed.fetch` sends the validators you stored and reports a 304 without parsing anything, so polling an unchanged feed costs almost nothing.
- **Autodiscovery.** `Feed.discover` follows a page's `<link rel="alternate">` to the feed it advertises, so someone can paste `example.com` instead of `example.com/feed.xml`.

The normalized shape is deliberately lossy. Reach past this package to `@sdxc/rss` or `@sdxc/atom` when you need a format's own vocabulary.

## Usage

### Read a Feed

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let result = Feed.parse(xml, { url: "https://example.com/feed.xml" });
if (isFailure(result)) throw result.error;

let feed = result.data;
console.log(feed.format); // "rss" | "atom"
console.log(feed.title, feed.siteUrl);

for (let item of feed.items) {
	console.log(item.title, item.publishedAt);
}
```

Passing `url` matters: it is the base relative links resolve against, and the fallback for `feedUrl`.

### Poll a Feed Without Re-downloading It

```typescript
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

`notModified` discriminates the union, so `feed` is `undefined` on that branch and defined on the other with no optional check.

Store `etag` and `lastModified` from every response and send them back on the next poll. A 304 is allowed to omit them, so whatever you passed in is carried forward rather than dropped.

### Discover a Feed From a Site

```typescript
let result = await Feed.discover("https://example.com");
if (isFailure(result)) throw result.error;

let [main] = result.data;
// { url: "https://example.com/feed.xml", type: "application/rss+xml", title: "Main" }
```

A URL that is already a feed resolves from that one request, so this is safe to call whether someone pasted a site or a feed.

## API

### `Feed.parse(source: string, options?: Feed.ParseOptions)`

Parses XML text in either format. Returns a `Result`.

- `options.url` — the document's own URL: the base for relative links, and the `feedUrl` fallback.

### `Feed.fromXML(xml: XML, options?: Feed.ParseOptions)`

Reads a feed from an already-parsed `@sdxc/xml` document, for a caller that parsed the text for some other purpose first.

### `Feed.fetch(input, options?)`

Retrieves and parses a feed, sending the stored validators as preconditions.

- `options.etag` / `options.lastModified` — sent as `If-None-Match` / `If-Modified-Since`
- `options.headers`, `options.signal` — passed through to the request

Resolves to `Feed.FetchResult`: `{ notModified: false, feed, url, status, etag?, lastModified? }` or `{ notModified: true, feed: undefined, url, status: 304, etag?, lastModified? }`.

### `Feed.discover(input, options?)`

Finds the feeds a URL leads to. Resolves to `Feed.Discovery[]` in document order, since the first alternate link is conventionally the site's main feed.

### Instance accessors

`format`, `title`, `description`, `siteUrl`, `feedUrl`, `language`, `imageUrl`, `updatedAt`, `items`, and `toJSON()`.

## The Normalized Shape

| Field              | RSS 2.0                                                 | Atom 1.0                                                       |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------- |
| `title`            | `channel.title`                                         | `feed.title`                                                   |
| `description`      | `channel.description`                                   | `feed.subtitle`                                                |
| `siteUrl`          | `channel.link`                                          | alternate link, else `feed.id` when it is a URL                |
| `feedUrl`          | `atom:link[rel=self]`, else the request URL             | `link[rel=self]`, else the request URL                         |
| `language`         | `channel.language`                                      | `xml:lang` on the feed                                         |
| `imageUrl`         | `channel.image.url`                                     | `feed.logo`, else `feed.icon`                                  |
| `updatedAt`        | `lastBuildDate`, else `pubDate`                         | `feed.updated`                                                 |
| `item.guid`        | `guid`, else `link`, else the title                     | `entry.id`, else the alternate link                            |
| `item.title`       | `title`                                                 | `entry.title`                                                  |
| `item.url`         | `link`, else a permalink `guid`                         | alternate link                                                 |
| `item.contentHtml` | `content:encoded`, else `description`                   | `content` when inline                                          |
| `item.summary`     | `description`, when `content:encoded` supplied the body | `entry.summary`                                                |
| `item.author`      | `author`, else `dc:creator`, else `managingEditor`      | `entry.author`, else `entry.source.author`, else `feed.author` |
| `item.categories`  | `category` values                                       | `entry.category`, preferring `label` over `term`               |
| `item.enclosures`  | `enclosure`                                             | `link[rel=enclosure]`                                          |
| `item.publishedAt` | `pubDate`                                               | `published`, else `updated`                                    |

Cross-cutting rules:

- Every URL resolves against `options.url` when it is relative.
- Dates are `Date` objects. An unparseable date reads as `undefined` rather than an `Invalid Date`, so a consumer that stores or formats one never has to check.
- Items keep document order and are deduplicated by `guid`, first occurrence winning.
- An entry's `guid` is always present, falling back through a chain so an item with no identity of its own still has a stable one.

## Notes

1. **Nothing is sanitized.** `contentHtml` and `summary` hold exactly what the publisher wrote. Escaping or sanitizing them is the responsibility of whatever renders them.
2. **Format is sniffed from the root element, never from `Content-Type`.** Feeds are served as `text/xml`, `application/octet-stream`, and worse, so the header is not evidence. `Feed.fetch` accepts any content type for the same reason.
3. **`Feed.fetch` sets no cache directive.** Asking an origin for a fresh copy is precisely what stops it answering 304, which would defeat the preconditions being sent.
4. **RSS 1.0 (RDF) is not supported**, and is reported by name rather than as a parse failure.
5. **Discovery accepts only `application/rss+xml` and `application/atom+xml`.** `text/xml` and `application/xml` are excluded deliberately: they appear on sitemaps and stylesheets, and accepting them would offer documents that are not feeds.

## Related Packages

- [`@sdxc/rss`](/packages/rss) - The RSS 2.0 parser and builder
- [`@sdxc/atom`](/packages/atom) - The Atom 1.0 parser and builder
- [`@sdxc/xml`](/packages/xml) - The XML layer beneath both
- [`@sdxc/result`](/packages/result) - The `Result` type every entry point returns
