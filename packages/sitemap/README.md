# @sdxc/sitemap

Read and write the sitemap protocol: collect URLs into a document, or fetch a published
sitemap and read the pages it lists.

One `Sitemap` class covers both directions, so what `append` accepts is exactly what a parsed
entry reports back, and a document that is read, filtered and serialized keeps its type.

## Installation

```sh
npm add @sdxc/sitemap
```

Parsing and retrieval answer a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and `Sitemap.parse` takes a
document from [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml).

## Usage

### Build a sitemap

```typescript
import { Sitemap } from "@sdxc/sitemap";

let sitemap = new Sitemap();

sitemap.append(new URL("https://example.com/"), { priority: 1, frequency: "weekly" });
sitemap.append(new URL("https://example.com/blog/hello"), { updatedAt: new Date("2026-09-11") });

sitemap.toString();
// <?xml version="1.0" encoding="UTF-8"?>
// <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">…</urlset>
```

`updatedAt` is written as `<lastmod>`, `frequency` as `<changefreq>` and `priority` as
`<priority>`.

### Build one from a Remix route table

`fromRoutes` from `@sdxc/sitemap/remix` walks a `remix/routes` table and needs a decision for
every `GET` route in it, so a page added to the table fails typechecking until the sitemap lists
or excludes it. A route with params lists its pages, with the params typed from its pattern.

```typescript
import { fromRoutes } from "@sdxc/sitemap/remix";

let sitemap = fromRoutes(routes, "https://example.com", {
	home: { priority: 1 },
	post: posts.map((post) => ({ params: { slug: post.slug }, updatedAt: post.updatedAt })),
	healthcheck: false,
	admin: false, // a nested map, excluded whole
});
```

### Read a published sitemap

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let result = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(result)) throw result.error;

result.data.kind; // "urlset" or "index"
result.data.size; // 128

for (let entry of result.data.entries) {
	entry.loc; // URL
	entry.updatedAt; // Date | undefined
	entry.frequency; // Sitemap.Frequency | undefined
	entry.priority; // number | undefined
}
```

### Parse a document you already hold

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";
import { XML } from "@sdxc/xml";

let xml = XML.parse(source);
if (isFailure(xml)) throw xml.error;

let sitemap = Sitemap.parse(xml.data);
if (isFailure(sitemap)) throw sitemap.error; // SitemapParseError: received <html>
```

Reading follows these rules:

- The root decides what arrived: `<urlset>` reads as kind `"urlset"`, `<sitemapindex>` as
  `"index"`, and any other root is a `SitemapParseError` naming it.
- An entry needs a `<loc>` that is an absolute URL; a row without one is skipped and the rest
  of the document is kept.
- A value the protocol refuses leaves only its own field `undefined`: an unreadable
  `<lastmod>`, a `<changefreq>` outside the enum, a `<priority>` outside 0.0–1.0.
