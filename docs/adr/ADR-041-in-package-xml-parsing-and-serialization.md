# ADR-041: In-Package XML Parsing and Serialization

## Status

**Implemented** - 2026-09-02

## Background

`@pkg/xml` parses XML into a document tree and serializes that tree back into text.
It is the layer `@pkg/rss` and `@pkg/sitemap` build on, which puts it in the deployed
`blog` and `uptime` Workers.

It was written against `DOMParser` and `XMLSerializer`, with `@xmldom/xmldom` behind a
`typeof DOMParser !== "undefined"` guard. The README described that guard as a runtime
choice: the host APIs on workerd, the library in Bun tests.

A dependency review asked whether the library was still needed on Cloudflare Workers.
Answering it required running the check rather than reading it.

## Context

Probing workerd 1.20260828.1 with `nodejs_compat` enabled, through the repository's own
`packages-workers` Vitest project, reports `DOMParser` and `XMLSerializer` as
`undefined`. Bun 1.3.14 and Node 24 report the same. `@cloudflare/workers-types` carries
no mention of either name.

The guard therefore never took its first branch in any runtime this repository runs on.
`@xmldom/xmldom` was the parser and the serializer everywhere, production included, and
the README stated the opposite.

Three further facts shaped what to do about it:

1. The serializer already resolved namespace prefixes by hand. It built a DOM solely to
   hand it to `XMLSerializer`, and seeded that DOM by parsing `<rootName/>` to reach a
   `DOMImplementation`.
2. Either export pulls the whole library: importing `DOMParser` alone bundles 87 KB
   minified, 30 KB gzipped, the same as importing both. Replacing one side saves nothing.
3. `HTMLRewriter`, the XML-adjacent API workerd does provide, lowercases tag names —
   `lastBuildDate` arrives as `lastbuilddate` — which RSS cannot survive.

Recording the library's behavior across 48 inputs — entities, CDATA, comments, doctypes
with internal subsets, namespace scoping, attribute whitespace normalization, and
malformed documents — showed the surface actually in use is small, and that four of its
outcomes were defects rather than contract:

- An invalid root element name threw out of a function whose signature returns a
  `Result`.
- Invalid child element and attribute names were written out unvalidated, producing
  malformed XML such as `<1bad/>`.
- Named entities from HTML, `&nbsp;` among them, already failed to parse.

## Decision

`@pkg/xml` parses and serializes in its own code. `@xmldom/xmldom` is removed, and the
package depends only on `@pkg/result`.

Parsing is a single pass over the source, building the tree on a stack of open elements.
Serialization emits markup directly, keeping the namespace scope the previous
implementation already tracked and using it to check prefixes.

Three modules carry the parts both sides need: `xml-names.ts` for the XML `Name`
production, `escape-xml.ts` for text and attribute escaping, and `decode-entities.ts`
for entity and character references.

The replacement reproduces the recorded behavior for all 48 inputs byte-for-byte,
error messages included, with three deliberate departures:

1. An invalid root element name returns a failure.
2. An invalid child element or attribute name returns a failure, where malformed output
   was written before.
3. A second root element reports `Extra content at the end of the document`.

Entity support is the five entities XML predefines plus numeric character references.
A named entity from HTML is a parse error, which is what the previous implementation did
and is now stated in the README as a contract rather than left to be discovered.

## Consequences

### Positive

- The package behaves identically in every runtime, because one implementation serves
  all of them.
- 87 KB minified, 30 KB gzipped, leaves every Worker that ships `@pkg/rss` or
  `@pkg/sitemap`.
- Four paths that produced a throw or malformed output now return a failure, so the
  `Result` signature describes what the functions do.
- The behavior is pinned by tests rather than by a dependency: the package went from 37
  to 95 tests, plus a workerd test and a test over a captured production feed of 646
  items.

### Negative

- Parsing and serialization are now this repository's to maintain. The 48 recorded cases
  and the production feed are the guard against that cost arriving as a surprise.
- A feed that reaches for an HTML named entity fails to parse. Supporting the full set
  needs the entity table, roughly 44 KB, which is most of what removing the library saved.

### Neutral

- `XML.Input` remains exported and unused; `XML.stringify` accepts `XML | XML.Element`,
  and the README now says so.

## Alternatives Considered

**Keep `@xmldom/xmldom` and correct only the documentation.** Honest, and it leaves a
full W3C DOM implementation serving a package that uses a tag name, an attribute map and
a child list. The guard it sits behind would stay dead either way.

**Replace only the serializer.** The namespace logic was already hand-written, so this
was the cheap half. It removes nothing from the bundle, because the parser still pulls
the whole library.

**Parse with `HTMLRewriter`.** Available on workerd and needs no dependency, but it
lowercases tag names, streams rather than building a tree, and has no serializer.

**Support HTML named entities while replacing the library.** Real feeds do carry
`&nbsp;`. A curated subset is arbitrary and silently incomplete, and the full table costs
most of the size being recovered. Keeping the previous strict behavior leaves the choice
open and visible.

## References

- [`@pkg/xml` README](/packages/xml/README.md) - the parsing and serialization contract
- [ADR-035](./ADR-035-vite-plus-as-the-single-toolchain.md) - the `packages-workers`
  Vitest project the runtime probe ran in
