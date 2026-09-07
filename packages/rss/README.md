# @sdxc/rss

RSS 2.0 feed builder and parser.

It builds feeds for publishing and reads feeds published by other sites, covering the whole
set of standard channel and item fields plus the namespaced extensions feeds lean on in
practice: `atom:link`, `content:encoded`, `dc:creator`, and `slash:comments`. Anything else
namespaced is preserved rather than discarded, so a feed carrying a custom module survives a
read and a write unchanged.

## Installation

```bash
npm add @sdxc/rss
```

`RSS.fromXML` takes a document from [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml),
which installs alongside this package.

## Usage

### Build A Feed

Describe the channel first, append items, then serialize.

```typescript
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

The namespaces the extensions need are declared for you, so the example above writes
`xmlns:atom` and `xmlns:content` onto the root element.

### Read A Feed

```typescript
import { RSS } from "@sdxc/rss";

let feed = RSS.parse(xml);

console.log(feed.channel.title);
for (let item of feed.items) console.log(item.title, item.link);
```

Parsing throws on a document that is not RSS, so wrap the call where a malformed feed is an
expected outcome rather than a bug:

```typescript
try {
	return RSS.parse(xml);
} catch (error) {
	return recordBadFeed(error);
}
```

### Fetch A Feed

```typescript
import { RSS } from "@sdxc/rss";

let feed = await RSS.fetch(new URL("https://example.com/feed.xml"));
```

`RSS.fetch` asks the origin not to serve a cached copy, requires the response to be `ok` and
to carry an XML content type, and throws when either fails.

## API

### `new RSS(channel: RSS.Channel)`

Creates a feed with the given channel metadata and no items. `title`, `description`, and
`link` are required.

### `rss.channel`

The channel data, as a clone. Assigning a new `RSS.Channel` replaces it and leaves the items
in place.

```typescript
rss.channel = { ...rss.channel, language: "en-us" };
```

### `rss.items`

The items, as clones, in the order they were added.

### `rss.addItem(item: RSS.Item)`

Appends one item. RSS 2.0 requires at least a `title` or a `description`.

### `rss.removeItem(guid: string)`

Removes the first item whose guid value matches.

### `rss.toJSON()`

Returns `{ channel, items }` as plain serializable data.

### `rss.toString()`

Serializes the feed to RSS 2.0 XML.

### `RSS.parse(source: string): RSS`

Parses RSS XML. Throws when the text is not XML, or when its root element is not `rss`.

### `RSS.fromXML(xml: XML): RSS`

Reads a feed out of an already-parsed document, for a caller that parsed the text for some
other purpose first.

### `RSS.fetch(input: URL | RequestInfo, init?: RequestInit): Promise<RSS>`

Retrieves a document and parses it.

## Supported Fields

### Channel

Beyond the required `title`, `description`, and `link`: `language`, `copyright`,
`managingEditor`, `webMaster`, `pubDate`, `lastBuildDate`, `category`, `generator`, `docs`,
`cloud`, `ttl`, `image`, `rating`, `textInput`, `skipHours`, and `skipDays`.

### Item

At least one of `title` or `description`, plus `link`, `author`, `category`, `comments`,
`enclosure`, `guid`, `pubDate`, and `source`.

### Namespaced Extensions

The four common modules, from the
[RSS Best Practices Profile](https://www.rssboard.org/rss-profile), have named fields:

| Field            | Element           |
| ---------------- | ----------------- |
| `atomLink`       | `atom:link`       |
| `contentEncoded` | `content:encoded` |
| `dcCreator`      | `dc:creator`      |
| `slashComments`  | `slash:comments`  |

Any other namespaced element round-trips through `extensions`. Declare its namespace on
`channel.namespaces` when you write one, since a prefix with no declaration in scope cannot
be serialized.

```typescript
let feed = new RSS({
	title: "Example",
	description: "Example",
	link: "https://example.com",
	namespaces: { media: "http://search.yahoo.com/mrss/" },
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

1. Dates are the strings the document holds, so write them in RFC 822 style —
   `Tue, 14 Apr 2026 09:00:00 GMT`, which is what `Date.prototype.toUTCString` produces.
2. `description` and `contentEncoded` are written as XML text, so embedded HTML is escaped
   on the way out and arrives unescaped on the way back in.
3. `guid`, `category`, `enclosure`, and `atomLink` each accept a bare string for the common
   case and an object when attributes matter.
4. Nothing is sanitized. An item's markup is whatever the publisher wrote, and escaping it is
   the responsibility of whatever renders it.

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
