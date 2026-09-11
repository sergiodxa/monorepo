# @sdxc/sitemap

Read and write the sitemap protocol: collect URLs into a document, or fetch a published
sitemap and read the pages it lists.

Writing one is the well-known half — a handler gathers its routes and serves
`<urlset>` XML for a crawler. Reading one is the half that usually has no home, and it is
the more useful of the two: a published sitemap is the cheapest inventory of a site there
is. It is one request, it is maintained by the site's own author, and it carries the
modification dates that say which of those pages are worth looking at again.

Both directions answer with the same class, so the element names and the value rules have
one implementation. What `append` accepts is what an entry reports back, and a document
that is read, filtered and re-serialized comes out as the document type it went in as.

## Installation

```bash
npm add @sdxc/sitemap
```

Parsing and retrieval report their outcome as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure`
and `isSuccess` come from. `Sitemap.parse` takes a document from
[`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml). Both install alongside this
package.

## Usage

### Build A Sitemap

```typescript
import { Sitemap } from "@sdxc/sitemap";

let sitemap = new Sitemap();

sitemap.append(new URL("https://example.com/"), { priority: 1, frequency: "weekly" });
sitemap.append(new URL("https://example.com/about"), { priority: 0.5, frequency: "yearly" });
sitemap.append(new URL("https://example.com/blog/hello"), { updatedAt: new Date("2026-09-11") });

sitemap.toString();
// <?xml version="1.0" encoding="UTF-8"?>
// <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">…</urlset>
```

`updatedAt` is written as `<lastmod>` and `frequency` as `<changefreq>`, the element names
the protocol expects.

### Read A Published Sitemap

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

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

`Sitemap.fetch` reads the body whenever the response is `ok`, and `Content-Type` plays no
part in the decision: sitemaps arrive as `application/xml`, as `text/xml` and as
`text/plain`. The root element is the check that answers whether one arrived.

### Parse A Document You Already Hold

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";
import { XML } from "@sdxc/xml";

let xml = XML.parse(source);
if (isFailure(xml)) throw xml.error;

let sitemap = Sitemap.parse(xml.data);
```

Two steps that each say what they do, and an `XMLParseError` that arrives from the layer
that produced it.

### Walk An Index

A large site splits into one sitemap per section and lists them in a `<sitemapindex>`. That
document reads into the same class, under a `kind` of `"index"`:

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let index = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(index)) throw index.error;

if (index.data.kind === "index") {
	for (let entry of index.data.entries) {
		let section = await Sitemap.fetch(entry.loc);
		if (isFailure(section)) continue;
		// every entry of section.data is a page
	}
}
```

One call retrieves one document, so how many children to fetch and how fast stays yours to
decide.

## Parsing Rules

**The root element decides whether a sitemap arrived.** A root of `<urlset>` or
`<sitemapindex>` sets `kind`, and any other root is a `SitemapParseError` naming the root it
found. That is also the content check: a host that answers an unknown path with its own
not-found template under a `200` fails here, with a message saying the root was `html`.

**An entry needs a `<loc>` that parses as an absolute URL.** An entry without one is skipped
and the rest of the document is kept, because one malformed row should not cost you the
other 49,999.

**A value the protocol refuses costs its own field, not the entry.** An unreadable
`<lastmod>` leaves `updatedAt` undefined, a `<changefreq>` outside the protocol's enum
leaves `frequency` undefined, and a `<priority>` outside 0.0–1.0 leaves `priority`
undefined. What you read back is what `append` accepts.

