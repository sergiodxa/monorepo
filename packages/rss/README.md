# @sdxc/rss

RSS 2.0 feed builder and parser.

It writes feeds for publishing and reads feeds from other sites, covering every standard channel
and item field plus `atom:link`, `content:encoded`, `dc:creator` and `slash:comments`. Any other
namespaced element round-trips through `extensions`, so a feed survives a read and a write unchanged.

## Installation

```sh
npm add @sdxc/rss
```

Every operation that can fail answers a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and `RSS.fromXML` takes a document
from [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml). Both install alongside this package.

## Usage

### Build a feed

```typescript
import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";

let xml = RSS.stringify({
	channel: {
		title: "My Blog",
		description: "Articles about web development",
		link: "https://example.com",
		language: "en-us",
		atomLink: { href: "https://example.com/feed.xml", rel: "self", type: "application/rss+xml" },
	},
	items: [
		{
			guid: { value: "tag:example.com,2026:post-1", isPermaLink: false },
			title: "Hello World",
			description: "A short summary",
			link: "https://example.com/posts/hello-world",
			pubDate: new Date().toUTCString(),
			contentEncoded: "<p>Full post content</p>",
		},
	],
});
if (isFailure(xml)) throw xml.error;
```

`RSS.stringify` declares the namespaces the extension fields use, so this feed carries `xmlns:atom`
and `xmlns:content` on its root. Dates are the strings the document holds; write them in RFC 822
form, which is what `Date.prototype.toUTCString()` produces.

### Read a feed

```typescript
import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";

let feed = RSS.parse(xml);
if (isFailure(feed)) throw feed.error;

console.log(feed.data.channel.title);
for (let item of feed.data.items) console.log(item.title, item.link);
```

`RSS.parse` fails with an `RSSParseError` when the text is not XML or not an RSS 2.0 document, or
when the channel or an item lacks its required fields.

### Fetch a feed

```typescript
import { RSS } from "@sdxc/rss";

let feed = await RSS.fetch(new URL("https://example.com/feed.xml"));
```

`RSS.fetch` requests a fresh copy and fails with an `RSSFetchError` when the request fails, the
response is not `ok`, or its content type is not XML.

## API

### `RSS.fromJSON(feed: RSS.Feed): Result<RSS, RSSParseError>`

Builds an instance from `{ channel, items }`, the shape `toJSON` returns. Fails when the channel
lacks `title`, `description` or `link`, or an item has neither a `title` nor a `description`.

### `RSS.stringify(input: RSS | RSS.Feed): Result<string, RSSParseError | RSSStringifyError>`

Serializes an instance, or validates and serializes plain data, to RSS 2.0 XML with a UTF-8
declaration. `description` and `contentEncoded` are written as text, so embedded HTML is escaped on
the way out and unescaped when parsed back. `RSSStringifyError` reports a name or value XML cannot
hold.

### `rss.channel`

The channel, as a clone.

### `rss.setChannel(channel: RSS.Channel): Result<void, RSSParseError>`

Validates and replaces the channel, keeping the items. A refused channel leaves the feed unchanged.

```typescript
let replaced = feed.setChannel({ ...feed.channel, lastBuildDate: new Date().toUTCString() });
```

### `rss.items`

The items, as clones, in the order they were added.

### `rss.addItem(item: RSS.Item): Result<void, RSSParseError>`

Appends an item. Fails when it has neither a `title` nor a `description`, leaving the feed
unchanged.

### `rss.removeItem(guid: string): void`

Removes the first item whose guid value matches.

### `rss.toJSON(): RSS.Feed`

The feed as plain serializable data, `{ channel, items }`.

### `RSS.parse(source: string): Result<RSS, RSSParseError>`

Parses RSS 2.0 XML, failing on anything else.

### `RSS.fromXML(xml: XML): Result<RSS, RSSParseError>`

Reads a feed from a document already parsed with `@sdxc/xml`, failing as `RSS.parse` does when it
is not RSS 2.0.

### `RSS.fetch(input: URL | RequestInfo, init?: RequestInit): Promise<Result<RSS, RSSFetchError | RSSParseError>>`

Fetches with `cache-control: no-cache, no-store` added to `init.headers`, then parses the body.

### Types

All types live on the `RSS` namespace. Every structured type also accepts `attributes` and
`extensions` for data beyond the standard fields.

#### `RSS.Channel`

`title`, `description` and `link`, plus the optional RSS 2.0 fields `language`, `copyright`,
`managingEditor`, `webMaster`, `pubDate`, `lastBuildDate`, `category`, `generator`, `docs`,
`cloud`, `ttl`, `image`, `rating`, `textInput`, `skipHours` and `skipDays`; the extensions
`atomLink` and `dcCreator`; RFC 5005's `fhComplete` and `fhArchive` markers (`fh:complete`,
`fh:archive`), whose paging and archive relations travel as `atomLink` entries; and
`namespaces`, a prefix-to-URI map declared on the root.

#### `RSS.Item`

At least one of `title` or `description`, plus `link`, `author`, `category`, `comments`,
`enclosure`, `guid`, `pubDate` and `source`, and the extensions `contentEncoded`, `atomLink`,
`dcCreator` and `slashComments`. `RSS.ItemBase` is the same shape with every field optional.

