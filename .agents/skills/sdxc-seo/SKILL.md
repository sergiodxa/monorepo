---
name: sdxc-seo
description: "@sdxc/seo resolves canonical URLs, typed schema.org structured data and head metadata through one `createSeo()` instance, plus `Seo`, `Seo.Meta` and `Seo.JsonLd` remix/ui components. Use when a page needs a canonical link, Open Graph and Twitter tags, a robots directive, or JSON-LD nodes (Organization, Article, BreadcrumbList, FAQPage, SoftwareApplication, Book), or when preview deployments are emitting the wrong origin in the head."
---

# @sdxc/seo

A page's head has rules that are easy to get subtly wrong: the canonical URL must name one
origin regardless of which host served the request, structured data must spell `@context`
and `@type` exactly, and JSON-LD must not let page content close its own `<script>`.
`createSeo()` takes the site's identity and returns `canonical`, `absolute`, `robotsTag`,
`jsonLdString`, a `schema` builder set and a `site` identity object; the `Seo`, `Seo.Meta`
and `Seo.JsonLd` components render the head elements. The URL helpers, schema builders and
`jsonLdString` are plain functions and run on any runtime; the components need `remix/ui`.

Full API, options and examples: [packages/seo/README.md](packages/seo/README.md)

## When to reach for it

- A preview deployment or a custom domain is emitting its own host in `<link rel="canonical">` instead of the site's one origin.
- A page needs Open Graph and Twitter card tags without restating the site name and description at every route.
- Search Console reports invalid structured data, or a node needs `@context`/`@type` spelled correctly without hand-writing JSON-LD.
- A signed-in screen or a thin filtered view has to be kept out of the index per page rather than in `robots.txt`.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/seo": "workspace:*" } }
```

```ts
import { createSeo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
	twitter: { site: "@example" },
});

seo.canonical("/features/search/"); // "https://example.com/features/search"
seo.absolute("/og/cover.png"); // "https://example.com/og/cover.png"
```

```tsx
<head>
	<Seo.Meta
		title="API reference"
		description="Every endpoint, with request and response examples."
		canonical={seo.canonical(request.url)}
		site={seo.site}
		og={{ type: "article", image: seo.absolute("/og/api.png") }}
	/>
	<Seo.JsonLd schema={[organization, breadcrumbs]} />
</head>
```

## Suggestions

- Build the instance once at module scope and share it — the configuration is read at boot, so calling the factory per request buys nothing. `seo.canonical(request.url)` is then the whole of what a page does about canonicalization.
- `Seo.JsonLd` sets the JSON through `innerHTML` because JSX escapes text nodes. Where the JSX is not `remix/ui`, call `seo.jsonLdString()` yourself and pass it to `dangerouslySetInnerHTML` — it escapes every `<` so no string value can close the script element.
- `canonical` drops the trailing slash and the hash but preserves the query string verbatim, so a slash sitting before a `?` survives; `absolute` does no trailing-slash normalization and leaves an already-absolute CDN URL alone.

## Related

- `@sdxc/sitemap` — `seo.baseUrl` gives the origin its entries are built from; skill `sdxc-sitemap`
