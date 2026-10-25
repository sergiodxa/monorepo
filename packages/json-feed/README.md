# @sdxc/json-feed

JSON Feed 1.1 builder and parser.

Build feeds to publish and read feeds others publish, covering every field
[JSON Feed](https://www.jsonfeed.org) defines. Fields are camelCase (`homePageUrl`,
`datePublished`); the document written out and read in uses the format's own names
(`home_page_url`, `date_published`). Custom `_`-prefixed extension objects round-trip unchanged.

## Installation

```sh
npm add @sdxc/json-feed
```

Every operation that can fail answers a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Build and serialize a feed

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let json = JSONFeed.stringify({
	feed: {
		title: "My Blog",
		homePageUrl: "https://example.com",
		feedUrl: "https://example.com/feed.json",
		authors: [{ name: "Jane Doe", url: "https://example.com/jane" }],
		language: "en-US",
	},
	items: [
		{
			id: "https://example.com/posts/hello-world",
			url: "https://example.com/posts/hello-world",
			title: "Hello World",
			contentHtml: "<p>Full post content</p>",
			datePublished: new Date().toISOString(),
			tags: ["updates"],
		},
	],
});
if (isFailure(json)) throw json.error;

return new Response(json.data, {
	headers: { "content-type": JSONFeed.mediaType },
});
```

A feed requires a `title`, and an item only an `id`, which must stay the same across every edit of
that item; a missing one answers a `JSONFeedParseError`. Dates are RFC 3339 strings, which is what
`toISOString()` produces. The version URL is written for you and empty fields are left out.

### Parse a feed

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let result = JSONFeed.parse(json);
if (isFailure(result)) throw result.error;

result.data.feed.title;
for (let item of result.data.items) item.title;
```

### Fetch a feed

```typescript
let result = await JSONFeed.fetch("https://example.com/feed.json");
```

The request accepts `application/feed+json` and `application/json`; any `ok` response whose body
declares a JSON Feed version URL parses.

## API

### `JSONFeed.from(data: JSONFeed.Data): Result<JSONFeed, JSONFeedParseError>`

Builds an instance from camelCase `{ feed, items }`. Fails without a feed `title` or an item `id`.

### `JSONFeed.stringify(input: JSONFeed | JSONFeed.Data): Result<string, JSONFeedParseError | JSONFeedStringifyError>`

Serializes an instance, or validates and serializes plain data, to JSON Feed text.
`JSONFeedStringifyError` reports an extension holding a value JSON cannot represent, such as a
`BigInt`.

### `feed.feed`

The metadata, as a clone.

### `feed.setFeed(feed: JSONFeed.Feed): Result<void, JSONFeedParseError>`

Replaces the metadata and keeps the items. Fails without a `title`, leaving the feed unchanged.

### `feed.items`

The items, as clones, in the order they were added.

### `feed.version`

The version URL the feed declares: the one a parsed document carried, or JSON Feed 1.1.

### `feed.addItem(item: JSONFeed.Item): Result<void, JSONFeedParseError>`

Appends a clone of the item. Fails without an `id`, leaving the feed unchanged.

### `feed.removeItem(id: string): void`

Removes the item carrying that id.

### `feed.toJSON(): JSONFeed.Document`

The JSON Feed document: format field names, in the format's order, empty fields omitted.

### `JSONFeed.parse(source: string): Result<JSONFeed, JSONFeedParseError>`

Parses JSON Feed text. Fails when the text is not JSON or lacks a version URL, a title or an
`items` array; within that, each field is kept only when usably typed, and items without an id
are dropped.

### `JSONFeed.fromJSON(value: unknown): Result<JSONFeed, JSONFeedParseError>`

`parse` for a value you already ran through `JSON.parse`.

### `JSONFeed.fetch(input: URL | RequestInfo, init?: RequestInit): Promise<Result<JSONFeed, JSONFeedFetchError | JSONFeedParseError>>`

Requests the feed and parses the body. An `accept` header in `init` replaces the default one.

### `JSONFeed.version(value: unknown): string | undefined`

The JSON Feed version URL a value declares, or `undefined` for any other JSON.

### `JSONFeed.mediaType`

`"application/feed+json"`.

### `JSONFeedParseError`, `JSONFeedFetchError`, `JSONFeedStringifyError`