- `<lastmod>` reads as [W3C Datetime](https://www.w3.org/TR/NOTE-datetime), so `2026-09-11`
  and `2026-09-11T14:32:00+02:00` both arrive as a `Date`.
- Extension children (`image:`, `video:`, `news:`, `xhtml:link`) are left out of the entry;
  read them from the `XML` document when you need them.

## API

### `new Sitemap()`

An empty document of kind `"urlset"`.

### `sitemap.append(loc: URL, options?: Sitemap.AppendOptions): void`

Adds one entry with optional `updatedAt`, `frequency` and `priority` (0.0–1.0).

### `sitemap.toString(): string`

Serializes the entries under the root this instance carries. Index rows keep `loc` and
`updatedAt`, the two fields the protocol allows in a `<sitemap>` element.

### `sitemap.kind: Sitemap.Kind`

`"urlset"` for a built document or a parsed `<urlset>`, `"index"` for a parsed
`<sitemapindex>`.

### `sitemap.entries: Set<Sitemap.Entry>`

The live set of entries; deleting from it removes the entry from the serialized document.

### `sitemap.size: number`

How many entries the document holds.

### `Sitemap.parse(xml: XML): Result<Sitemap, SitemapParseError>`

Reads a parsed `XML` document as a sitemap, following the rules under
[Parse a document you already hold](#parse-a-document-you-already-hold).

### `Sitemap.fetch(input: URL | RequestInfo, init?: RequestInit): Promise<Result<Sitemap, SitemapFetchError | SitemapParseError | XMLParseError>>`

Retrieves and parses one sitemap, taking what `fetch` takes. Any `ok` response is parsed
whatever its `Content-Type`; a network error or an error status is a `SitemapFetchError`.

### `fromRoutes(routes, origin, decisions): Sitemap`

From `@sdxc/sitemap/remix`. Lists the table's pages in declared order, each URL built by its
route's `href()` against `origin`. A route without required params takes `true`, `false` or
`Sitemap.AppendOptions`; a route with params takes `false` or a list of `{ params, ...options }`;
a nested map takes its own decisions or `false`. `POST` and other write routes take none.

### `SitemapParseError`

The document's root is neither `<urlset>` nor `<sitemapindex>`; the message names the root.

### `SitemapFetchError`

The request failed or answered an error status; the message carries the cause or status.

### Types

```typescript
namespace Sitemap {
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
		priority?: number;
	}
}
```

## Pattern: Serving a Sitemap

Resolving every entry against the request URL lets one handler serve production and every
preview deployment.

```typescript
import { Sitemap } from "@sdxc/sitemap";

export async function handleSitemap(request: Request, posts: { slug: string; updatedAt: Date }[]) {
	let base = new URL(request.url);
	let sitemap = new Sitemap();

	sitemap.append(new URL("/", base), { priority: 1, frequency: "weekly" });

	for (let post of posts) {
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

## Pattern: Writing a Sitemap Index

A built `Sitemap` is a `<urlset>`. Parse an empty `<sitemapindex>` to get an index, then
append one entry per child sitemap.

```typescript
import { unwrap } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";
import { XML } from "@sdxc/xml";

let empty = unwrap(
	XML.parse('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>'),
);
let index = unwrap(Sitemap.parse(empty));

for (let section of ["pages", "blog", "products"]) {
	index.append(new URL(`https://example.com/sitemap-${section}.xml`), { updatedAt: new Date() });
}

index.toString(); // <sitemapindex …><sitemap><loc>…</loc><lastmod>…</lastmod></sitemap>…
```

## Pattern: Walking an Index Into Its Pages

`Sitemap.fetch` retrieves one document, so following an index is a loop whose pace you
choose.

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

async function listPages(url: string): Promise<URL[]> {
	let result = await Sitemap.fetch(url);
	if (isFailure(result)) return [];

	if (result.data.kind === "urlset") {
		return [...result.data.entries].map((entry) => entry.loc);
	}

	let pages: URL[] = [];
	for (let child of result.data.entries) {
		pages.push(...(await listPages(child.loc.href)));
	}
	return pages;
}

let pages = await listPages("https://example.com/sitemap.xml");
```

## Pattern: Recrawling Only What Changed

`updatedAt` turns a sitemap into a change feed: check only the pages modified since the last
run, and record the ones that stopped answering.

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let lastRun = new Date("2026-09-01");

let result = await Sitemap.fetch("https://example.com/sitemap.xml", {
	headers: { "User-Agent": "example-crawler" },
});
if (isFailure(result)) throw result.error;

let broken: URL[] = [];

for (let entry of result.data.entries) {
	if (entry.updatedAt && entry.updatedAt < lastRun) continue;
	let response = await fetch(entry.loc, { method: "HEAD" });
	if (!response.ok) broken.push(entry.loc);
}
```

## Pattern: Filtering and Republishing a Sitemap

`entries` is the live set, so deleting from it edits the document, and `toString()` writes it
back under the root it was read from.

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let result = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(result)) throw result.error;

for (let entry of result.data.entries) {
	if (entry.loc.pathname.startsWith("/drafts/")) result.data.entries.delete(entry);
}

let xml = result.data.toString();
```

## Pattern: Reading a Gzipped Sitemap

A `.xml.gz` sitemap carries a gzip body. Decompress it with
[`DecompressionStream`](https://developer.mozilla.org/docs/Web/API/DecompressionStream) and
parse the text, reporting each failure by its type.

```typescript
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";
import { XML } from "@sdxc/xml";

let response = await fetch("https://example.com/sitemap.xml.gz");
if (!response.ok || !response.body) throw new Error(`Status ${response.status}`);

let text = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).text();

let xml = XML.parse(text);
if (isFailure(xml)) throw xml.error; // XMLParseError: not well-formed XML

let sitemap = Sitemap.parse(xml.data);
if (isFailure(sitemap)) throw sitemap.error; // SitemapParseError: not a sitemap root
```

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
