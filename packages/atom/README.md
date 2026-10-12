# @sdxc/atom

Atom 1.0 feed parser and builder.

It reads [RFC 4287](https://www.rfc-editor.org/rfc/rfc4287) documents into an `Atom` instance
and writes that instance back as XML. Every link keeps its relation, dates stay the text the
source held, and authors stay where the document put them, so the consumer picks the precedence
it wants. Elements outside the Atom namespace are kept as `extensions` and survive a round trip.

## Installation

```sh
npm add @sdxc/atom
```

Parsing answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
and `Atom.fromXML` reads a document from [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml).
Both install alongside this package.

## Usage

### Parse a feed

```typescript
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";

let result = Atom.parse(xml, "https://example.com/feed.xml");
if (isFailure(result)) throw result.error;

let atom = result.data;
atom.feed.title; // "Example Blog"
for (let entry of atom.entries) console.log(entry.id, entry.updated);
```

The second argument is the document's own URL; relative `href`, `uri`, `src`, `icon` and `logo`
values resolve against it and any `xml:base` the document declares.

### Fetch a feed

```typescript
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";

let result = await Atom.fetch(new URL("https://example.com/feed.xml"));
if (isFailure(result)) return result.error.message;
```

Any `Content-Type` is accepted, and relative references resolve against the URL the response
finally came from, so a redirected feed still yields absolute links.

### Build a feed

```typescript
import { Atom } from "@sdxc/atom";

let atom = new Atom({
	id: "tag:example.com,2026:feed",
	title: "Example Blog",
	updated: new Date().toISOString(),
	link: [
		{ href: "https://example.com/", rel: "alternate", type: "text/html" },
		{ href: "https://example.com/feed.xml", rel: "self", type: "application/atom+xml" },
	],
	author: { name: "Ada Lovelace" },
});

atom.addEntry({
	id: "tag:example.com,2026:post-1",
	title: "Hello World",
	updated: "2026-04-14T10:30:00Z",
	published: "2026-04-14T09:00:00Z",
	summary: "A short summary",
	content: { type: "html", value: "<p>Full post content</p>" },
	link: { href: "https://example.com/posts/hello", rel: "alternate" },
});

let xml = atom.toString();
```

The feed and every entry require `id`, `title` and `updated`; the constructor and `addEntry`
throw an `AtomParseError` naming the first one missing.

## API

### `new Atom(feed: Atom.Feed)`

Creates a feed from its metadata with no entries. Throws `AtomParseError` when `id`, `title` or
`updated` is missing.

### `atom.feed`

The feed-level metadata, as a clone. Assigning a new `Atom.Feed` validates and replaces it,
leaving the entries in place.

### `atom.entries`

The entries, as clones, in the order they were added.

### `atom.addEntry(entry: Atom.Entry): void`

Appends one entry. Throws `AtomParseError` when `id`, `title` or `updated` is missing.

### `atom.removeEntry(id: string): void`

Removes the entry carrying `id`; an unknown id leaves the feed unchanged.

### `atom.toJSON(): Atom.Document`

Returns `{ feed, entries }` as plain serializable data.

### `atom.toString(): string`

Serializes the feed to Atom 1.0 XML with the Atom namespace as the default. Throws
`AtomStringifyError` when the data cannot form a valid document.

### `Atom.parse(source: string, base?: string): Result<Atom, AtomParseError>`

Parses XML text, resolving relative references against `base`.

### `Atom.fromXML(xml: XML, base?: string): Result<Atom, AtomParseError>`

Reads a feed out of a document already parsed with `XML.parse`.

### `Atom.fetch(input: URL | RequestInfo, init?: RequestInit): Promise<Result<Atom, AtomFetchError | AtomParseError>>`

Retrieves a document with the global `fetch` and parses it. A rejected request or a non-2xx
status answers `AtomFetchError`; an unparseable body answers `AtomParseError`.

### Errors

- `AtomParseError`: the document is not an Atom feed, or metadata lacks a required field.
- `AtomFetchError`: the request failed or answered with an error status.
- `AtomStringifyError`: the feed cannot be written as XML.

### Types

All types live on the `Atom` namespace. A field that may repeat holds one value when the
document had one and an array when it had several.

- `Atom.Feed`: feed metadata. `id`, `title` and `updated` are required; `subtitle`, `rights`,
  `author`, `contributor`, `link`, `category`, `generator`, `icon` and `logo` are optional.
  `lang` and `base` hold the root's `xml:lang` and `xml:base`, `namespaces` its prefix
  declarations, and `attributes` any other root attributes.
- `Atom.Entry`: one entry. `id`, `title` and `updated` are required; it adds `published`,
  `summary`, `content` and `source`, plus its own `lang` and `base` when they differ from the
  feed's.
- `Atom.Text` / `Atom.TextInput`: a text construct, `{ value, type? }` with `type` of `text`,
  `html` or `xhtml`, or a bare string for plain text.
- `Atom.Content`: an entry body with any media `type`, an inline `value`, or a `src` for a body
  held elsewhere.
- `Atom.Person` (`name`, `uri?`, `email?`), `Atom.Link` (`href`, `rel?`, `type?`, `hreflang?`,
  `title?`, `length?`), `Atom.Category` (`term`, `scheme?`, `label?`), `Atom.Generator`
  (`value`, `uri?`, `version?`) and `Atom.Source`, the metadata of the feed an entry was copied
  from.
- `Atom.PersonInput`, `Atom.LinkInput`, `Atom.CategoryInput`: one value or an array; a category
  may be a bare term string.
- `Atom.Element` / `Atom.Node`: a foreign element `{ name, attributes?, children? }`, kept in
  the `extensions` array of a feed, entry, person, link, category or source.
- `Atom.Document`: `{ feed, entries }`, the shape `toJSON` returns.

## Pattern: Reading Entries For Display

Links keep `rel` absent when the document left it out, text constructs arrive as a string or
`{ value, type }`, dates are the raw RFC 3339 text, and an entry's author may sit on the entry,
its `source` or the feed. A reader applies the defaults it wants at the point of use.

```typescript
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";

function list<T>(value: T | T[] | undefined): T[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

function text(value: Atom.TextInput | undefined): string {
	if (value === undefined) return "";
	return typeof value === "string" ? value : value.value;
}

let result = await Atom.fetch(new URL("https://example.com/feed.xml"));
if (isFailure(result)) throw result.error;

let atom = result.data;
let items = atom.entries.map((entry) => {
	let page = list(entry.link).find((link) => (link.rel ?? "alternate") === "alternate");
	let author = list(entry.author ?? entry.source?.author ?? atom.feed.author)[0];
	return {
		title: text(entry.title),
		url: page?.href,
		author: author?.name,
		publishedAt: new Date(entry.published ?? entry.updated),
	};
});
```

An `html` or `xhtml` value is the publisher's markup, unsanitized; escape or sanitize it before
rendering.

## Pattern: Serving A Feed From A Request Handler

Build the feed from your records and answer it with the Atom media type.

```typescript
import { Atom } from "@sdxc/atom";

interface Post {
	slug: string;
	title: string;
	excerpt: string;
	html: string;
	publishedAt: Date;
	updatedAt: Date;
}

function feedResponse(posts: Post[]): Response {
	let atom = new Atom({
		id: "https://example.com/",
		title: "Example Blog",
		updated: (posts[0]?.updatedAt ?? new Date()).toISOString(),
		link: { href: "https://example.com/feed.xml", rel: "self" },
		author: { name: "Ada Lovelace", uri: "https://example.com/about" },
		generator: { value: "Example CMS", version: "1.0" },
	});

	for (let post of posts) {
		atom.addEntry({
			id: `https://example.com/posts/${post.slug}`,
			title: post.title,
			updated: post.updatedAt.toISOString(),
			published: post.publishedAt.toISOString(),
			summary: post.excerpt,
			content: { type: "html", value: post.html },
			link: { href: `https://example.com/posts/${post.slug}` },
			category: ["writing"],
		});
	}

	return new Response(atom.toString(), {
		headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
	});
}
```

## Pattern: Editing A Feed In Place

Parse an existing document, change its entries and metadata, and write it back. Everything the
methods leave alone, foreign elements included, comes out as it went in.

```typescript
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";

