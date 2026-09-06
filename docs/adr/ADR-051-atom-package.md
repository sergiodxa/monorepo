# ADR-051: Atom Feed Package

## Status

**Accepted** - 2026-09-06

## Background

`@sdxc/rss` reads RSS 2.0 and nothing else. Its parser requires an
`<rss version="2.0">` root and rejects any other document, which was never a
limitation while the repo only generated feeds.

A feed reader has to read whatever a person subscribes to. Atom 1.0 is not a marginal
format: GitHub release feeds, YouTube channel feeds, and a large share of blogs
publish Atom exclusively. A reader that cannot parse it does not fail gracefully on
those — it cannot follow them at all.

## Context

### Atom is a different format, not a dialect

The two share a purpose and almost no structure. The differences that reach the parser:

| Concern         | RSS 2.0                                   | Atom 1.0                                                   |
| --------------- | ----------------------------------------- | ---------------------------------------------------------- |
| Dates           | RFC 822 (`Tue, 14 Apr 2026 09:00:00 GMT`) | RFC 3339 (`2026-04-14T09:00:00Z`)                          |
| Item identity   | `<guid>`, optionally a permalink          | `<id>`, an IRI, always required                            |
| Item page       | `<link>`, one element, text content       | `<link rel="alternate" href="…">`, many, attribute-carried |
| Body            | `<description>` plus `content:encoded`    | `<content type="text                                       | html | xhtml">` |
| Required fields | channel title, description, link          | feed and entry each need `id`, `title`, `updated`          |
| Relative URIs   | not addressed                             | `xml:base`, inherited and composing down the tree          |

Normalizing Atom into `RSS.Channel`/`RSS.Item` on the way in would mean the parser
discards `rel`, `type` and content typing before any consumer can see them, and would
put lossy conversions inside a package named for the format it is not reading.

### What `@sdxc/xml` does and does not provide

It parses to an element tree and resolves character references. It performs **no
namespace resolution** — `element.name` is the raw qualified name, so `<a:feed>` and
`<feed>` are unrelated strings to it. Atom parsing therefore has to read the root's
`xmlns` declarations itself and match on local names.

Its serializer emits no XML declaration for a bare element, which is what an XHTML
content construct needs when it is re-serialized.

## Decision

Add `@sdxc/atom`: a first-party Atom 1.0 parser and builder, a sibling to `@sdxc/rss`
rather than an extension of it.

### Shape

One class merged with a namespace of types, mirroring `@sdxc/rss` and `@sdxc/xml`:

```ts
class Atom {
	constructor(feed: Atom.Feed);
	get feed(): Atom.Feed;
	get entries(): Atom.Entry[];
	addEntry(entry: Atom.Entry): void;
	removeEntry(id: string): void;
	toJSON(): Atom.Document;
	toString(): string;

	static fromXML(xml: XML): Result<Atom, AtomParseError>;
	static parse(source: string): Result<Atom, AtomParseError>;
	static fetch(input: URL | RequestInfo, init?: RequestInit): Promise<Result<Atom, AtomFetchError>>;
}
```

The internal layout mirrors `@sdxc/rss` — `lib/{constants,parse-feed,build-document,clone,utils,extensions,validate-*}.ts`
— plus three modules that exist because Atom needs them and RSS does not:
`lib/namespaces.ts`, `lib/xml-base.ts`, `lib/text-construct.ts`, `lib/content.ts`.

Vocabulary is RFC 4287's: `feed` and `entries`, not `channel` and `items`.

### The statics return a `Result`, unlike `@sdxc/rss`

`RSS.parse` and `RSS.fetch` throw. This package returns `Result`. That is a deliberate
divergence from its closest sibling, for two reasons: AGENTS.md requires `@sdxc/result`
over exceptions, and `@sdxc/xml` — the newer, closer precedent, and the layer directly
beneath this one — already returns `Result`. `@sdxc/rss` predates the rule and has no
callers of its parsing statics anywhere in the repo, so aligning it later is a
self-contained change rather than a prerequisite for this one.

### The parser is faithful, not helpful

`@sdxc/atom` records what the document says and applies no policy:

- **Every `<link>` is kept**, with its `rel`, `type` and `hreflang`. Choosing which one
  is "the" link is a consumer's decision, and different consumers choose differently.
- **Dates stay raw strings.** The same choice `@sdxc/rss` makes for `pubDate`, so a
  malformed date is visible to the consumer rather than silently becoming
  `Invalid Date` inside the parser.
- **Author fallback is not applied.** RFC 4287 lets an entry inherit an author from
  `<source>` or from the feed. The package reports the three positions; whoever
  normalizes decides the precedence.

The things it must handle, because they are structural rather than editorial:

- **`xml:base` accumulation.** Relative bases compose down the tree, so a `Scope`
  threads through every parse function and every `href`, `uri`, `src`, `icon` and
  `logo` resolves against it.
- **A prefixed root.** `<a:feed xmlns:a="http://www.w3.org/2005/Atom">` is valid Atom,
  and since the XML layer resolves no namespaces, matching is on local name after
  confirming the prefix binds to the Atom namespace.
- **`type="xhtml"` content**, which wraps its payload in exactly one `<div>` and whose
  value is the serialization of that div's _children_, not the div itself.

## Consequences

### Positive

- Atom feeds become readable, which is the point.
- `@sdxc/rss` is untouched. It keeps doing one format well, and the two packages read
  as one family without either depending on the other.
- Atom's attribute-carried link model survives parsing intact, so a consumer can pick
  an alternate link, a self link, or an enclosure from the same data.

### Negative

- A second XML-shaped parser to maintain. `packages/rss/src/lib/parse-feed.ts` is 577
  lines; this is comparable, and it is the largest single piece of the reader work.
- Two packages now express "a feed", and a consumer wanting both must handle both —
  which is precisely what [ADR-052](./ADR-052-feed-facade-package.md) exists to solve.
- The `Result`-returning statics differ from `@sdxc/rss`'s throwing ones, so the two
  siblings are not call-compatible until `@sdxc/rss` is aligned.

### Neutral

- XHTML round-tripping is out of scope for the first version: a construct parsed to a
  markup string re-serializes as `type="html"`. Documented in the README rather than
  worked around.

## Alternatives Considered

**Teach `@sdxc/rss` to parse Atom.** Fewer packages, and the name then lies about half
its job. It also forces a normalization decision inside the parser — Atom's typed
content and multi-link model have no home in `RSS.Item` — which loses information
before any consumer sees it.

**Use an existing Atom parser from npm.** The repo has a standing preference for
first-party format packages ([ADR-041](./ADR-041-in-package-xml-parsing-and-serialization.md),
[ADR-046](./ADR-046-first-party-frontmatter-parsing.md),
[ADR-047](./ADR-047-yaml-package-with-a-json-shaped-surface.md)), and every candidate
brings its own XML layer alongside the one already here.

**Convert Atom to the RSS shape at parse time.** Would let one type serve both, at the
cost of discarding `rel`, `type` and content typing in the parser. The normalization
belongs one layer up, where it is visible and revisable.

## References

- [RFC 4287, The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)
- [ADR-050](./ADR-050-html-named-entities-in-xml-parsing.md) — the entity fix this depends on
- [ADR-052](./ADR-052-feed-facade-package.md) — the façade that normalizes both formats
- [ADR-041](./ADR-041-in-package-xml-parsing-and-serialization.md) — first-party XML parsing