#### `RSS.Feed`

`{ channel: RSS.Channel; items: RSS.Item[] }`, the shape `toJSON()` returns and `RSS.fromJSON`
and `RSS.stringify` accept.

#### `RSS.Element` and `RSS.Node`

An extension element: `name` (prefixed, such as `media:rating`), optional `attributes`, and
`children` that are strings or further elements.

#### Field types

`RSS.Guid`, `RSS.Category`, `RSS.Enclosure`, `RSS.AtomLink`, `RSS.Source`, `RSS.Image`,
`RSS.Cloud` and `RSS.TextInput` mirror their RSS elements. `guid` and `category` take a bare string
(`RSS.GuidInput`, `RSS.CategoryInput`) or the object form; `enclosure` and `atomLink` take one
object or an array (`RSS.EnclosureInput`, `RSS.AtomLinkInput`); `dcCreator` takes a string or an
array.

## Pattern: Serve a feed from a request handler

Build the feed from your records on each request and answer it with the RSS media type.

```typescript
import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";

interface Post {
	slug: string;
	title: string;
	excerpt: string;
	html: string;
	author: string;
	tags: string[];
	publishedAt: Date;
}

export function feedResponse(posts: Post[]): Response {
	let xml = RSS.stringify({
		channel: {
			title: "Example Blog",
			description: "Notes on building for the web",
			link: "https://example.com",
			lastBuildDate: new Date().toUTCString(),
			atomLink: { href: "https://example.com/feed.xml", rel: "self", type: "application/rss+xml" },
		},
		items: posts.map((post) => {
			let url = `https://example.com/posts/${post.slug}`;
			return {
				guid: url,
				title: post.title,
				link: url,
				description: post.excerpt,
				contentEncoded: post.html,
				dcCreator: post.author,
				category: post.tags,
				pubDate: post.publishedAt.toUTCString(),
			};
		}),
	});
	if (isFailure(xml)) return new Response(xml.error.message, { status: 500 });

	return new Response(xml.data, {
		headers: { "content-type": "application/rss+xml; charset=utf-8" },
	});
}
```

## Pattern: Publish a podcast with a custom namespace

Enclosures carry the audio; any module without a named field, such as iTunes tags, goes in
`extensions` with its prefix declared on `channel.namespaces`, since a prefix needs a declaration
in scope to serialize.

```typescript
import { RSS } from "@sdxc/rss";

let xml = RSS.stringify({
	channel: {
		title: "Example Podcast",
		description: "Conversations about software",
		link: "https://example.com/podcast",
		image: {
			url: "https://example.com/cover.png",
			title: "Example Podcast",
			link: "https://example.com/podcast",
		},
		namespaces: { itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd" },
		extensions: [
			{ name: "itunes:author", children: ["Example Studio"] },
			{ name: "itunes:category", attributes: { text: "Technology" } },
		],
	},
	items: [
		{
			guid: { value: "episode-1", isPermaLink: false },
			title: "Episode 1",
			description: "Where it all starts",
			pubDate: "Tue, 14 Apr 2026 09:00:00 GMT",
			enclosure: { url: "https://example.com/ep1.mp3", length: 24_986_239, type: "audio/mpeg" },
			extensions: [{ name: "itunes:duration", children: ["00:42:10"] }],
		},
	],
});
```

## Pattern: Edit a published feed

Parse an existing document, change it, and write it back; unknown elements and their namespace
declarations come through untouched.

```typescript
import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";

let parsed = RSS.parse(existingXml);
if (isFailure(parsed)) throw parsed.error;
let feed = parsed.data;

feed.removeItem("episode-1");
let replaced = feed.setChannel({ ...feed.channel, lastBuildDate: new Date().toUTCString() });
if (isFailure(replaced)) throw replaced.error;

let updated = RSS.stringify(feed);
```

## Pattern: Aggregate several feeds

Fetch in parallel, keep the feeds that parse, and merge their items newest first.

```typescript
import { isSuccess } from "@sdxc/result";
import { RSS } from "@sdxc/rss";

let sources = ["https://example.com/feed.xml", "https://example.org/rss"];

let results = await Promise.all(sources.map((source) => RSS.fetch(new URL(source))));

let items = results
	.filter(isSuccess)
	.flatMap((result) => result.data.items)
	.sort((a, b) => Date.parse(b.pubDate ?? "") - Date.parse(a.pubDate ?? ""));

let failed = results.length - results.filter(isSuccess).length;
```

Markup in `description` and `contentEncoded` is exactly what each publisher wrote; sanitize it
before rendering it in your own pages.

## Pattern: Detect the feed format before reading it

Parse the text once with `@sdxc/xml`, look at the root element, and hand RSS documents to
`RSS.fromXML`.

```typescript
import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import { XML } from "@sdxc/xml";

export function readFeed(text: string): RSS | null {
	let parsed = XML.parse(text);
	if (isFailure(parsed)) return null;
	if (parsed.data.root.name !== "rss") return null;

	let feed = RSS.fromXML(parsed.data);
	return isFailure(feed) ? null : feed.data;
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/rss": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
