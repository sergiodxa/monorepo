# ADR-052: Feed Façade Package

## Status

**Accepted** - 2026-09-06

## Background

With [ADR-051](./ADR-051-atom-package.md) the repo has two feed parsers, `@sdxc/rss`
and `@sdxc/atom`, each faithful to its own format. A feed reader does not want two
formats. It is handed a URL by a person who neither knows nor cares which one is
behind it, and it needs a title, a link, and a list of posts.

Something has to sniff the format, normalize the two shapes into one, and do the
things that are about _fetching a feed_ rather than about either format —
conditional requests and autodiscovery.

## Context

### Neither format package can own the fetching concerns

**Conditional requests.** A reader polls every followed feed on a schedule. Without
`If-None-Match` / `If-Modified-Since` that is a full download and full parse of every
feed on every tick, forever. The existing `RSS.fetch` actively prevents this: it sets
`cache-control: no-cache, no-store`, which is exactly the header that defeats a
conditional request, and it discards the `Response`, so `ETag` and `Last-Modified`
are unreachable to the caller. It also throws unless `response.ok`, and a `304` is not
`ok`, and it rejects any `content-type` without `xml` in it, which real feeds fail.

**Autodiscovery.** A person pastes `sergiodxa.com`, not `sergiodxa.com/rss`. Finding
the feed means reading `<link rel="alternate">` out of an HTML document, and matching
_both_ `application/rss+xml` and `application/atom+xml`. Neither format package can
own a capability that is half about the other one.

### Sniffing cannot use `Content-Type`

Feeds are served as `text/xml`, `application/xml`, `text/html`,
`application/octet-stream` and worse. The header is not evidence. The root element is.

### The HTML scanner cannot use `XML.parse`

A void `<link>` in an HTML document is unclosed, which fails the XML parser outright,
and any HTML page is likely to carry entities and constructs XML rejects. Discovery
needs its own small scanner.

## Decision

Add `@sdxc/feed`: a thin façade over `@sdxc/rss` and `@sdxc/atom` that is the only
feed API a consuming app sees.

### Surface

```ts
class Feed {
	get format(): Feed.Format; // "rss" | "atom"
	get title(): string;
	get siteUrl(): string | undefined;
	get feedUrl(): string | undefined;
	get items(): Feed.Item[];
	toJSON(): Feed.Data;

	static fromXML(
		xml: XML,
		options?: Feed.ParseOptions,
	): Result<Feed, FeedParseError | FeedFormatError>;
	static parse(
		source: string,
		options?: Feed.ParseOptions,
	): Result<Feed, FeedParseError | FeedFormatError>;
	static fetch(
		input: string | URL,
		options?: Feed.FetchOptions,
	): Promise<Result<Feed.FetchResult, FeedFetchError>>;
	static discover(
		input: string | URL,
		options?: Feed.FetchOptions,
	): Promise<Result<Feed.Discovery[], FeedFetchError>>;
}
```

Normalized into one shape:
`{ format, title, description?, siteUrl?, feedUrl?, language?, imageUrl?, updatedAt?, items }`,
with items carrying
`{ guid, title?, url?, summary?, contentHtml?, author?, categories?, enclosures?, publishedAt?, updatedAt? }`.

### It depends on both parsers rather than re-implementing

`RSS.fromXML(xml)` is already the parse-from-an-already-parsed-document seam, so the
façade runs `XML.parse` **once** and hands the instance to whichever backend the sniff
picked. There is no double parsing and, importantly, **no change is needed inside
`@sdxc/rss`** — its throwing statics and forced cache headers are simply never reached.
`from-rss.ts` absorbs the throw with `wrap()`.

Re-implementing RSS parsing here would fork 577 lines and its test suite, and leave two
RSS parsers in one repo to drift apart.

### Sniffing is structural

`rss` root → RSS. `feed` root bound to the Atom namespace → Atom. `RDF` root → a
`FeedFormatError` naming RSS 1.0 as unsupported, rather than a confusing parse failure.
Anything else → an error naming the root element it actually found.

### Dates are `Date`, not strings or epoch numbers

Both parsers keep dates as raw strings, faithful to their formats. The façade is where
that stops being useful: a consumer sorts and formats. `Date` survives structured clone
across a Workers RPC boundary and `@sdxc/dates` formatters take it directly.

### `fetch` returns a union discriminated on `notModified`

```ts
type FetchResult =
	| {
			notModified: false;
			feed: Feed;
			url: string;
			status: number;
			etag?: string;
			lastModified?: string;
	  }
	| {
			notModified: true;
			feed: undefined;
			url: string;
			status: 304;
			etag?: string;
			lastModified?: string;
	  };
```

so a 304 narrows `feed` away and a 200 narrows it to defined, rather than handing back
an optional the caller has to remember to check. A 304 legitimately omits validators,
so the caller's own are carried forward on that branch. Relative links resolve against
`response.url`, which is the post-redirect URL.

### `discover` fetches once

It tries to sniff the body as a feed first — which is the "someone pasted a feed URL
directly" path, resolved with no second request — and only scans for `<link>` elements
when that fails. Discovered hrefs resolve against `<base href>` when present, otherwise
the response URL, and document order is preserved because the first alternate link is
conventionally the site's main feed.

Only `application/rss+xml` and `application/atom+xml` qualify. `text/xml` and
`application/xml` are deliberately excluded: they produce false positives on sitemaps
and stylesheets.

## Consequences

### Positive

- A consuming app imports one package, handles one shape, and never learns which
  format it received.
- Conditional polling is available to every consumer, so a reader's hourly refresh
  costs a 304 per unchanged feed instead of a download and a parse.
- Normalization is in one reviewable place. The mapping table is the contract, and
  changing how an author or a link is chosen is one edit, not two.
- Both format packages stay faithful to their specs, because none of the lossy
  decisions happen inside them.

### Negative

- A fourth package in the chain (`xml` → `rss`/`atom` → `feed` → app), so a change that
  spans layers is several commits under this repo's one-workspace-per-commit rule.
- The normalized shape is lossy by design. A consumer needing `slash:comments` or an
  Atom extension element has to reach past the façade to the format package.
- `@sdxc/feed` stays `private` until every package beneath it is public, since the
  repo's publish check refuses a public package with private dependencies. That costs
  nothing today, as all four are private.

### Neutral

- HTML sanitization is explicitly **not** done here. `contentHtml` is passed through as
  the publisher wrote it, and escaping is the rendering consumer's job. Stated in the
  README so it cannot be assumed either way.

## Alternatives Considered

**Put normalization in the reader app.** No new package, and the next consumer of a
feed rewrites it. Sniffing, conditional fetch and autodiscovery are not
application logic; they are what "read a feed from a URL" means.

**Make `@sdxc/rss` the façade.** It already parses one format and is already a
dependency of the blog. It would then own Atom sniffing and normalization under a name
that promises RSS, and every consumer that only builds feeds would carry the Atom
parser.

**Skip the façade; let the app branch on format.** Two shapes through every controller,
view and database write, and the branch reappears at each one.

## References

- [ADR-050](./ADR-050-html-named-entities-in-xml-parsing.md) — the entity fix beneath this
- [ADR-051](./ADR-051-atom-package.md) — the Atom parser this normalizes
- [RSS Autodiscovery](https://www.rssboard.org/rss-autodiscovery) — vendored at `packages/rss/spec/rss-autodiscovery.md`
- [ADR-022](./ADR-022-http-cache-policies-and-conditional-responses.md) — the server-side counterpart to conditional requests
