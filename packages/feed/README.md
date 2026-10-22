# @sdxc/feed

One feed API over RSS, Atom and JSON Feed, with conditional fetching and autodiscovery.

`Feed` sniffs a syndication feed, reads it as RSS 2.0, Atom 1.0 or JSON Feed 1.1, and normalizes all
three into one shape. It also fetches a feed with conditional requests, so polling an unchanged
feed costs a 304, and discovers the feed a site's page advertises. Reach for
[`@sdxc/rss`](https://www.npmjs.com/package/@sdxc/rss),
[`@sdxc/atom`](https://www.npmjs.com/package/@sdxc/atom) or
[`@sdxc/json-feed`](https://www.npmjs.com/package/@sdxc/json-feed) when you need a format's own
vocabulary.

## Installation

```sh
npm add @sdxc/feed
```

Every entry point answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result);
`Feed.fromXML` takes a document from [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml).

## Usage

### Parse feed text

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let result = Feed.parse(source, { url: "https://example.com/feed.xml" });
if (isFailure(result)) throw result.error;

let feed = result.data;
feed.format; // "rss" | "atom" | "json"
for (let item of feed.items) console.log(item.title, item.url, item.publishedAt);
```

`url` is the base relative links resolve against and the fallback for `feedUrl`.

### Fetch a feed, sending the validators you stored

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let result = await Feed.fetch("https://example.com/feed.xml", {
	etag: stored.etag,
	lastModified: stored.lastModified,
});
if (isFailure(result)) throw result.error;

if (result.data.notModified) {
	// 304: nothing was downloaded or parsed
} else {
	console.log(result.data.feed.items.length);
}

stored = { etag: result.data.etag, lastModified: result.data.lastModified };
```

`notModified` narrows `feed`: `undefined` on a 304, a `Feed` otherwise. The validators you pass
in carry forward when a 304 omits them, so storing them from every response is always safe.

### Discover a feed from a site

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let result = await Feed.discover("https://example.com");
if (isFailure(result)) throw result.error;

let [main] = result.data;
// { url: "https://example.com/feed.xml", type: "application/rss+xml", title: "Main" }
```

A URL that is already a feed answers itself from that one request, so this takes whatever
someone pasted, site or feed.

## API

### `Feed.parse(source: string, options?: Feed.ParseOptions): Result<Feed, FeedParseError | FeedFormatError>`

Parses feed text in any of the three formats. Text that opens a JSON object reads as JSON Feed,
anything else as XML; the format comes from the document, never from a `Content-Type`.

### `Feed.fromXML(xml: XML, options?: Feed.ParseOptions)`

Reads a feed from an already-parsed `@sdxc/xml` document, answering the same `Result` as `parse`.

### `Feed.fromJSON(value: unknown, options?: Feed.ParseOptions)`

Reads a feed from an already-parsed JSON value, answering the same `Result` as `parse`.

### `Feed.fetch(input: string | URL, options?: Feed.FetchOptions): Promise<Result<Feed.FetchResult, FeedFetchError | FeedParseError | FeedFormatError>>`

Retrieves and parses a feed. Options:

- `etag`, `lastModified`: sent as `If-None-Match` and `If-Modified-Since`.
- `url`: the base for relative links, in place of the URL the response came from.
- `headers`, `signal`: passed to the request.
- `maxBytes`: the body size it reads before refusing with `FeedLimitError`; 10 MiB by default.
- `maxRedirects`: the redirects it follows before refusing with `FeedLimitError`; 5 by default.
- `hosts`: `"public"` (default) lets the URL and every redirect reach only public `http:` and
  `https:` hosts without credentials, refusing private addresses and reserved names such as
  `localhost`; `"any"` allows your own network.

The request carries no cache directive, so the origin is free to answer 304. Any content type
is accepted.

### `Feed.discover(input: string | URL, options?: Feed.FetchOptions): Promise<Result<Feed.Discovery[], FeedFetchError>>`

Finds the feeds a URL leads to: the URL itself when it is a feed, otherwise the page's
`<link rel="alternate">` elements typed `application/rss+xml`, `application/atom+xml`,
`application/feed+json` or `application/json`, in document order (the first is conventionally
the main feed). `application/json` links drop out when the page also offers
`application/feed+json`. Each feed is reported at the URL its response finally came from, and
the request options and limits match `fetch`.

### `Feed.selectHub(header?: Feed.Link[], document?: Feed.Link[]): Feed.Hub | undefined`

Chooses the WebSub hub to subscribe to from the response's `Link` header relations and the
document's. The header wins over the document, the first `rel=hub` wins within each, and only an
`https:` hub qualifies.

### `Feed.selectSubscription(header?: Feed.Link[], document?: Feed.Link[]): Feed.Subscription | undefined`

Chooses the hub as `selectHub` does and pairs it with the topic: the `rel=self` declared in the
same place as the hub, else the document's, else `null`.

### `new Feed(data: Feed.Data)`

Wraps normalized data, such as a stored `toJSON()` result.

### `feed` accessors

`format`, `title`, `description`, `siteUrl`, `feedUrl`, `language`, `imageUrl`, `updatedAt`,
`items` and `links`; `toJSON()` answers the whole feed as `Feed.Data`. `links` holds every
relation the document declared, `rel` lower-cased and `href` resolved, whatever the format.

### Normalized fields

| Field              | RSS 2.0                                                 | Atom 1.0                                                       | JSON Feed 1.1                     |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| `title`            | `channel.title`                                         | `feed.title`                                                   | `title`                           |
| `description`      | `channel.description`                                   | `feed.subtitle`                                                | `description`                     |
| `siteUrl`          | `channel.link`                                          | alternate link, else `feed.id` when it is a URL                | `home_page_url`                   |
| `feedUrl`          | `atom:link[rel=self]`, else the request URL             | `link[rel=self]`, else the request URL                         | `feed_url`, else the request URL  |
| `language`         | `channel.language`                                      | `xml:lang` on the feed                                         | `language`                        |
| `imageUrl`         | `channel.image.url`                                     | `feed.logo`, else `feed.icon`                                  | `icon`, else `favicon`            |
| `updatedAt`        | `lastBuildDate`, else `pubDate`                         | `feed.updated`                                                 | the newest item date              |
| `links`            | `atom:link` elements                                    | `link` elements                                                | `feed_url` and `hubs`             |
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

Every URL is absolute. Dates are `Date` objects, and an unparseable one reads as `undefined`.
Items keep document order, deduplicated by `guid` with the first occurrence kept; every item has
a `guid`. `author` is the first of `authors`. `contentHtml` and `summary` hold the publisher's
markup unsanitized, and `contentText` is plain text that needs escaping before it goes into HTML.

### Errors

- `FeedParseError`: malformed JSON or XML, or a JSON Feed whose contents fail validation.
- `FeedFormatError`: a well-formed document that is no feed this package reads, such as an HTML
  page or RSS 1.0 (RDF), named in the message.
- `FeedFetchError`: a failed request, an error status, or a URL or redirect the `hosts` policy
  refuses (no request is sent for it).
- `FeedLimitError`: a `FeedFetchError` for a body past `maxBytes` or a chain past `maxRedirects`.

### Types

`Feed.Data` is the whole feed and `Feed.Item` one post, with `Feed.Author` and `Feed.Enclosure`
inside it; `Feed.Format` is `"rss" | "atom" | "json"`. `Feed.Link` is one declared relation,
`Feed.Hub` and `Feed.Subscription` what the hub selectors answer. `Feed.ParseOptions` and
`Feed.FetchOptions` are the options above. `Feed.FetchResult` is `Feed.Fetched` (`notModified:
false`, `feed`) or `Feed.NotModified` (`notModified: true`, `status: 304`), both with the final
`url`, `status`, `etag`, `lastModified` and the response's `Link` header relations as `links`.
`Feed.Discovery` is `{ url, type, title? }`.

## Pattern: Subscribe From Whatever Someone Pasted

Discover the feed behind a site or feed URL, fetch it once, and keep its address and validators
for the next poll.

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

async function subscribe(pasted: string) {
	let found = await Feed.discover(pasted);
	if (isFailure(found)) return found;

	let [first] = found.data;
	if (!first) return { status: "no-feed" as const };

	let fetched = await Feed.fetch(first.url);
	if (isFailure(fetched) || fetched.data.notModified) return fetched;

	let { feed, url, etag, lastModified } = fetched.data;
	return {
		status: "subscribed" as const,
		subscription: { url, title: feed.title, siteUrl: feed.siteUrl, etag, lastModified },
		items: feed.items,
	};
}
```

## Pattern: Poll Feeds On A Schedule

Send back the stored validators on every poll; an unchanged feed answers 304 and costs no
parsing, and new items are the ones whose `guid` you have not seen.

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

interface Subscription {
	url: string;
	etag?: string;
	lastModified?: string;
	seen: Set<string>;
}

async function poll(subscription: Subscription): Promise<Feed.Item[]> {
	let result = await Feed.fetch(subscription.url, {
		etag: subscription.etag,
		lastModified: subscription.lastModified,
		signal: AbortSignal.timeout(10_000),
	});
	if (isFailure(result)) return [];

	subscription.url = result.data.url;
	subscription.etag = result.data.etag;
	subscription.lastModified = result.data.lastModified;
	if (result.data.notModified) return [];

	let fresh = result.data.feed.items.filter((item) => !subscription.seen.has(item.guid));
	for (let item of fresh) subscription.seen.add(item.guid);
	return fresh;
}
```

## Pattern: Tell Failures Apart

Each error class names who is at fault, so a poller can back off a broken origin, flag an
oversized feed, and tell the user the URL serves no feed.

```typescript
import { Feed, FeedFetchError, FeedFormatError, FeedLimitError, FeedParseError } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let result = await Feed.fetch(url, { maxBytes: 2 * 1024 * 1024, maxRedirects: 3 });

if (isFailure(result)) {
	let error = result.error;
	if (error instanceof FeedLimitError) {
		// the origin answered with more than allowed: too large or too many redirects
	} else if (error instanceof FeedFetchError) {
		// unreachable, an error status, or a host the policy refuses: retry later
	} else if (error instanceof FeedFormatError) {
		// a document that is no feed this package reads, such as a web page or RSS 1.0
	} else if (error instanceof FeedParseError) {
		// malformed JSON or XML
	}
}
```

## Pattern: Subscribe To A WebSub Hub

Read hubs from both the response's `Link` header and the document, then subscribe under the
topic declared beside the chosen hub.

```typescript
import { randomToken } from "@sdxc/crypto";
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";

let fetched = await Feed.fetch(feedUrl);
if (!isFailure(fetched) && !fetched.data.notModified) {
	let subscription = Feed.selectSubscription(fetched.data.links, fetched.data.feed.links);
	if (subscription) {
		await fetch(subscription.hub, {
			method: "POST",
			body: new URLSearchParams({
				"hub.mode": "subscribe",
				"hub.topic": subscription.topic ?? fetched.data.url,
				"hub.callback": "https://reader.example.com/websub",
				"hub.secret": randomToken(),
			}),
		});
	}
}
```

`Feed.selectHub` answers the hub alone when you only need its address.

## Pattern: Parse A Document You Already Hold, And Store It

Hand an already-parsed XML document or JSON value to the reader directly, and keep the
normalized result as plain data to wrap again later.

```typescript
import { Feed } from "@sdxc/feed";
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let xml = XML.parse(text);
if (isFailure(xml)) throw xml.error;

let feed = Feed.fromXML(xml.data, { url: "https://example.com/feed.xml" });
if (isFailure(feed)) throw feed.error;

let stored = JSON.stringify(feed.data.toJSON());
let restored = new Feed(JSON.parse(stored));
restored.title;

let fromJson = Feed.fromJSON(await response.json(), { url: response.url });
```

Dates round-trip through `JSON.stringify` as strings, so revive them before wrapping when you
read `publishedAt` or `updatedAt` from a stored copy.

## Pattern: Read Feeds On Your Own Network

The default host policy refuses private addresses and names such as `localhost`; pass
`hosts: "any"` for a feed served inside your own network, along with any headers it needs.

```typescript
import { Feed } from "@sdxc/feed";

let result = await Feed.fetch("http://intranet.local/news.xml", {
	hosts: "any",
	headers: { Authorization: `Bearer ${token}` },
});
```

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