let result = Atom.parse(xml, "https://example.com/feed.xml");
if (isFailure(result)) throw result.error;

let atom = result.data;
atom.removeEntry("tag:example.com,2026:post-1");
atom.addEntry({
	id: "tag:example.com,2026:post-2",
	title: { value: "Second <em>post</em>", type: "html" },
	updated: "2026-05-01T08:00:00Z",
});
atom.feed = { ...atom.feed, updated: "2026-05-01T08:00:00Z" };

let updated = atom.toString();
```

An `xhtml` text construct or body is written back as `html`, carrying the same markup.

## Pattern: Foreign Elements And Namespaces

An element counts as Atom when its prefix resolves to `http://www.w3.org/2005/Atom`, whatever
the prefix is; every other element lands in `extensions` with its qualified name. To write one,
declare its prefix in the feed's `namespaces`.

```typescript
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";

let atom = new Atom({
	id: "tag:example.com,2026:podcast",
	title: "Example Podcast",
	updated: "2026-04-14T10:30:00Z",
	namespaces: { media: "http://search.yahoo.com/mrss/" },
	extensions: [
		{ name: "media:rating", attributes: { scheme: "urn:simple" }, children: ["nonadult"] },
	],
});

atom.addEntry({
	id: "tag:example.com,2026:episode-1",
	title: "Episode 1",
	updated: "2026-04-14T10:30:00Z",
	link: {
		href: "https://example.com/episode-1.mp3",
		rel: "enclosure",
		type: "audio/mpeg",
		length: 12345678,
	},
	extensions: [{ name: "media:thumbnail", attributes: { url: "https://example.com/1.jpg" } }],
});

let result = Atom.parse(atom.toString());
if (isFailure(result)) throw result.error;

result.data.feed.extensions;
// [{ name: "media:rating", attributes: { scheme: "urn:simple" }, children: ["nonadult"] }]
```

## Pattern: Parsing An Already-Parsed Document

When the XML is parsed for another purpose first, such as sniffing whether it is Atom or RSS,
hand the document to `Atom.fromXML` instead of parsing the text twice.

```typescript
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let parsed = XML.parse(text);
if (isFailure(parsed)) throw parsed.error;

let result = Atom.fromXML(parsed.data, "https://example.com/feed.xml");
if (isFailure(result)) {
	// not an Atom feed: try another format with parsed.data
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/atom": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