**`<lastmod>` is [W3C Datetime](https://www.w3.org/TR/NOTE-datetime)**, so a date alone
(`2026-09-11`) and a full timestamp (`2026-09-11T14:32:00+02:00`) both read.

**Extension namespaces are dropped.** `image:`, `video:` and `news:` children, and
`xhtml:link` alternates, have no vocabulary in `Sitemap.Entry`. Parse the document with
`@sdxc/xml` and read those elements yourself when you need them.

## API

### `new Sitemap()`

An empty document of kind `"urlset"`.

### `sitemap.append(loc: URL, options?: Sitemap.AppendOptions): void`

Adds one entry. `loc` is a `URL` because `<loc>` is absolute. `options` carries the crawler
metadata the protocol allows: `updatedAt`, `frequency` and `priority`.

### `sitemap.toString(): string`

Serializes the entries as the document type this instance carries — `<urlset>` for one built
by appending, and whichever root a parsed instance was read from. An empty document
serializes to a self-closing root.

### `Sitemap.parse(xml: XML): Result<Sitemap, SitemapParseError>`

Reads a parsed document as a sitemap, taking an `XML` instance rather than source text. The
root element decides what arrived; see [Parsing Rules](#parsing-rules).

### `Sitemap.fetch(input, init?): Promise<Result<Sitemap, SitemapFetchError | SitemapParseError | XMLParseError>>`

Retrieves one sitemap and parses it. Takes what `fetch` takes — a URL, a string or a
`Request`, plus request options — and reports a refused request or an error status as a
`SitemapFetchError` naming what came back.

```typescript
await Sitemap.fetch("https://example.com/sitemap.xml", {
	headers: { "User-Agent": "example-crawler" },
});
```

A `.xml.gz` sitemap served as `application/gzip` carries a gzip member in the body. Pipe the
response through a `DecompressionStream("gzip")` and hand the text to `Sitemap.parse`.

### `sitemap.kind: Sitemap.Kind`

Which document this instance carries: `"urlset"` lists pages, `"index"` lists other
sitemaps. A sitemap built by appending is always a `"urlset"`.

### `sitemap.entries: Set<Sitemap.Entry>`

The entries themselves, as the live set, whether they were appended or parsed.

### `sitemap.size: number`

How many entries the document holds.

### Errors

#### `SitemapParseError`

A document is not a sitemap. The message names the root element that arrived, so an error
page served under a `200` reports itself as `received <html>`.

#### `SitemapFetchError`

A sitemap could not be retrieved: the request was refused, or the response carried an error
status. The message names what came back.

### Types

Types live under the `Sitemap` namespace.

```typescript
type Kind = "urlset" | "index";

type Frequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface Entry {
	loc: URL;
	updatedAt?: Date;
	frequency?: Frequency;
	priority?: number;
}

interface AppendOptions {
	updatedAt?: Date;
	frequency?: Frequency;
	/** Priority value between 0.0 and 1.0, default is 0.5 */
	priority?: number;
}
```

## Pattern: Serving A Sitemap

The document is a string, so serving it is a `Response` with the content type a crawler
expects. Resolving every entry against the request's own URL makes one handler serve
production and every preview deployment:

```typescript
import { Sitemap } from "@sdxc/sitemap";

export async function GET(request: Request) {
	let base = new URL(request.url);
	let sitemap = new Sitemap();

	sitemap.append(new URL("/", base), { priority: 1, frequency: "weekly" });

	for (let post of await listPosts()) {
		sitemap.append(new URL(`/blog/${post.slug}`, base), { updatedAt: post.updatedAt });
	}

	return new Response(sitemap.toString(), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

## Pattern: Auditing A Site Against Its Own Sitemap

A sitemap is one request for the list of pages a site claims to publish, which makes it the
starting point for a crawl that checks those pages actually answer:

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let result = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(result)) throw result.error;

let missing: URL[] = [];

for (let entry of result.data.entries) {
	let response = await fetch(entry.loc, { method: "HEAD" });
	if (!response.ok) missing.push(entry.loc);
}
```

Filtering by `updatedAt` first turns the same loop into a recrawl that visits only what has
changed since the last run.

## Pattern: Writing A Sitemap Index

A site past 50,000 URLs splits into one sitemap per section, listed by an index document.
Building one from scratch means writing the `<sitemapindex>` root yourself, since a document
you construct is a `<urlset>`:

```typescript
import { unwrap } from "@sdxc/result";
import { XML } from "@sdxc/xml";

const SECTIONS = ["pages", "blog", "products"];

let source = unwrap(
	XML.stringify({
		declaration: { version: "1.0", encoding: "UTF-8" },
		root: {
			name: "sitemapindex",
			attributes: { xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" },
			children: SECTIONS.map((section) => ({
				name: "sitemap",
				children: [{ name: "loc", children: [`https://example.com/sitemap-${section}.xml`] }],
			})),
		},
	}),
);
```

An index that came from `Sitemap.parse` needs none of this: filter its entries and call
`toString()`, and it is written back as a `<sitemapindex>`.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/sitemap": "2026.9.11"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
