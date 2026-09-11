# ADR-056: Sitemap Parsing

## Status

**Accepted** - 2026-09-11

## Background

`@sdxc/sitemap` writes the sitemap protocol. A caller appends absolute URLs with
optional crawler metadata and serializes a `<urlset>` document, and every consumer in
the repo uses it that way: a controller collects routes and returns XML.

Reading a sitemap has no home. Something that wants the list of pages a site
publishes — a crawler, an availability check that walks a site, an audit that compares
the sitemap against the pages that actually answer — gets an element tree from
`@sdxc/xml` and then rediscovers the protocol for itself: which root elements count,
that `<loc>` holds an absolute URL, that `<lastmod>` is a W3C Datetime rather than an
RFC 3339 timestamp, that `<priority>` is a number in a closed range.

A published sitemap is the cheapest inventory of a site there is. It is one request,
it is maintained by the site's own author, and it carries the modification dates that
say which of those pages are worth looking at again. Getting at it should cost a parse,
not a parser.

## Context

### The package already owns the protocol, in one direction

`<urlset>`, `<url>`, `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>` — the
vocabulary of reading a sitemap is the vocabulary this package already writes, plus the
two element names an index document adds. The value rules are the same rules in the
other direction: `append` takes a `URL` because `<loc>` is absolute, and a `Frequency`
type already spells out the `<changefreq>` enum.

The repo pairs parse with stringify inside a format's own package. `@sdxc/xml`,
`@sdxc/yaml` and `@sdxc/rss` each read and write their format, and a consumer of any of
them imports one name to go in either direction.

### Nothing else can host it

`@sdxc/xml` knows elements, attributes and text. The protocol's semantics are a layer
above that: which root elements are sitemaps at all, that an entry is identified by an
absolute URL, that a `<priority>` of `7` is outside the format. Teaching the XML package
any of it would put one protocol's rules inside a package named for the syntax every
protocol shares.

### A sitemap is two document types

The protocol defines `<urlset>`, listing pages, and `<sitemapindex>`, listing other
sitemaps. A `<sitemap>` child of an index carries exactly `<loc>` and `<lastmod>`, which
is a subset of the fields `Sitemap.Entry` already has. Both documents share the
namespace, the child element names, and the datetime format.

### A served sitemap is not reliably labelled

Sitemaps arrive as `application/xml`, as `text/xml`, and as `text/plain`. They also
arrive as an HTML error page under a `200`, from a host that answers every unknown path
with its own not-found template. The `Content-Type` header separates none of those
cases. The root element separates all of them.

## Decision

Two new static entry points on the existing `Sitemap` class, so the package reads the
format it already writes.

### Shape

```ts
class Sitemap {
	get kind(): Sitemap.Kind; // "urlset" | "index"
	get entries(): Set<Sitemap.Entry>;
	get size(): number;

	append(loc: URL, options?: Sitemap.AppendOptions): void;
	toString(): string;

	static parse(xml: XML): Result<Sitemap, SitemapParseError>;
	static fetch(
		input: URL | RequestInfo,
		init?: RequestInit,
	): Promise<Result<Sitemap, SitemapFetchError | SitemapParseError | XMLParseError>>;
}
```

Retrieval and parsing answer with the same instance the builder produces, so one type
covers both directions:

```ts
let result = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(result)) throw result.error;

let sitemap = result.data;

sitemap.kind; // "urlset"
sitemap.size; // 128

for (let entry of sitemap.entries) {
	entry.loc; // URL
	entry.updatedAt; // Date | undefined
	entry.frequency; // Sitemap.Frequency | undefined
	entry.priority; // number | undefined
}
```

A caller that already holds the document — a body read for another reason, a fixture
on disk — goes through `parse` directly:

```ts
let xml = XML.parse(source);
if (isFailure(xml)) throw xml.error;

let sitemap = Sitemap.parse(xml.data);
```

### `parse` takes a document rather than a source string

