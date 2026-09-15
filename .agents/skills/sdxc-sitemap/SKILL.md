---
name: sdxc-sitemap
description: "@sdxc/sitemap reads and writes the sitemap protocol through one `Sitemap` class: `append` collects URLs with lastmod, changefreq and priority, `toString` serializes `<urlset>` XML, and `Sitemap.fetch`/`Sitemap.parse` read a published sitemap or a `<sitemapindex>`. Use when serving /sitemap.xml, crawling a site from its own sitemap, walking a sitemap index, or auditing which listed pages still answer."
---

# @sdxc/sitemap

Writing a sitemap is the well-known half — a handler gathers its routes and serves
`<urlset>` XML for a crawler. Reading one is the half that usually has no home, and a
published sitemap is the cheapest inventory of a site there is. Both directions answer with
the same `Sitemap` class: `append`/`toString` build a document, `Sitemap.parse` reads an
`@sdxc/xml` document and `Sitemap.fetch` retrieves and parses one, both reporting through a
`@sdxc/result` `Result`. It runs on any fetch runtime.

Full API, options and examples: [packages/sitemap/README.md](packages/sitemap/README.md)

## When to reach for it

- A route has to serve `/sitemap.xml` with the right element names for every page the site publishes.
- You need the list of pages a site claims to publish, as one request, before crawling or recrawling them.
- A large site splits into sections and the index document has to be walked to reach the page sitemaps.
- An audit needs to check that the URLs a sitemap lists still answer, or to visit only what changed since the last run.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/sitemap": "workspace:*" } }
```

```ts
import { Sitemap } from "@sdxc/sitemap";

let sitemap = new Sitemap();

sitemap.append(new URL("https://example.com/"), { priority: 1, frequency: "weekly" });
sitemap.append(new URL("https://example.com/blog/hello"), { updatedAt: new Date("2026-09-11") });

sitemap.toString();
// <?xml version="1.0" encoding="UTF-8"?>
// <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">…</urlset>
```

```ts
import { isFailure } from "@sdxc/result";
import { Sitemap } from "@sdxc/sitemap";

let result = await Sitemap.fetch("https://example.com/sitemap.xml");
if (isFailure(result)) throw result.error;

result.data.kind; // "urlset" | "index"
for (let entry of result.data.entries) entry.loc; // URL
```

## Suggestions

- In a handler, resolve every entry against the request's own URL (`new URL("/blog/x", new URL(request.url))`) so one handler serves production and every preview deployment, and answer with `Content-Type: application/xml; charset=utf-8`.
- Check `kind` before treating entries as pages: an `index` document's entries are other sitemaps, and each is its own `Sitemap.fetch`, so how many children to fetch and how fast stays yours to decide.
- The root element is the content check, not `Content-Type` — a host answering an unknown path with a `200` not-found page fails as a `SitemapParseError` saying the root was `html`. An entry without a parseable absolute `<loc>` is skipped, and a value the protocol refuses costs its own field rather than the entry.
- A document built by appending is always a `<urlset>`; writing a `<sitemapindex>` from scratch means building the XML with `@sdxc/xml` directly. A parsed index re-serializes as an index. A `.xml.gz` body has to be piped through `DecompressionStream("gzip")` before parsing.

## Related

- `@sdxc/result` — parsing and retrieval report through `Result`, so `isFailure` comes from here; skill `sdxc-result`
- `@sdxc/xml` — `Sitemap.parse` takes its `XML` document, and extension namespaces dropped by the parser are read with it; skill `sdxc-xml`
- `@sdxc/seo` — its `baseUrl` and canonical rules give the origin entries are built from; skill `sdxc-seo`
