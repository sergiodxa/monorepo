# ADR-050: HTML Named Entities in XML Parsing

## Status

**Accepted** - 2026-09-06

## Background

`@sdxc/xml` was written to serve `@sdxc/rss`, and `@sdxc/rss` has so far only ever
_built_ feeds — `apps/blog` and `@sdxc/blog-engine` construct a document and serialize
it. Nothing in the repo parsed a feed it did not write.

Building a feed reader inverts that. The parser now meets documents authored by every
publishing tool on the web, and the first thing they do is emit `&nbsp;`, `&mdash;`
and `&hellip;` in prose without declaring a DTD. Under the current rules each of those
fails the entire document, so a large share of real subscriptions would be unfollowable
for a reason the reader could do nothing about.

## Context

### What the decoder resolves today

`packages/xml/src/lib/decode-entities.ts` resolves exactly two things: the five
entities XML predefines (`lt`, `gt`, `amp`, `quot`, `apos`) and numeric character
references in decimal or hexadecimal. Anything else returns
`entity not found:&<name>;`.

That is correct by the letter of the XML specification. A named entity is declared by
a DTD, this parser reads no DTD, so an undeclared name genuinely has no defined
expansion and refusing to guess is the honest answer.

### Why the failure is total rather than local

`decodeEntities` returns a `Result`, and `parse-document.ts` propagates the first
failure out of the whole parse. One `&nbsp;` inside one `<description>` in one item
fails the feed. There is no partial success and no per-node recovery, which is the
right design for a parser and the wrong outcome for this input.

### Where the entities actually come from

WordPress, Ghost, Substack and most static-site generators emit HTML-flavoured text
into `<description>` and `<content:encoded>`. Their authors are writing HTML, where
these names are predeclared, and the feed template escapes nothing further. The
entities are not a defect in those feeds; they are what the surrounding ecosystem
treats as normal.

## Decision

Resolve the named entities declared by the three XHTML 1.0 entity sets —
`xhtml-lat1`, `xhtml-special` and `xhtml-symbol` — in addition to the five XML
predefines and numeric references.

The table lives in `packages/xml/src/lib/html-entities.ts` as one
`Record<string, string>`, and `resolveReference` consults it after the predefines and
before reporting a failure. An entity outside those sets still fails, with the message
unchanged.

### Why these three sets and not HTML5's full table

The XHTML sets are 252 entries covering the Latin-1 supplement, typographic
punctuation, Greek, arrows and mathematical operators. That is everything prose in a
feed uses. HTML5's table adds roughly two thousand more — largely mathematical
alphanumerics — plus every legacy semicolon-less form, and it would ship in the bundle
of every Worker that touches this package to serve input none of them receive.

The three sets are also a fixed, named, citable standard rather than a judgement call
about which entities are common enough, which means the table has a defined edge
instead of one that grows whenever someone hits a miss.

### Why unconditional rather than an option

An option would preserve strict XML behaviour for a caller who wants it. No caller
wants it: the package exists to read feeds, its own README describes it as covering
"the subset of XML commonly used by RSS and similar feeds", and a second mode would
be a permanent branch through the decoder serving nobody.

## Consequences

### Positive

- Feeds carrying HTML-flavoured prose parse instead of failing wholesale, which is the
  difference between a reader that works on the open web and one that works on feeds
  written by this repo.
- The failure message is now genuinely informative. Previously `entity not found` fired
  constantly on well-formed, widely-accepted documents; now it fires on something
  actually unusual.

### Negative

- The package is further from strict XML. A document that references an entity it
  never declared is accepted where the specification permits refusal. This is a
  deliberate trade for a feed-oriented parser and is stated in the README.
- 252 entries ship to every consumer, including the two apps that only serialize feeds
  and will never decode one.

### Neutral

- Serialization is untouched. `stringify` escapes only the five predefines, so a
  document that arrives carrying `&nbsp;` round-trips as the literal character rather
  than the name — correct, well-formed output, not byte-identical input.

## Alternatives Considered

**Recover per node instead of failing the document.** Leave an unresolvable reference
as literal text and let the parse continue. It would make feeds parse, but it turns
every genuine encoding fault into silently corrupted text, and it does not actually
decode `&nbsp;` — it just stops complaining about it. The reader would render the raw
entity to the person reading.

**Decode in `@sdxc/rss` or the reader app instead.** Pre-process the source before
`XML.parse` sees it. Wrong layer twice over: entity resolution is the parser's job,
and a regex pass over raw XML cannot tell a reference inside a text node from one
inside a CDATA section, where it must stay literal.

**Ship HTML5's full named-entity table.** Complete, and ~100 KB of table in every
Worker bundle to resolve entities that do not appear in feed prose.

## References

- [XML 1.0 §4.6, Predefined Entities](https://www.w3.org/TR/xml/#sec-predefined-ent)
- [XHTML 1.0 Character Entity References](https://www.w3.org/TR/xhtml1/dtds.html#h-A2)
- [ADR-041](./ADR-041-in-package-xml-parsing-and-serialization.md) — why XML parsing lives in this repo
- [ADR-051](./ADR-051-atom-package.md) — the Atom parser this unblocks
- [ADR-052](./ADR-052-feed-facade-package.md) — the façade both format packages sit behind