`Sitemap.fetch` is the only path in this package that starts from text, and it does the
text-to-document step itself. A caller who starts from text outside that path writes
`XML.parse(text)` and then `Sitemap.parse(xml)`: two lines that each say what they do,
and an `XMLParseError` that arrives from the layer that produced it.

This diverges from `@sdxc/feed`, which reserves `parse` for a source string and names
its document-taking entry point `fromXML`. That shape earns its two names there,
because the façade sniffs a format out of text it is handed from several directions.
Here the choice is between one parse entry point and two spellings of the same idea in
a package whose only text path is its own `fetch`, so the name goes to the form callers
reach for and the other form is a `XML.parse` call the caller can see.

### One class, one entry type, and a discriminator for the document type

Both document types produce a `Sitemap`. A `<sitemap>` row carries a subset of
`Sitemap.Entry`'s fields, so one entry type describes rows of either document, and the
instance carries a `kind` of `"urlset" | "index"` saying how to read the entries it
holds. `toString()` serializes the document type the instance carries, so a parsed index
round-trips to an index and a constructed sitemap stays a `<urlset>` — `new Sitemap()`
is a `urlset`, and `append` behaves exactly as it does now.

Two classes is the other way to say this, and it says it worse. `SitemapIndex` would
copy `append`, `size`, `entries` and most of `toString()` over an entry type that is
already shared, and a caller of `fetch` would branch on which class came back before it
could read a single entry — the same discriminator, moved from a field into the type
system, paid for with a second class and a union return. The field is the smaller thing
that does the whole job.

### Parsing rules the package owns

These are the package's semantics rather than a caller's convention, so every consumer
gets the same answers.

1. **The root element decides whether a sitemap arrived.** A root of `<urlset>` or
   `<sitemapindex>` sets `kind`; any other root is a `SitemapParseError` naming the root
   it found. This is also the package's content check: an HTML error page served in a
   sitemap's place fails here, with a message saying the root was `html`.
2. **An entry needs a `<loc>` that parses as an absolute URL.** An entry without one is
   skipped and the rest of the document is kept, because one malformed row costs a
   caller the other 49,999 otherwise. The count of skipped rows stays off the instance:
   it is state that means something only for a parsed document, that `toString()` never
   serializes, and that a caller can act on only by guessing at what the row was. A
   caller who needs to audit the source has the source.
3. **An unparseable `<lastmod>` leaves `updatedAt` undefined** and keeps the entry,
   since the URL is the part a consumer came for. `<lastmod>` is W3C Datetime, so a date
   alone (`2026-09-11`) and a full timestamp (`2026-09-11T14:32:00+02:00`) both parse.
4. **A `<changefreq>` outside the protocol's enum is ignored**, leaving `frequency`
   undefined, which keeps the field's type equal to the one `append` accepts.
5. **A `<priority>` outside 0.0–1.0 is ignored**, leaving `priority` undefined, so a
   consumer that sorts or weights by it reads either a number the protocol allows or
   nothing.
6. **Extension namespaces are dropped.** `image:`, `video:` and `news:` children, and
   `xhtml:link` alternates, have no vocabulary in `Sitemap.Entry`, so the read is lossy
   by design in the way `@sdxc/feed`'s normalized shape is: a consumer that wants image
   or hreflang metadata parses the document with `@sdxc/xml` and reads those elements
   itself.

### Retrieval belongs in the package

Every caller opens the same way — request the URL, read the text, parse it, check that
what came back is a sitemap — and the interesting part is the last step. `Sitemap.fetch`
takes what `fetch` takes, calls the global `fetch` directly, and reports a rejected
request or an error status as a `SitemapFetchError` naming what came back. There is no
injectable fetch parameter and no configuration object wrapping one, so tests intercept
these calls with MSW like any other outbound call, which is the rule `@sdxc/api-client`
states for the same reason.

The body is parsed whenever the response is `ok`, and the `Content-Type` header plays no
part in the decision. Sitemaps are served under several types in the wild, and the
root-element rule is the check that actually answers whether a sitemap arrived.

### Out of scope

