# @sdxc/xml

XML parser and serializer for RSS-style feeds.

It reads the XML feeds use — one root element, attributes, nested elements, text, CDATA,
namespace-prefixed names and an XML declaration — into plain data you can query, and writes that
data back out. Entities resolve to characters: the five XML predefines, numeric references such
as `&#8217;`, and the XHTML named entities (`&nbsp;`, `&mdash;`) feeds use without a DTD.

## Installation

```sh
npm add @sdxc/xml
```

Parsing and serialization answer a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside it.

## Usage

### Parse a document

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let result = XML.parse(
	`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title></channel></rss>`,
);
if (isFailure(result)) throw result.error;

let xml = result.data;
xml.declaration; // { version: "1.0" }
xml.root.name; // "rss"
```

Whitespace-only text between elements is dropped, so the tree holds elements and the text that
carries meaning. Comments, processing instructions and a doctype are skipped.

### Find elements

`query` and `queryAll` follow a `/`-delimited path of child names from the root; the path may
start with the root's own name. `find` and `findAll` walk the tree depth-first with a predicate.

```typescript
xml.query("channel/title"); // { name: "title", children: ["Feed"] }
xml.query("rss/channel/title"); // the same element
xml.queryAll("channel/item"); // every item, in document order

xml.find((element) => element.name === "link");
xml.findAll((element) => element.attributes?.rel === "alternate");
```

### Write a document

`XML.stringify` takes a root element, or a whole document to include a declaration.

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let result = XML.stringify({
	declaration: { version: "1.0", encoding: "UTF-8" },
	root: {
		name: "rss",
		attributes: { version: "2.0" },
		children: [{ name: "channel", children: [{ name: "title", children: ["Feed"] }] }],
	},
});
if (isFailure(result)) throw result.error;

result.data;
// <?xml version="1.0" encoding="UTF-8"?>
// <rss version="2.0"><channel><title>Feed</title></channel></rss>
```

A string child is always text: `<`, `&` and quotes are escaped, so markup belongs in child
elements and the output parses back into the tree it came from.

## API

### `XML.parse(source: string, options?: XML.ParseOptions): Result<XML, XMLParseError>`

Parses XML text into an `XML` instance. `options.whitespace` is `"collapse"` (the default) to drop
whitespace-only text and CDATA, or `"preserve"` to keep every run.

### `XML.stringify(input: XML | XML.Input): Result<string, XMLStringifyError>`

Serializes an instance, a document, or a bare root element. A declaration, when present, is
written on its own line before the root.

### `new XML(document: XML.Document)`

Wraps a document that is already plain data, such as one from `toJSON`.

### `xml.declaration: XML.Declaration | undefined`

The XML declaration, when the document has one.

### `xml.root: XML.Element`

The root element. Every element an instance hands out is a copy, so changing it leaves the
instance untouched.

### `xml.query(path: string): XML.Element | undefined`

The first element at a `/`-delimited path such as `channel/item/title`.

### `xml.queryAll(path: string): XML.Element[]`

Every element at a `/`-delimited path, in document order.

### `xml.find(predicate: XML.Predicate): XML.Element | undefined`

The first element the predicate accepts, in depth-first order.

### `xml.findAll(predicate: XML.Predicate): XML.Element[]`

Every element the predicate accepts, in depth-first order.

### `xml.toJSON(): XML.Document`

The document as plain data, which both `new XML` and `XML.stringify` accept.

### `xml.toString(): string`

The document as XML text. It throws an `XMLStringifyError` on a tree that cannot be serialized;
use `XML.stringify` to get the failure as a value.

### `XMLParseError`

The source is malformed, has no root element, or names an entity outside the resolved sets.

### `XMLStringifyError`

The tree cannot be written as valid XML: an element or attribute name that is not a valid XML
name, a namespace prefix with no `xmlns:*` declaration in scope, or an input with no root
element.

### Types

All types live in the `XML` namespace.

- `XML.Document`: `{ declaration?: XML.Declaration; root: XML.Element }`.
- `XML.Declaration`: `{ version?: string; encoding?: string; standalone?: "yes" | "no" }`.
- `XML.Element`: `{ name: string; attributes?: Record<string, string>; children?: XML.Node[] }`.
- `XML.Node`: an `XML.Element` or a string, which is always a text node.
- `XML.Input`: what `stringify` accepts, an `XML.Document` or a root `XML.Element`.
- `XML.Predicate`: `(element: XML.Element) => boolean`.
- `XML.Whitespace`: `"collapse" | "preserve"`.
- `XML.ParseOptions`: `{ whitespace?: XML.Whitespace }`.

## Pattern: Reading a feed's items

Collect each item's fields, reading text whether it arrived plain or as CDATA.

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

function textOf(element: XML.Element | undefined, name: string): string | undefined {
	let child = element?.children?.find(
		(node): node is XML.Element => typeof node !== "string" && node.name === name,
	);
	let text = child?.children?.filter((node) => typeof node === "string").join("");
	return text || undefined;
}

let response = await fetch("https://example.com/feed.xml");
let result = XML.parse(await response.text());
if (isFailure(result)) throw result.error;

let items = result.data.queryAll("channel/item").map((item) => ({
	title: textOf(item, "title"),
	link: textOf(item, "link"),
	html: textOf(item, "content:encoded"),
}));
```

## Pattern: Writing a feed with a namespace

Declare each prefix with an `xmlns:*` attribute on the element that uses it or an ancestor;
serialization fails on a prefix with nothing declared in scope.

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let posts = [{ title: "Hello", url: "https://example.com/hello", html: "<p>Hi</p>" }];

let result = XML.stringify({
	declaration: { version: "1.0", encoding: "UTF-8" },
	root: {
		name: "rss",
		attributes: { version: "2.0", "xmlns:content": "http://purl.org/rss/1.0/modules/content/" },
		children: [
			{
				name: "channel",
				children: [
					{ name: "title", children: ["Example"] },
					...posts.map((post) => ({
						name: "item",
						children: [
							{ name: "title", children: [post.title] },
							{ name: "link", children: [post.url] },
							{ name: "content:encoded", children: [post.html] },
						],
					})),
				],
			},
		],
	},
});
if (isFailure(result)) throw result.error;

let response = new Response(result.data, {
	headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
});
```

The HTML in `content:encoded` is written as escaped text, which feed readers decode back into
markup.

## Pattern: Editing a parsed document

An instance is read-only; edit its plain data and wrap the result again.

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let parsed = XML.parse(source);
if (isFailure(parsed)) throw parsed.error;

let document = parsed.data.toJSON();
let channel = document.root.children?.find(
	(node) => typeof node !== "string" && node.name === "channel",
);
if (channel && typeof channel !== "string") {
	channel.children = channel.children?.filter(
		(node) => typeof node === "string" || node.name !== "item",
	);
}

let emptied = new XML(document);
emptied.toString(); // the same feed with no items
```

## Pattern: Hashing a document byte for byte

A digest changes with every byte of indentation, so keep whitespace in the tree before hashing a
serialized copy.

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let result = XML.parse("<r>\n\t<t>x</t>\n</r>", { whitespace: "preserve" });
if (isFailure(result)) throw result.error;

result.data.root.children; // ["\n\t", { name: "t", children: ["x"] }, "\n"]

let bytes = new TextEncoder().encode(result.data.toString());
let digest = await crypto.subtle.digest("SHA-256", bytes);
```

References resolve before whitespace is judged, so `&#32;` counts as the space it decodes to.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/xml": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