`JSONFeedParseError` reports a value that is not a usable feed, or a missing `title`/`id` when
building. `JSONFeedFetchError` reports a request that failed or answered a non-`ok` status.
`JSONFeedStringifyError` reports data JSON cannot represent.

### Types

- `JSONFeed.Feed`, `JSONFeed.Item`, `JSONFeed.Author`, `JSONFeed.Attachment`, `JSONFeed.Hub`: a
  feed as this package holds it, camelCase. `Feed` and `Item` accept extension keys.
- `JSONFeed.Data`: `{ feed: JSONFeed.Feed; items: JSONFeed.Item[] }`, what `from` and `stringify`
  accept.
- `JSONFeed.ExtensionKey`: `` `_${string}` ``, the name of a publisher extension.
- `JSONFeed.Document`, `JSONFeed.DocumentItem`, `JSONFeed.DocumentAttachment`: the feed as JSON
  Feed writes it, which is what `toJSON` returns.

## Pattern: A Podcast Feed

Attachments carry the episode files; hubs let readers subscribe to change notifications.

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let json = JSONFeed.stringify({
	feed: {
		title: "The Weekly Show",
		homePageUrl: "https://podcast.example.com",
		feedUrl: "https://podcast.example.com/feed.json",
		icon: "https://podcast.example.com/icon.png",
		favicon: "https://podcast.example.com/favicon.png",
		hubs: [{ type: "WebSub", url: "https://hub.example.com" }],
	},
	items: [
		{
			id: "episode-1",
			title: "Episode 1",
			contentText: "Show notes for the first episode.",
			image: "https://podcast.example.com/episode-1.jpg",
			datePublished: "2026-02-07T14:04:00-05:00",
			attachments: [
				{
					url: "https://podcast.example.com/episode-1.mp3",
					mimeType: "audio/mpeg",
					sizeInBytes: 48_000_000,
					durationInSeconds: 3_600,
				},
			],
		},
	],
});
if (isFailure(json)) throw json.error;

let response = new Response(json.data, {
	headers: { "content-type": JSONFeed.mediaType },
});
```

## Pattern: Publish An Extension

Any field whose name starts with an underscore is written as-is and read back unchanged.

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let json = JSONFeed.stringify({
	feed: {
		title: "The Record",
		_blue_shed: {
			about: "https://blueshed-podcasts.com/json-feed-extension-docs",
			explicit: false,
		},
	},
	items: [{ id: "1", contentText: "Episode one", _blue_shed: { season: 1 } }],
});
if (isFailure(json)) throw json.error;

let result = JSONFeed.parse(json.data);
if (isFailure(result)) throw result.error;

result.data.feed["_blue_shed"]; // { about: "…", explicit: false }
result.data.items[0]?.["_blue_shed"]; // { season: 1 }
```

## Pattern: Import Items From Someone Else's Feed

Every parsed item has an id; the rest is optional. `contentHtml` is the publisher's markup,
unsanitized, and `contentText` is plain text to escape before rendering as HTML.

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let result = await JSONFeed.fetch("https://example.com/feed.json");
if (isFailure(result)) return result.error;

let entries = result.data.items.map((item) => ({
	id: item.id,
	url: item.url ?? item.id,
	html: item.contentHtml ?? escapeHtml(item.contentText ?? ""),
	author: item.authors?.[0]?.name ?? item.author?.name,
	publishedAt: item.datePublished ? new Date(item.datePublished) : undefined,
}));
```

## Pattern: Recognize A Feed Among Other JSON

When a URL may serve any JSON, check the version URL before reading it as a feed.

```typescript
import { JSONFeed } from "@sdxc/json-feed";

let response = await fetch(url);
let value: unknown = await response.json();

if (JSONFeed.version(value)) {
	let result = JSONFeed.fromJSON(value);
}
```

## Pattern: Edit A Feed And Write It Back

A parsed feed keeps the version it declared, so a JSON Feed 1.0 document, with its singular
`author`, writes back out as 1.0.

```typescript
import { JSONFeed } from "@sdxc/json-feed";
import { isFailure } from "@sdxc/result";

let result = JSONFeed.parse(stored);
if (isFailure(result)) throw result.error;

let feed = result.data;
let replaced = feed.setFeed({ ...feed.feed, expired: true });
if (isFailure(replaced)) throw replaced.error;
feed.removeItem("https://example.com/posts/retracted");

feed.version; // "https://jsonfeed.org/version/1" when the source was 1.0
let updated = JSONFeed.stringify(feed);
```

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
