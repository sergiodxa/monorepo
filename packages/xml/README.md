# @sdxc/xml

XML parser and serializer for RSS-style feeds.

It reads XML text into an `XML` document instance and writes that instance back out. The
target is the subset of XML feeds actually use: one root element, attributes, nested
elements, text nodes, CDATA sections, namespace-prefixed names, and an XML declaration.

Real feeds are written by tools that emit `&nbsp;` and `&mdash;` without declaring a DTD,
so the parser resolves the five entities XML predefines, numeric character references such
as `&#8217;`, and the 248 named entities the three XHTML 1.0 entity sets declare. A name
outside those sets is reported as a parse error. Serialization escapes only the five
predefines, so a document that arrives with `&nbsp;` round-trips as the character itself.

## Installation

```bash
npm add @sdxc/xml
```

Parsing and serialization report failures as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this
package and supplies `isFailure`, `isSuccess`, and `unwrap`.

## Usage

### Parse A Document

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let result = XML.parse(
	`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title></channel></rss>`,
);

if (isFailure(result)) throw result.error;

let xml = result.data;
xml.query("channel/title"); // { name: "title", children: ["Feed"] }
```

Whitespace-only text nodes are indentation rather than content, so the parser drops them and
a traversal never has to step over them.

### Traverse A Document

`query` and `queryAll` take a `/`-delimited path rooted at the document's root element;
`find` and `findAll` take a predicate and walk depth-first.

```typescript
let channel = xml.query("channel");
let items = xml.queryAll("channel/item");

let firstLink = xml.find((element) => element.name === "link");
let allLinks = xml.findAll((element) => element.name === "link");
```

### Write A Document

`XML.stringify` takes a root element and returns the text for it:

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let result = XML.stringify({
	name: "rss",
	attributes: { version: "2.0" },
	children: [
		{
			name: "channel",
			children: [{ name: "title", children: ["Feed"] }],
		},
	],
});

if (isFailure(result)) throw result.error;

let source = result.data; // <rss version="2.0"><channel><title>Feed</title></channel></rss>
```

A declaration belongs to a document rather than to an element, so pass the whole document to
write one:

```typescript
let result = XML.stringify({
	declaration: { version: "1.0", encoding: "UTF-8" },
	root: { name: "rss", attributes: { version: "2.0" } },
});

// <?xml version="1.0" encoding="UTF-8"?>
// <rss version="2.0"/>
```

### Round-Trip A Document

`toJSON` hands back plain data that both the `XML` constructor and `XML.stringify` accept,
and `toString` serializes the instance in place.

```typescript
let json = xml.toJSON();

let copy = new XML(json);
let source = copy.toString();

XML.stringify(json); // the same text, as a Result
```

## API

### `XML.parse(source: string): Result<XML, XMLParseError>`

Parses XML text into an `XML` instance.

### `XML.stringify(input: XML | XML.Input): Result<string, XMLStringifyError>`

Serializes an instance, whole document data, or a bare root element into XML text. An element
carries no declaration; pass a document or an instance to write one.

```typescript
XML.stringify({ name: "rss", attributes: { version: "2.0" } });
// success('<rss version="2.0"/>')
```

### `new XML(document: XML.Document)`

Wraps a document that is already plain data, such as one from `toJSON`.

### `xml.declaration: XML.Declaration | undefined`

The parsed XML declaration, when the document carried one.

### `xml.root: XML.Element`

The root element.

### `xml.find(predicate: XML.Predicate): XML.Element | undefined`

The first element the predicate accepts, in depth-first order.

### `xml.findAll(predicate: XML.Predicate): XML.Element[]`

Every element the predicate accepts, in depth-first order.

### `xml.query(path: string): XML.Element | undefined`

The first element at a `/`-delimited path such as `channel/item/title`.

### `xml.queryAll(path: string): XML.Element[]`

Every element at a `/`-delimited path such as `channel/item`.

### `xml.toJSON(): XML.Document`

The document as plain serializable data.

### `xml.toString(): string`

The document as XML text. This is the one entry point that throws an `XMLStringifyError`
rather than returning it, because `toString` has no room for a `Result`; reach for
`XML.stringify` where a failure is a value you want to handle.

### `XMLParseError`

The source is malformed, carries no root element, or names an entity outside the resolved
sets.

### `XMLStringifyError`

The tree cannot be expressed as valid XML: a name that fails the XML `Name` production, or a
prefix with no namespace declared in scope.

### Types

Every public type lives in the `XML` namespace: `XML.Declaration`, `XML.Element`,
`XML.Node`, `XML.Document`, `XML.Input`, and `XML.Predicate`. `XML.Input` is what
`stringify` accepts: a whole `XML.Document` or the root `XML.Element` alone.

```typescript
import type { XML } from "@sdxc/xml";

function titleOf(element: XML.Element): string | undefined {
	let [text] = element.children ?? [];
	return typeof text === "string" ? text : undefined;
}
```

An `XML.Node` is either an `XML.Element` or a string, and a string is always a text node.
Markup belongs in child elements: a string holding `<p>Hi</p>` serializes as escaped text,
which is what makes the output parse back into the tree it was given.

## Pattern: Reading A Feed's Channel

```typescript
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let result = XML.parse(source);
if (isFailure(result)) throw result.error;

let xml = result.data;

for (let item of xml.queryAll("channel/item")) {
	let title = item.children?.find((child) => typeof child !== "string" && child.name === "title");
}
```

## Pattern: Preserving Namespaces

A prefix is resolved against the `xmlns:*` attributes in scope, so declare one on the same
element tree that uses it. Serialization fails on a prefix with no declaration rather than
writing XML that will not parse.

```typescript
XML.stringify({
	name: "rss",
	attributes: {
		version: "2.0",
		"xmlns:content": "http://purl.org/rss/1.0/modules/content/",
	},
	children: [{ name: "content:encoded", children: ["<p>HTML</p>"] }],
});
```

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
