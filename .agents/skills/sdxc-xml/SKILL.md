---
name: sdxc-xml
description: "@sdxc/xml parses XML text into an `XML` document instance and serializes it back, targeting the subset feeds use: one root, attributes, nested elements, text and CDATA, namespace-prefixed names, and a declaration. Use when reading an RSS or Atom document, traversing it with `query`/`queryAll`/`find`/`findAll`, building XML output with `XML.stringify`, or when a real-world feed emits `&nbsp;` and `&mdash;` with no DTD."
---

# @sdxc/xml

`XML.parse` reads XML text into an `XML` instance and `XML.stringify` writes a document or a bare root element back out, both as a `Result` from `@sdxc/result`. Traversal is four methods: `query`/`queryAll` take a `/`-delimited path rooted at the root element, `find`/`findAll` take a predicate and walk depth-first. Entity handling is built for feeds in the wild — the five XML predefines, numeric character references, and the 248 named entities the XHTML 1.0 entity sets declare — and whitespace-only text nodes are dropped as indentation. It has no runtime dependency beyond `@sdxc/result` and runs anywhere.

Full API, options and examples: [packages/xml/README.md](packages/xml/README.md)

## When to reach for it

- A feed document has to be read and its channel, items or links pulled out.
- XML output has to be produced from plain data, with or without a declaration.
- A parse failure should be a value you inspect rather than an exception — malformed source, no root element, or an entity outside the resolved sets.
- A document has to round-trip: parsed, edited as plain data, and written back.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/xml": "workspace:*" } }
```

```ts
import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";

let result = XML.parse(source);
if (isFailure(result)) throw result.error;

let xml = result.data;

let channel = xml.query("channel");
let items = xml.queryAll("channel/item");
let allLinks = xml.findAll((element) => element.name === "link");
```

Writing a document:

```ts
let result = XML.stringify({
	declaration: { version: "1.0", encoding: "UTF-8" },
	root: { name: "rss", attributes: { version: "2.0" } },
});
```

## Suggestions

- `XML.stringify` takes either a whole `XML.Document` or a bare root `XML.Element`; a declaration belongs to a document, so pass the document (or the instance) when you want one written.
- `toString()` is the one entry point that throws `XMLStringifyError` instead of returning it, because it has no room for a `Result` — reach for `XML.stringify` wherever a failure is a value you want to handle.
- An `XML.Node` is an element or a string, and a string is always a text node: markup inside a string is escaped, which is what makes output parse back into the tree it was given. Put markup in child elements.
- Serialization escapes only the five predefined entities, so a document that arrived carrying `&nbsp;` round-trips as the character itself rather than the entity.
- Every public type lives in the `XML` namespace — `XML.Declaration`, `XML.Element`, `XML.Node`, `XML.Document`, `XML.Input`, `XML.Predicate` — imported as `import type { XML } from "@sdxc/xml"`.

## Related

- `@sdxc/result` — the `Result` parse and stringify return; skill `sdxc-result`
- `@sdxc/rss` — reads and writes RSS documents on top of this parser; skill `sdxc-rss`
- `@sdxc/atom` — the same for Atom documents; skill `sdxc-atom`