**Following an index to its children.** `Sitemap.fetch` retrieves exactly one document.
A caller that wants the children of an index loops over its entries, because how many to
fetch and how fast is the consumer's budget to spend.

**A gzipped sitemap.** `fetch` transparently decodes `Content-Encoding`, so a sitemap
served compressed over the wire already works. A `.xml.gz` file served as
`application/gzip` is a different thing: it is a gzip member in the body, and reading it
is a `DecompressionStream("gzip")` over the response body before the text is parsed. A
later release adds it inside `fetch`, and a caller who needs it today decompresses and
calls `Sitemap.parse`.

**The protocol's 50,000-URL and 50MB limits.** They bound what a publisher should emit,
and a reader that enforces them rejects documents search engines accept. A caller that
needs a cap slices the entries it got.

## Consequences

### Positive

- The protocol is readable by the package that writes it, so one import covers both
  directions and the element names and value rules have one implementation.
- A caller holds either the entries or the reason the document is not a sitemap, and
  reaches the entries with the `Set<Sitemap.Entry>` the builder already exposes.
- The root-element rule turns the common failure — a not-found template, a login page,
  a JSON error — into a message that names the root that arrived, rather than an empty
  entry set a caller has to explain.
- An index round-trips, so a consumer that reads one, filters it and re-serializes gets
  a `<sitemapindex>` back.

### Negative

- The package takes on `@sdxc/result`, where `@sdxc/xml` is its only dependency today.
- A `.xml.gz` sitemap needs the caller's own decompression until `fetch` grows it, and
  large sites publish exactly that.
- The read is lossy: an entry's `image:`, `video:`, `news:` and `xhtml:link` children
  are gone by the time a consumer sees the entry.
- `parse` taking a document here and a source string in `@sdxc/feed` is a difference a
  reader of both packages has to learn, and the compiler is what teaches it.

### Neutral

- A parsed instance is the same mutable `Sitemap` a caller constructs, so `append` after
  `parse` adds a row to whichever document type the instance carries.

## Alternatives Considered

**`fromXML` plus `parse(source)`, matching `@sdxc/feed`.** Two entry points where the
package needs one, with `parse` differing from the sibling's `parse` in nothing but the
argument it takes. It would also put a `XMLParseError` inside a `SitemapParseError` on
the text path, hiding which layer rejected the document.

**Conditional requests.** `@sdxc/feed` owns an ETag and Last-Modified shape whose
`FetchResult` union discriminates on `notModified`, and it is the right shape for a
consumer that polls. This package copies it when a consumer actually stores validators
between runs — a crawler that revisits the same sitemaps on a schedule is the trigger —
because the shape is worth having only once something on the other side keeps the
`ETag` it was given.

**Parse inside `@sdxc/xml`.** It already has the tree, the finders and the path queries,
and a `sitemap` module there would need no new package. It would also make one package
the home of one protocol's value rules while every other protocol keeps its own, and the
sitemap rules would sit a directory away from the serializer that emits them.

**A separate `@sdxc/sitemap-parser` package.** Keeps `@sdxc/sitemap` free of
`@sdxc/result`, and splits one protocol across two workspaces whose entry types have to
stay identical by hand. The format-package precedents keep both directions together.

## References

- [Sitemaps XML protocol](https://www.sitemaps.org/protocol.html) — the element names,
  the two root elements, the `<changefreq>` enum and the `<priority>` range.
- [W3C Datetime](https://www.w3.org/TR/NOTE-datetime) — the `<lastmod>` format, where a
  date alone and a full timestamp are both valid.
- [ADR-055](./ADR-055-html-package.md) — the format package that also owns retrieval,
  and the rules-the-package-owns shape this follows.
- [ADR-052](./ADR-052-feed-facade-package.md) — the `fromXML` / `parse` / `fetch` idiom
  and the normalized-shape-is-lossy precedent.
- [ADR-051](./ADR-051-atom-package.md) — the `Result`-returning statics and the
  error-class naming.
- [ADR-041](./ADR-041-in-package-xml-parsing-and-serialization.md) — parse and stringify
  living in the format's own package.
