# @pkg/xml

XML parser and serializer for RSS-style feeds.

## Overview

`@pkg/xml` parses XML into an `XML` document instance and serializes that instance back into XML text. It is designed for the subset of XML commonly used by RSS and similar feeds: one root element, attributes, nested elements, text nodes, CDATA content, namespace-prefixed names, and XML declarations.

The parser resolves the five entities XML predefines (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;`) and numeric character references such as `&#8217;`. A named entity from HTML, such as `&nbsp;`, is reported as a parse error, since a DTD is what declares it.

## Usage

### Parse RSS-Like XML

```typescript
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse(
	`<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title></channel></rss>`,
);

if (isFailure(result)) throw result.error;

let xml = result.data;
let title = xml.query("channel/title");
```

### Serialize XML

```typescript
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.stringify({
	declaration: { version: "1.0", encoding: "UTF-8" },
	root: {
		name: "rss",
		attributes: { version: "2.0" },
		children: [
			{
				name: "channel",
				attributes: {},
				children: [{ name: "title", attributes: {}, children: ["Feed"] }],
			},
		],
	},
});

if (isFailure(result)) throw result.error;

let xml = result.data;
```

### Serialize an XML Instance

```typescript
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(result)) throw result.error;

let xml = result.data;
let raw = xml.toString();
```

### Stringify an XML Instance

```typescript
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let parsed = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(parsed)) throw parsed.error;

let result = XML.stringify(parsed.data);
if (isFailure(result)) throw result.error;

let raw = result.data;
```

## API

### `XML`

Static XML helpers plus instance traversal and serialization methods.

#### `XML.parse(source: string): Result<XML, XMLParseError>`

Parses XML into an `XML` instance. Whitespace-only text nodes used for indentation are dropped.

**Parameters:**

- `source`: Raw XML text.

**Returns:**

- A `Result` containing the parsed `XML` instance or an `XMLParseError`.

**Example:**

```typescript
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0" />');
```

#### `XML.stringify(input: XML | XML.Element): Result<string, XMLStringifyError>`

Serializes an `XML` instance or a root `XML.Element` into XML text.

**Parameters:**

- `input`: The XML instance, or the root element, to serialize.

**Returns:**

- A `Result` containing the XML string or an `XMLStringifyError`.

**Example:**

```typescript
import { XML } from "@pkg/xml";

let result = XML.stringify({
	name: "rss",
	attributes: { version: "2.0" },
	children: [],
});
```

```typescript
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let parsed = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(parsed)) throw parsed.error;

let result = XML.stringify(parsed.data);
```

#### `xml.declaration: XML.Declaration | undefined`

Returns the parsed XML declaration.

#### `xml.root: XML.Element`

Returns the root element.

#### `xml.toJSON(): XML.Document`

Returns the XML document as plain serializable data.

```ts
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(result)) throw result.error;

let json = result.data.toJSON();
let xml = new XML(json);
```

#### `xml.toString(): string`

Serializes the current `XML` instance into XML text.

```ts
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(result)) throw result.error;

let raw = result.data.toString();
```

#### `xml.find(predicate: XML.Predicate): XML.Element | undefined`

Returns the first element that matches the predicate in depth-first order.

```ts
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(result)) throw result.error;

let title = result.data.find((element) => element.name === "title");
```

#### `xml.findAll(predicate: XML.Predicate): XML.Element[]`

Returns every element that matches the predicate in depth-first order.

```ts
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(result)) throw result.error;

let allTitles = result.data.findAll((element) => element.name === "title");
```

#### `xml.query(path: string): XML.Element | undefined`

Returns the first element matching a `/`-delimited path such as `channel/item/title`.

```ts
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0"><channel><title>Feed</title></channel></rss>');
if (isFailure(result)) throw result.error;

let title = result.data.query("channel/title");
```

#### `xml.queryAll(path: string): XML.Element[]`

Returns all elements matching a `/`-delimited path such as `channel/item`.

```ts
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse('<rss version="2.0"><channel><item>1</item><item>2</item></channel></rss>');
if (isFailure(result)) throw result.error;

let items = result.data.queryAll("channel/item");
```

### `XMLParseError`

Raised when the XML source is malformed or has no valid root element.

### `XMLStringifyError`

Raised when the XML tree cannot be expressed as valid XML, such as when a namespace prefix is missing.

### `XML` Types

All public types are exposed through the `XML` namespace.

#### `XML.Declaration`

```typescript
type Declaration = XML.Declaration;
```

#### `XML.Element`

```typescript
type Element = XML.Element;
```

#### `XML.Node`

```typescript
type Node = XML.Node;
```

#### `XML.Document`

```typescript
type Document = XML.Document;
```

#### `XML.Predicate`

```typescript
type Predicate = XML.Predicate;
```

## Patterns

### Reading RSS Channel Data

```typescript
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse(xml);
if (isFailure(result)) throw result.error;

let channel = result.data.query("channel");
let items = result.data.queryAll("channel/item");
```

### Predicate-Based Traversal

```typescript
import { isFailure } from "@pkg/result";
import { XML } from "@pkg/xml";

let result = XML.parse(xml);
if (isFailure(result)) throw result.error;

let firstItem = result.data.find((element) => element.name === "item");
let allLinks = result.data.findAll((element) => element.name === "link");
```

### Preserving Namespaces During Serialization

```typescript
import { XML } from "@pkg/xml";

let result = XML.stringify({
	name: "rss",
	attributes: {
		version: "2.0",
		"xmlns:content": "http://purl.org/rss/1.0/modules/content/",
	},
	children: [{ name: "content:encoded", attributes: {}, children: ["<p>HTML</p>"] }],
});
```

## Related Packages

- [`@pkg/result`](/packages/result) - Result helpers used for parse and stringify failures.
- [`@pkg/rss`](/packages/rss) - RSS builder/parser package that can consume XML feed structures.

## Tips

1. Declare `xmlns:*` attributes on the same element tree where prefixed names are used, otherwise serialization fails.
2. Treat strings in `children` as text nodes; nested markup must be represented as child elements, not embedded raw XML.
3. The parser ignores indentation-only text nodes, which keeps RSS-style XML trees easier to traverse.
4. Element and attribute names are checked against the XML `Name` production before they are written, so serialization produces output that parses back into the tree it was given.
