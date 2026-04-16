# @pkg/rss

RSS 2.0 feed builder and parser.

## Overview

`@pkg/rss` helps you generate RSS 2.0 feeds for publishing and consume existing feeds from other sites.

It supports the complete set of standard channel and item fields, plus common namespaced extensions such as `atom:link`, `content:encoded`, `dc:creator`, and `slash:comments`. It is a good fit for blog feeds, podcasts, bookmarking feeds, aggregators, and any workflow that needs to create, fetch, or transform RSS data.

## Usage

### Build a Feed

Create a new feed by defining the channel metadata first, then append items before serializing the final XML.

```typescript
import { RSS } from "@pkg/rss";

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

### Parse an Existing Feed

When you already have RSS XML as a string, parse it into an `RSS` instance to inspect the channel metadata and items.

```typescript
import { RSS } from "@pkg/rss";

let feed = RSS.parse(xml);

console.log(feed.channel.title);
for (let item of feed.items) {
	console.log(item.title, item.link);
}
```

### Fetch a Feed

Use `RSS.fetch` to download a remote feed and parse it in one step.

```typescript
import { RSS } from "@pkg/rss";

let feed = await RSS.fetch(new URL("https://example.com/feed.xml"));
```

## API

### `new RSS(channel: RSS.Channel)`

Creates a new feed with the provided channel metadata.

Required channel fields:

- `title`
- `description`
- `link`

### `rss.channel`

Returns the current channel data as a clone.

### `rss.items`

Returns the current item list as clones.

### `rss.addItem(item: RSS.Item)`

Adds one item to the feed.

### `rss.removeItem(guid: string)`

Removes the first item whose guid value matches `guid`.

### `rss.toJSON()`

Returns `{ channel, items }` as plain serializable data.

### `rss.toString()`

Serializes the feed to RSS 2.0 XML.

### `RSS.parse(source: string)`

Parses raw RSS XML into an `RSS` instance.

### `RSS.fetch(input, init?)`

Fetches an XML document and parses it as RSS.

## Supported RSS Fields

### Channel

`RSS.Channel` supports the required RSS 2.0 fields plus:

- `language`
- `copyright`
- `managingEditor`
- `webMaster`
- `pubDate`
- `lastBuildDate`
- `category`
- `generator`
- `docs`
- `cloud`
- `ttl`
- `image`
- `rating`
- `textInput`
- `skipHours`
- `skipDays`

### Item

`RSS.Item` supports:

- `title`
- `link`
- `description`
- `author`
- `category`
- `comments`
- `enclosure`
- `guid`
- `pubDate`
- `source`

## Namespaced Extensions

The package also models the common extensions documented in `spec/rss-profile.md`:

- `atom:link` via `atomLink`
- `content:encoded` via `contentEncoded`
- `dc:creator` via `dcCreator`
- `slash:comments` via `slashComments`

Unknown namespaced elements are preserved through `extensions` so feeds can round-trip custom module data.

If you build feeds with custom prefixed elements, declare their namespace on `channel.namespaces`.

```typescript
let feed = new RSS({
	title: "Example",
	description: "Example",
	link: "https://example.com",
	namespaces: {
		media: "http://search.yahoo.com/mrss/",
	},
	extensions: [
		{
			name: "media:rating",
			attributes: { scheme: "urn:simple" },
			children: ["adult"],
		},
	],
});
```

## Notes

1. RSS date fields are preserved as strings; use RFC 822 style values such as `Tue, 14 Apr 2026 09:00:00 GMT`.
2. `description` and `contentEncoded` are serialized as XML text, so embedded HTML is escaped unless it already arrived through parsed XML.
3. `guid`, `category`, `enclosure`, and `atomLink` support both a compact single-value form and structured objects when attributes are needed.
