# @sdxc/json-feed

JSON Feed 1.1 builder and parser.

It builds feeds for publishing and reads feeds published by other sites, covering every field
the format defines. Custom extension objects — the `_`-prefixed keys a publisher attaches —
are carried through both ways, so a feed with a custom module survives a read and a write
unchanged.

Fields are camelCase, so [JSON Feed](https://www.jsonfeed.org)'s `home_page_url` is
`homePageUrl` here and its `date_published` is `datePublished`. The document written out, and
the one read in, uses the format's own names.

## Installation

```bash
npm add @sdxc/json-feed
```

Every entry point that reads a feed returns a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this
package.

## Usage

### Build A Feed

Describe the feed first, append items, then serialize.

```typescript
import { JSONFeed } from "@sdxc/json-feed";

let feed = new JSONFeed({
	title: "My Blog",
	homePageUrl: "https://example.com",
	feedUrl: "https://example.com/feed.json",
	description: "Articles about web development",
	authors: [{ name: "Jane Doe", url: "https://example.com/jane" }],
	language: "en-US",
});

feed.addItem({
	id: "https://example.com/posts/hello-world",
	url: "https://example.com/posts/hello-world",
	title: "Hello World",
	contentHtml: "<p>Full post content</p>",
	summary: "A short summary",
	datePublished: new Date().toISOString(),
	tags: ["updates"],
});

let json = feed.toString();
```

The version URL is written for you, and a field left empty is left out, so the document holds
nothing a reader would have to test before using.

### Serve A Feed

`toJSON` returns the document itself, so `JSON.stringify` reaches it whether you hand it the
instance or the document.

```typescript
return new Response(JSON.stringify(feed, null, "\t"), {
	headers: { "content-type": JSONFeed.mediaType },
});
```

### Read A Feed

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let result = JSONFeed.parse(json);
if (isFailure(result)) return recordBadFeed(result.error);

let feed = result.data;
console.log(feed.feed.title);
for (let item of feed.items) console.log(item.title, item.url);
```

### Fetch A Feed

```typescript
let result = await JSONFeed.fetch("https://example.com/feed.json");
```

The request asks for `application/feed+json` and accepts `application/json`, which is what
many publishers serve a feed as. The response must be `ok`; its content type is not consulted,
because the version URL inside the document is the reliable evidence.

## API

### `new JSONFeed(feed: JSONFeed.Feed)`

Creates a feed with the given metadata and no items. `title` is required.

### `feed.feed`

The metadata, as a clone. Assigning a new `JSONFeed.Feed` replaces it and leaves the items in
place.

```typescript
feed.feed = { ...feed.feed, language: "en-US" };
```

### `feed.items`

The items, as clones, in the order they were added.

### `feed.version`

The version URL this feed declares: the one a parsed document carried, or JSON Feed 1.1 for a
feed built here.

### `feed.addItem(item: JSONFeed.Item)`

Appends one item. `id` is required, and must stay the same across every edit of that item.

### `feed.removeItem(id: string)`

Removes the item carrying that id.

### `feed.toJSON()`

Returns the JSON Feed document: every field under the name the format gives it, in the order
the format lists them, without the ones this feed left empty.

### `feed.toString()`

Serializes the document to JSON text.

### `JSONFeed.parse(source: string)`

Parses JSON Feed text. Reports a failure when the text is not JSON, when it declares no JSON
Feed version URL, or when it carries no title or no `items` array.

### `JSONFeed.fromJSON(value: unknown)`

Reads a feed out of an already-parsed value, for a caller that parsed the text for some other
purpose first.

### `JSONFeed.fetch(input: URL | RequestInfo, init?: RequestInit)`

Retrieves a document and parses it.

### `JSONFeed.version(value: unknown)`

The JSON Feed version URL a value declares, or `undefined` when it declares none. This is how
to recognize a feed among other JSON, since the version URL is the only field that separates
one.

### `JSONFeed.mediaType`

`application/feed+json`, the media type a JSON Feed is served under.

### Errors

`JSONFeedParseError` reports a value that is not a usable document, and is thrown by the
constructor and `addItem` when required fields are missing. `JSONFeedFetchError` reports a
request that failed or answered with an error status.

### Types

`JSONFeed.Feed`, `JSONFeed.Item`, `JSONFeed.Author`, `JSONFeed.Attachment`, `JSONFeed.Hub`,
and `JSONFeed.ExtensionKey` describe a feed as this package holds it. `JSONFeed.Document`,
`JSONFeed.DocumentItem`, and `JSONFeed.DocumentAttachment` describe it as JSON Feed writes it,
which is what `toJSON` returns.

## Pattern: Publish An Extension

Extension names start with an underscore, which is what reserves them from any future version
of the format. Write one as a field like any other, and it round-trips.

```typescript
import { JSONFeed } from "@sdxc/json-feed";

let feed = new JSONFeed({
	title: "The Record",
	_blue_shed: {
		about: "https://blueshed-podcasts.com/json-feed-extension-docs",
		explicit: false,
	},
});

feed.addItem({
	id: "https://therecord.example/1",
	contentText: "Episode one",
	_blue_shed: { season: 1 },
});
```

Reading that document back yields the same objects, untouched:

```typescript
let result = JSONFeed.parse(feed.toString());
if (isFailure(result)) throw result.error;

result.data.feed["_blue_shed"]; // { about: "…", explicit: false }
```

## Pattern: Read A Feed Someone Else Publishes

A published feed is written by software you do not control, so the parser takes each field
only when the document typed it usably and discards the items JSON Feed says to discard.

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let result = await JSONFeed.fetch(url);
if (isFailure(result)) return recordFailure(result.error);

for (let item of result.data.items) {
	/** Every item has an id: one without a usable one was discarded on the way in. */
	await save({
		id: item.id,
		url: item.url ?? item.id,
		body: item.contentHtml ?? escapeHtml(item.contentText ?? ""),
		publishedAt: item.datePublished ? new Date(item.datePublished) : undefined,
	});
}
```

## Notes

1. Dates are the strings the document holds, so write them in RFC 3339 style —
   `2026-02-07T14:04:00-05:00`, which is what `Date.prototype.toISOString` produces.
2. An item requires only an `id`. The format asks for `contentHtml` or `contentText` and
   instructs a reader to keep an item carrying neither, so both are optional here.
3. `contentHtml` is the one field holding HTML. `contentText` is plain text, and rendering it
   as markup means escaping it first.
4. Nothing is sanitized. An item's markup is whatever the publisher wrote, and escaping it is
   the responsibility of whatever renders it.
5. A parsed feed keeps the version URL it declared, so a JSON Feed 1.0 document — including
   its singular `author` — writes back out as the 1.0 document it was.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/json-feed": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
