# @sdxc/atom

Atom 1.0 feed parser and builder.

## Overview

`@sdxc/atom` reads [RFC 4287](https://www.rfc-editor.org/rfc/rfc4287) documents into an `Atom` instance and serializes that instance back into XML. It is the Atom counterpart to `@sdxc/rss`, built on the same XML layer, and it is a faithful reader rather than a helpful one: every link keeps its relation, dates stay the text the source held, and an entry that omits an author is reported as omitting one.

That matters because Atom leaves several choices to the consumer. Which link is "the" link, whether an entry inherits its author from the feed, and how a date should be interpreted are all decisions a reader makes differently from an archiver. This package gives both of them the same complete picture.

Elements outside the Atom namespace are preserved through `extensions`, so a document carrying a foreign module survives a read and a write unchanged.

## Usage

### Parse a Feed

```typescript
import { isFailure } from "@sdxc/result";
import { Atom } from "@sdxc/atom";

let result = Atom.parse(xml);
if (isFailure(result)) throw result.error;

let feed = result.data;
console.log(feed.feed.title);
for (let entry of feed.entries) console.log(entry.id, entry.updated);
```

Pass the document's own URL as the second argument so references the feed leaves relative resolve against it:

```typescript
let result = Atom.parse(xml, "https://example.com/feed.xml");
```

### Fetch a Feed

```typescript
let result = await Atom.fetch(new URL("https://example.com/feed.xml"));
```

`Atom.fetch` places no constraint on the response's `Content-Type`, because feeds are routinely served as `text/xml`, `application/octet-stream`, and worse. Relative references resolve against the URL the response finally came from, so a redirected feed still yields absolute links.

### Build a Feed

```typescript
import { Atom } from "@sdxc/atom";

let feed = new Atom({
	id: "tag:example.com,2026:feed",
	title: "My Blog",
	updated: new Date().toISOString(),
	link: [
		{ href: "https://example.com/", rel: "alternate", type: "text/html" },
		{ href: "https://example.com/feed.xml", rel: "self", type: "application/atom+xml" },
	],
	author: { name: "Ada Lovelace" },
});

feed.addEntry({
	id: "tag:example.com,2026:post-1",
	title: "Hello World",
	updated: "2026-04-14T10:30:00Z",
	published: "2026-04-14T09:00:00Z",
	summary: "A short summary",
	content: { type: "html", value: "<p>Full post content</p>" },
	link: { href: "https://example.com/posts/hello", rel: "alternate" },
});

let xml = feed.toString();
```

## API

### `new Atom(feed: Atom.Feed)`

Creates a feed from its metadata, with no entries.

Required fields, per RFC 4287 §4.1.1:

- `id`
- `title`
- `updated`

### `atom.feed`

The feed-level metadata, as a clone. Assigning a new `Atom.Feed` replaces it and leaves the entries in place.

### `atom.entries`

The entries, as clones, in the order they were added.

### `atom.addEntry(entry: Atom.Entry)`

Appends one entry. Each entry requires `id`, `title`, and `updated`.

### `atom.removeEntry(id: string)`

Removes the entry carrying an id. RFC 4287 makes entry ids unique within a feed, so at most one entry matches.

### `atom.toJSON()`

Returns `{ feed, entries }` as plain serializable data.

### `atom.toString()`

Serializes the feed to Atom 1.0 XML.

### `Atom.parse(source: string, base?: string)`

Parses XML text. Returns a `Result` holding the feed, or the reason the text is not one.

### `Atom.fromXML(xml: XML, base?: string)`

Reads a feed out of an already-parsed `@sdxc/xml` document, for a caller that parsed the text for some other purpose first.

### `Atom.fetch(input, init?)`

Retrieves a document and parses it. Returns a `Result`, so a failed request, an error status, and an unparseable body are all values rather than exceptions.

## Reading the Data

### Text constructs

`title`, `subtitle`, `summary` and `rights` are text constructs, which carry a `type` of `text`, `html`, or `xhtml`. A construct with no type collapses to a plain string; the other two arrive as `{ value, type }`:

```typescript
feed.title; // "My Blog"
entry.summary; // { value: "<em>Recap</em>", type: "html" }
```

An `xhtml` construct is serialized back into a markup string during parsing, and the `<div>` wrapper RFC 4287 requires is dropped, so reading a title never means walking a second tree.

### Links

Every `<link>` is kept, with its attributes. RFC 4287 defaults an absent `rel` to `alternate`, and this package leaves it absent rather than filling it in, because the default is a reader's concern:

```typescript
let links = Array.isArray(entry.link) ? entry.link : entry.link ? [entry.link] : [];
let page = links.find((link) => (link.rel ?? "alternate") === "alternate");
```

### Dates

`updated` and `published` are the raw RFC 3339 strings the document held, so a malformed date is visible to you rather than becoming an `Invalid Date` inside the parser. Convert at the point of use:

```typescript
let publishedAt = new Date(entry.published ?? entry.updated);
```

### Authors

RFC 4287 §4.1.2 lets an entry omit its author when the feed supplies one, or when `<source>` does. This package records all three positions and applies no fallback, so a consumer picks the precedence it wants:

```typescript
let author = entry.author ?? entry.source?.author ?? feed.author;
```

### Relative references

`xml:base` is inherited, and a relative base composes with the one enclosing it. Every `href`, `uri`, `src`, `icon`, and `logo` is resolved against the base in scope during parsing. A reference with no base in scope, or one that cannot form a URL with it, is left as the document wrote it.

## Namespaces

The Atom namespace identifies the format; the prefix a document binds it to does not. `<feed xmlns="…">` and `<a:feed xmlns:a="…">` both parse, and an element is treated as Atom only when its prefix resolves to `http://www.w3.org/2005/Atom`. Anything else is preserved as an extension:

```typescript
feed.extensions;
// [{ name: "media:rating", attributes: { scheme: "urn:simple" }, children: ["adult"] }]
```

## Related Packages

- [`@sdxc/rss`](/packages/rss) - The RSS 2.0 counterpart
- [`@sdxc/xml`](/packages/xml) - The XML parser and serializer beneath both
- [`@sdxc/result`](/packages/result) - The `Result` type the statics return

## Notes

1. An `xhtml` text construct re-serializes as `type="html"`. Its value is a markup string by then, and re-parsing it to rebuild a wrapper would fail on any fragment the XML parser rejects, so the payload is kept and the typing narrows.
2. Text is never sanitized. An `html` or `xhtml` construct holds whatever the publisher wrote, and escaping it is the responsibility of whatever renders it.
3. `length` on a link is parsed with the same rules as the rest of the package's numbers: a non-numeric value reads as `NaN` rather than failing the document.
