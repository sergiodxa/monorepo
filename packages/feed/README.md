# @sdxc/feed

One feed API over RSS, Atom and JSON Feed, with conditional fetching and autodiscovery.

A feed reader is handed a URL by someone who neither knows nor cares which syndication
format is behind it. This package closes that gap: it sniffs a document, parses it as RSS 2.0,
Atom 1.0 or JSON Feed 1.1, and normalizes all three into one shape.

It also owns the two capabilities that are about _fetching_ a feed rather than about either
format, and so belong to neither parser:

- **Conditional requests.** `Feed.fetch` sends the validators you stored and reports a 304
  without parsing anything, so polling an unchanged feed costs almost nothing.
- **Autodiscovery.** `Feed.discover` follows a page's `<link rel="alternate">` to the feed it
  advertises, so someone can paste `example.com` instead of `example.com/feed.xml`.

The normalized shape is deliberately lossy. Reach past it to
[`@sdxc/rss`](https://www.npmjs.com/package/@sdxc/rss),
[`@sdxc/atom`](https://www.npmjs.com/package/@sdxc/atom) or
[`@sdxc/json-feed`](https://www.npmjs.com/package/@sdxc/json-feed) when you need a format's
own vocabulary.

## Installation

```bash
npm add @sdxc/feed
```

The three parsers, the [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml) layer beneath
the two XML ones, and the `Result` every entry point returns, from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), all install alongside this
package.

## Usage

### Read A Feed

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let result = Feed.parse(source, { url: "https://example.com/feed.xml" });
if (isFailure(result)) throw result.error;

let feed = result.data;
console.log(feed.format); // "rss" | "atom" | "json"
console.log(feed.title, feed.siteUrl);

for (let item of feed.items) {
	console.log(item.title, item.publishedAt);
}
```

Passing `url` matters: it is the base relative links resolve against, and the fallback for
`feedUrl`.

### Poll A Feed Without Re-downloading It

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

`notModified` discriminates the union, so `feed` is `undefined` on that branch and defined on
the other with no optional check.

Store `etag` and `lastModified` from every response and send them back on the next poll. A
304 is allowed to omit them, so whatever you passed in is carried forward rather than
dropped.

### Discover A Feed From A Site

```typescript
let result = await Feed.discover("https://example.com");
if (isFailure(result)) throw result.error;

let [main] = result.data;
// { url: "https://example.com/feed.xml", type: "application/rss+xml", title: "Main" }
```

A URL that is already a feed resolves from that one request, so this is safe to call whether
someone pasted a site or a feed.

## API

### `Feed.parse(source: string, options?: Feed.ParseOptions)`

Parses feed text in any of the three formats. Text that opens a JSON object is read as JSON
Feed, and anything else as XML.

- `options.url` — the document's own URL: the base for relative links, and the `feedUrl`
  fallback.

### `Feed.fromXML(xml: XML, options?: Feed.ParseOptions)`

Reads a feed from an already-parsed XML document, for a caller that parsed the text for some
other purpose first.

### `Feed.fromJSON(value: unknown, options?: Feed.ParseOptions)`

Reads a feed from an already-parsed JSON value, for the same reason.

### `Feed.fetch(input: string | URL, options?: Feed.FetchOptions)`

Retrieves and parses a feed, sending the stored validators as preconditions.

- `options.etag` / `options.lastModified` — sent as `If-None-Match` / `If-Modified-Since`
- `options.url` — overrides the response URL as the base for relative links
- `options.headers`, `options.signal` — passed through to the request
- `options.maxBytes` — how many bytes of the body to read before refusing it; 10 MiB by
  default
- `options.maxRedirects` — how many redirects to follow before refusing the chain; five by
  default

Resolves to a `Feed.FetchResult`: `{ notModified: false, feed, url, status, etag?,
lastModified? }`, or `{ notModified: true, feed: undefined, url, status: 304, etag?,
lastModified? }`.

### `Feed.discover(input: string | URL, options?: Feed.FetchOptions)`

Finds the feeds a URL leads to. Resolves to `Feed.Discovery[]` in document order, since the
first alternate link is conventionally the site's main feed. Each feed is reported at the URL
its response finally came from, so a caller that keys a feed by address stores where the
chain ended rather than where it started.

### Instance Accessors

`format`, `title`, `description`, `siteUrl`, `feedUrl`, `language`, `imageUrl`, `updatedAt`,
`items`, and `toJSON()`.

### Errors

`FeedParseError` reports text that is not XML, or XML that is not a feed. `FeedFormatError`
reports a document in a format this package does not read, naming it. `FeedFetchError`
reports a request that failed or answered with an error status. `FeedLimitError` extends it
and reports an origin that answered with more than the retrieval allows, so matching on
`FeedFetchError` still catches it and matching on `FeedLimitError` tells a publisher this
package refused from one it could not reach.

### Types

`Feed.Format`, `Feed.Item`, `Feed.Author`, `Feed.Enclosure`, `Feed.Data`,
`Feed.ParseOptions`, `Feed.FetchOptions`, `Feed.FetchResult`, and `Feed.Discovery`.

## The Normalized Shape

| Field              | RSS 2.0                                                 | Atom 1.0                                                       | JSON Feed 1.1                     |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| `title`            | `channel.title`                                         | `feed.title`                                                   | `title`                           |
| `description`      | `channel.description`                                   | `feed.subtitle`                                                | `description`                     |
| `siteUrl`          | `channel.link`                                          | alternate link, else `feed.id` when it is a URL                | `home_page_url`                   |
| `feedUrl`          | `atom:link[rel=self]`, else the request URL             | `link[rel=self]`, else the request URL                         | `feed_url`, else the request URL  |
| `language`         | `channel.language`                                      | `xml:lang` on the feed                                         | `language`                        |
| `imageUrl`         | `channel.image.url`                                     | `feed.logo`, else `feed.icon`                                  | `icon`, else `favicon`            |
| `updatedAt`        | `lastBuildDate`, else `pubDate`                         | `feed.updated`                                                 | the newest item date              |
| `item.guid`        | `guid`, else `link`, else the title                     | `entry.id`, else the alternate link                            | `id`                              |
| `item.title`       | `title`                                                 | `entry.title`                                                  | `title`                           |
| `item.url`         | `link`, else a permalink `guid`                         | alternate link                                                 | `url`, else `id` when it is a URL |
| `item.contentHtml` | `content:encoded`, else `description`                   | `content` when inline                                          | `content_html`                    |
| `item.contentText` | —                                                       | —                                                              | `content_text`                    |
| `item.summary`     | `description`, when `content:encoded` supplied the body | `entry.summary`                                                | `summary`                         |
| `item.author`      | `author`, else `dc:creator`, else `managingEditor`      | `entry.author`, else `entry.source.author`, else `feed.author` | `authors`, else the feed's        |
| `item.categories`  | `category` values                                       | `entry.category`, preferring `label` over `term`               | `tags`                            |
| `item.enclosures`  | `enclosure`                                             | `link[rel=enclosure]`                                          | `attachments`                     |
| `item.publishedAt` | `pubDate`                                               | `published`, else `updated`                                    | `date_published`                  |

Cross-cutting rules:

- Every URL resolves against `options.url` when it is relative.
- Dates are `Date` objects. An unparseable date reads as `undefined` rather than an
  `Invalid Date`, so a consumer that stores or formats one never has to check.
- Items keep document order and are deduplicated by `guid`, first occurrence winning.
- An item's `guid` is always present, falling back through the chain above so an item with no
  identity of its own still has a stable one. A JSON Feed item always carries one, since the
  format has its parser discard an item without.
- `author` is the first of `authors`, which a format writing only one still fills.

## Notes

1. **Nothing is sanitized.** `contentHtml` and `summary` hold exactly what the publisher
   wrote. Escaping or sanitizing them is the responsibility of whatever renders them.
   `contentText` is plain text, so rendering it as markup means escaping it first.
2. **Format is sniffed from the document, never from `Content-Type`.** Feeds are served as
   `text/xml`, `application/octet-stream`, and worse, so the header is not evidence.
   `Feed.fetch` accepts any content type for the same reason. Text that opens a JSON object
   is read as JSON Feed, and its version URL is what confirms it is one.
3. **`Feed.fetch` sets no cache directive.** Asking an origin for a fresh copy is precisely
   what stops it answering 304, which would defeat the preconditions being sent.
4. **RSS 1.0 (RDF) is not supported**, and is reported by name rather than as a parse
   failure.
5. **Every retrieval is bounded.** A feed URL comes from whoever pasted it, so `Feed.fetch`
   and `Feed.discover` read the body off the stream and stop at `maxBytes`, and follow at
   most `maxRedirects` hops. A `Content-Length` over the cap is refused before the body is
   read at all, and the count over the stream is what enforces the cap when a response
   declares no length or understates it. Both report a `FeedLimitError`.
6. **Discovery accepts `application/rss+xml`, `application/atom+xml`, `application/feed+json`
   and `application/json`.** `text/xml` and `application/xml` are excluded deliberately: they
   appear on sitemaps and stylesheets, and accepting them would offer documents that are not
   feeds. Among the JSON candidates, `application/feed+json` wins outright, and
   `application/json` stands in only when a page names no better-typed feed.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/feed": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
