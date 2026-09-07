# @sdxc/atom

Atom 1.0 feed parser and builder.

It reads [RFC 4287](https://www.rfc-editor.org/rfc/rfc4287) documents into an `Atom`
instance and serializes that instance back into XML. It is a faithful reader rather than a
helpful one: every link keeps its relation, dates stay the text the source held, and an entry
that omits an author is reported as omitting one.

That matters because Atom leaves several choices to the consumer. Which link is "the" link,
whether an entry inherits its author from the feed, and how a date should be interpreted are
decisions a reader makes differently from an archiver. Both get the same complete picture
here, and pick from it.

Elements outside the Atom namespace are preserved through `extensions`, so a document
carrying a foreign module survives a read and a write unchanged.

## Installation

```bash
npm add @sdxc/atom
```

The statics report failures as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and `Atom.fromXML` takes a
document from [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml). Both install alongside
this package.

## Usage

### Parse A Feed

```typescript
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";

let result = Atom.parse(xml);
if (isFailure(result)) throw result.error;

let atom = result.data;
console.log(atom.feed.title);
for (let entry of atom.entries) console.log(entry.id, entry.updated);
```

Pass the document's own URL as the second argument, and the references the feed leaves
relative resolve against it:

```typescript
let result = Atom.parse(xml, "https://example.com/feed.xml");
```

### Fetch A Feed

```typescript
let result = await Atom.fetch(new URL("https://example.com/feed.xml"));
```

`Atom.fetch` places no constraint on the response's `Content-Type`, because feeds are
routinely served as `text/xml`, `application/octet-stream`, and worse. Relative references
resolve against the URL the response finally came from, so a redirected feed still yields
absolute links.

### Build A Feed

```typescript
import { Atom } from "@sdxc/atom";

let atom = new Atom({
	id: "tag:example.com,2026:feed",
	title: "My Blog",
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

## API

### `new Atom(feed: Atom.Feed)`

Creates a feed from its metadata, with no entries. RFC 4287 §4.1.1 requires `id`, `title`,
and `updated`, and an `AtomParseError` is thrown when one is missing.

### `atom.feed`

The feed-level metadata, as a clone. Assigning a new `Atom.Feed` replaces it and leaves the
entries in place.

### `atom.entries`

The entries, as clones, in the order they were added.

### `atom.addEntry(entry: Atom.Entry)`

Appends one entry. Each entry requires `id`, `title`, and `updated`, on the same terms as the
feed.

### `atom.removeEntry(id: string)`

Removes the entry carrying an id. RFC 4287 makes entry ids unique within a feed, so at most
one entry matches.

### `atom.toJSON()`

Returns `{ feed, entries }` as plain serializable data.

### `atom.toString()`

Serializes the feed to Atom 1.0 XML.

### `Atom.parse(source: string, base?: string): Result<Atom, AtomParseError>`

Parses XML text, resolving relative references against `base`.

### `Atom.fromXML(xml: XML, base?: string): Result<Atom, AtomParseError>`

Reads a feed out of an already-parsed document, for a caller that parsed the text for some
other purpose first.

### `Atom.fetch(input, init?): Promise<Result<Atom, AtomFetchError | AtomParseError>>`

Retrieves a document and parses it, so a failed request, an error status, and an unparseable
body are all values rather than exceptions.

### Errors

`AtomParseError` reports a document that is not a feed, or metadata missing a required
field. `AtomFetchError` reports a request that failed or answered with an error status.
`AtomStringifyError` reports a feed that cannot be written as XML.

## Reading The Data

### Text Constructs

`title`, `subtitle`, `summary`, and `rights` carry a `type` of `text`, `html`, or `xhtml`. A
construct with no type collapses to a plain string; the other two arrive as
`{ value, type }`:

```typescript
atom.feed.title; // "My Blog"
entry.summary; // { value: "<em>Recap</em>", type: "html" }
```

An `xhtml` construct is serialized back into a markup string while parsing, and the `<div>`
wrapper RFC 4287 requires is dropped, so reading a title never means walking a second tree.

### Links

Every `<link>` is kept with its attributes. RFC 4287 defaults an absent `rel` to
`alternate`, and that default is left absent rather than filled in, because applying it is a
reader's concern:

```typescript
let links = Array.isArray(entry.link) ? entry.link : entry.link ? [entry.link] : [];
let page = links.find((link) => (link.rel ?? "alternate") === "alternate");
```

### Dates

`updated` and `published` are the raw RFC 3339 strings the document held, so a malformed date
is visible to you rather than becoming an `Invalid Date` inside the parser. Convert at the
point of use:

```typescript
let publishedAt = new Date(entry.published ?? entry.updated);
```

### Authors

RFC 4287 §4.1.2 lets an entry omit its author when the feed supplies one, or when `<source>`
does. All three positions are recorded and no fallback is applied, so a consumer picks the
precedence it wants:

```typescript
let author = entry.author ?? entry.source?.author ?? atom.feed.author;
```

### Relative References

`xml:base` is inherited, and a relative base composes with the one enclosing it. Every
`href`, `uri`, `src`, `icon`, and `logo` resolves against the base in scope while parsing. A
reference with no base in scope, or one that cannot form a URL with it, is left as the
document wrote it.

### Namespaces

The Atom namespace identifies the format; the prefix a document binds it to does not.
`<feed xmlns="…">` and `<a:feed xmlns:a="…">` both parse, and an element counts as Atom only
when its prefix resolves to `http://www.w3.org/2005/Atom`. Anything else is preserved:

```typescript
atom.feed.extensions;
// [{ name: "media:rating", attributes: { scheme: "urn:simple" }, children: ["adult"] }]
```

## Notes

1. An `xhtml` text construct re-serializes as `type="html"`. Its value is a markup string by
   then, and re-parsing it to rebuild a wrapper would fail on any fragment the XML parser
   rejects, so the payload is kept and the typing narrows.
2. Text is never sanitized. An `html` or `xhtml` construct holds whatever the publisher
   wrote, and escaping it is the responsibility of whatever renders it.
3. `length` on a link parses like the rest of the package's numbers: a non-numeric value
   reads as `NaN` rather than failing the document.

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
