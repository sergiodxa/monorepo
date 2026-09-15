---
name: sdxc-atom
description: "@sdxc/atom is an Atom 1.0 (RFC 4287) feed parser and builder: `Atom.parse`, `Atom.fetch` and `Atom.fromXML` read a document into an `Atom` instance, and `new Atom(feed)` plus `addEntry` serializes one back out. Use when reading someone else's Atom feed, when building an `application/atom+xml` document to serve, or when feed entries need their raw links, dates, authors and foreign-namespace extensions preserved rather than normalized."
---

# @sdxc/atom

Reads RFC 4287 documents into an `Atom` instance and serializes that instance back into XML. It is a faithful reader rather than a helpful one: every link keeps its relation, dates stay the text the source held, and an entry that omits an author is reported as omitting one, so a reader and an archiver both get the complete picture and pick from it. Elements outside the Atom namespace survive a read and a write through `extensions`. The statics report failures as a `Result` from `@sdxc/result` instead of throwing, and it runs on any runtime with `fetch`.

Full API, options and examples: [packages/atom/README.md](packages/atom/README.md)

## When to reach for it

- Consuming an external Atom feed and needing the entry ids, `updated` timestamps and alternate links as the publisher wrote them.
- Serving an Atom feed built from your own records, with self and alternate links and per-entry content.
- A feed carries a foreign module (media, Dublin Core, anything namespaced) that has to round-trip unchanged.
- A malformed feed should surface as a value to branch on rather than an exception in the middle of a request.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/atom": "workspace:*" } }
```

```ts
import { Atom } from "@sdxc/atom";
import { isFailure } from "@sdxc/result";

let result = Atom.parse(xml, "https://example.com/feed.xml");
if (isFailure(result)) throw result.error;

let atom = result.data;
for (let entry of atom.entries) console.log(entry.id, entry.updated);
```

## Suggestions

- Pass the document's own URL as the second argument to `parse`, so relative `href`, `uri`, `src`, `icon` and `logo` references resolve; `Atom.fetch` does this against the URL the response finally came from, so a redirected feed still yields absolute links.
- Nothing is normalized for you: an absent `rel` is left absent rather than defaulted to `alternate`, `updated`/`published` stay raw RFC 3339 strings, and an entry's author does not inherit from `source` or the feed — apply `entry.author ?? entry.source?.author ?? atom.feed.author` yourself.
- `new Atom()` and `addEntry` throw `AtomParseError` when `id`, `title` or `updated` is missing, which RFC 4287 requires.
- Text constructs are never sanitized: an `html` or `xhtml` value holds whatever the publisher wrote, and escaping belongs to whatever renders it.

## Related

- `@sdxc/xml` — the document type `Atom.fromXML` takes; skill `sdxc-xml`
- `@sdxc/result` — every static answers with its `Result`; skill `sdxc-result`
- `@sdxc/rss` — the same job for RSS documents; skill `sdxc-rss`
