# @sdxc/seo

Canonical URLs, typed [schema.org](https://schema.org/) structured data and head metadata.

Configure a site's origin and identity once with `createSeo()`, and every canonical URL,
structured-data node and head tag the instance produces names that one origin, whichever host
served the request. Node types spell `@context` and `@type` as literals, and the JSON-LD
serializer escapes content so it stays inside its `<script>`.

## Installation

```sh
npm add @sdxc/seo
```

The head elements are `remix/component` components from
[`remix`](https://www.npmjs.com/package/remix); the URL helpers, schema builders and
`jsonLdString` are plain functions that run anywhere.

## Usage

### Configure the site once

```typescript
import { createSeo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
	twitter: { site: "@example", creator: "@author" },
});
```

### Resolve canonical and absolute URLs

```typescript
seo.canonical("/features/search/"); // "https://example.com/features/search"
seo.canonical("https://preview.workers.dev/pricing"); // "https://example.com/pricing"
seo.canonical("/docs?section=api&utm_source=newsletter"); // "https://example.com/docs?section=api"

seo.absolute("/og/cover.png"); // "https://example.com/og/cover.png"
seo.absolute("https://cdn.example.net/cover.png"); // unchanged
seo.baseUrl; // "https://example.com"
```

### Build structured data

```typescript
let organization = seo.schema.organization({
	name: "Example Inc",
	logo: "/icon-512.png",
	sameAs: ["https://github.com/example"],
});

let breadcrumbs = seo.schema.breadcrumbs([
	{ name: "Docs", url: "/docs" },
	{ name: "API", url: "/docs/api/" },
]);
// item URLs go through the canonical rules: "https://example.com/docs/api"
```

### Render the head

```tsx
import { Seo } from "@sdxc/seo";

<head>
	<Seo
		title="API reference"
		description="Every endpoint, with request and response examples."
		canonical={seo.canonical(request.url)}
		site={seo.site}
		og={{ type: "article", image: seo.absolute("/og/api.png") }}
		schema={[organization, breadcrumbs]}
	/>
</head>;
```

`Seo` emits the title, description, canonical link, Open Graph and Twitter tags, and one
`application/ld+json` script holding every node. A tag whose input is missing is skipped.

## API

### `createSeo(config: SeoConfig): SeoService`

Creates the instance a site resolves its head metadata through. `baseUrl` (a string or `URL`)
is reduced to its origin; `siteName` feeds `og:site_name` and the nodes describing the site;
`defaultDescription` is used wherever a page or node passes none; `twitter` holds the optional
`site` and `creator` handles and the `card` layout (default `"summary_large_image"`).

### `seo.canonical(url: string | URL): string`

Resolves a request URL or root-relative path to the page's canonical URL: the configured origin,
no trailing slash outside the root, no hash, and no tracking parameters (`utm_*` and click
identifiers such as `gclid`, the list
[`@sdxc/attribution`](https://www.npmjs.com/package/@sdxc/attribution) keeps). Every other query
parameter is kept verbatim.

### `seo.absolute(path: string | URL): string`

Resolves an asset path against the configured origin, passing an absolute URL such as a CDN
host through and keeping the path exactly as given.

### `seo.robotsTag(options?: RobotsOptions): string`

Builds `robots` meta content from `index` and `follow`, both defaulting to `true`. Both
directives are always spelled out: `{ index: false }` gives `"noindex, follow"`.

### `seo.jsonLdString(schema: SchemaOrg.Node | SchemaOrg.Node[]): string`

Serializes one node or several for an `application/ld+json` script body, escaping every `<` as
`<` so no value can close the script; the JSON parses back to the original text.

### `seo.baseUrl: string`

The configured origin with no trailing slash, for URLs the package has no builder for, such as
feed entries or a [`@sdxc/sitemap`](https://www.npmjs.com/package/@sdxc/sitemap) document.

### `seo.site: SeoSite`

The site's `name`, `description` and `twitter` settings, ready to pass as `Seo`'s `site` prop.

### `seo.schema: SeoSchema`

Builders bound to the configuration, each returning one typed node. Page URLs go through the
canonical rules, image and logo paths are made absolute, dates accept a `Date` or an
already-formatted string, and optional properties left out are omitted from the node.

#### `seo.schema.organization(input): SchemaOrg.Organization`

The publisher behind the site: `name`, plus optional `url` (defaults to the base URL), `logo`,
`description` and `sameAs` profile URLs.

#### `seo.schema.website(input?): SchemaOrg.WebSite`

The site as a whole; `name`, `url` and `description` fall back to the configuration.
`searchAction: { urlTemplate, queryName? }` adds a site search box; a root-relative template is
prefixed with the origin and keeps its `{search_term_string}` braces.

#### `seo.schema.webPage(input): SchemaOrg.WebPage`

A page with no more specific type: `name`, `description`, `url`, and optional `inLanguage`,
`datePublished`, `dateModified` and `image` (emitted as `primaryImageOfPage`).

#### `seo.schema.article(input): SchemaOrg.Article`

A dated, authored page: `headline`, `datePublished` and `author`, plus optional
`dateModified`, `description`, `url`, `image` (one or several), `publisher: { name, logo? }`,
`section`, `keywords` and `inLanguage`. The author is a `Person` unless it passes
`kind: "Organization"`.

#### `seo.schema.breadcrumbs(crumbs): SchemaOrg.BreadcrumbList`

The trail to the current page from `{ name, url }` pairs, numbered from 1 in the given order.

#### `seo.schema.faq(questions): SchemaOrg.FAQPage`

A question-and-answer section from `{ question, answer }` pairs.
[Google's structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
require the marked-up answers to be visible on the page.

#### `seo.schema.softwareApplication(input): SchemaOrg.SoftwareApplication`

A page whose subject is the software: `name` and `applicationCategory`, plus optional
`description`, `operatingSystem`, `url`, one `offers` object and `featureList`.

#### `seo.schema.book(input): SchemaOrg.Book`

A page selling one book: `name` and `author`, plus optional `description`, `url`, `image`,
`bookFormat` (a [`BookFormatType`](https://schema.org/BookFormatType) URL), `inLanguage`,
`numberOfPages`, `isbn`, `datePublished`, `publisher`, and `offers` as one offer or a list,
always emitted as a list.

### `Seo`

`remix/component` component emitting `Seo.Meta` and, when `schema` is given, `Seo.JsonLd`. It
takes every `Seo.Meta` prop plus `schema?: SchemaOrg.Node | SchemaOrg.Node[]`.

### `Seo.Meta`

Emits `<title>`, the description, the canonical link, `robots`, and the Open Graph and Twitter
tag sets, each namespace restating the title and description. Props:

- `canonical`: The page's absolute canonical URL, from `seo.canonical()`
- `title?`: The page title
- `description?`: Falls back to `site.description`
- `site?`: From `seo.site`; adds `og:site_name` and the Twitter handles and card
- `og?`: `type` (`"website"` by default, or `"article"`), `image`, `imageAlt`, `imageWidth`, `imageHeight` and `locale`
- `robots?`: From `seo.robotsTag()`

### `Seo.JsonLd`

Emits one `application/ld+json` script for `schema`, a node or an array of nodes, serialized as
`jsonLdString` does.

### Types

- `SeoConfig`: the `createSeo` input.
- `SeoService`: the instance `createSeo` returns.
- `SeoSite`: `{ name, description, twitter? }`.
- `SeoTwitter`: `{ site?, creator?, card?: "summary" | "summary_large_image" }`.
- `RobotsOptions`: `{ index?, follow? }`.
- `SeoSchema`: the builder set on `seo.schema`.
- `Seo.Props`, `Seo.MetaProps`, `Seo.JsonLdProps`, `Seo.OpenGraph`: the component props.
- `SchemaOrg`: namespace of the nodes the builders return (`SchemaOrg.Article`,
  `SchemaOrg.Book`, …), their parts (`SchemaOrg.Offer`, `SchemaOrg.ListItem`, …) and the builder
  inputs (`SchemaOrg.ArticleInput`, …). `SchemaOrg.Node` is the union of every top-level node.

## Pattern: A Shared Instance And A Layout That Takes Metadata

Build the instance once at module scope, and let the document layout accept `Seo.Props` so each
page supplies its own copy and structured data while the tag set stays identical everywhere.

```tsx
import { createSeo, Seo } from "@sdxc/seo";
import type { Handle, RemixNode } from "remix/component";

export const SEO = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
	twitter: { site: "@example" },
});

interface DocumentProps {
	children: RemixNode;
	seo: Seo.Props;
}

export function Document(handle: Handle<DocumentProps>) {
	return () => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<Seo site={SEO.site} {...handle.props.seo} />
			</head>
			<body>{handle.props.children}</body>
		</html>
	);
}
```

## Pattern: The Home Page Describes The Site

The home page carries the organization and the site itself; a search action lets a search
engine offer a search box that lands on the site's results page.

```tsx
import { createSeo, Seo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
});

let organization = seo.schema.organization({
	name: "Example Inc",
	logo: "/icon-512.png",
	sameAs: ["https://github.com/example", "https://x.com/example"],
});

let website = seo.schema.website({
	searchAction: { urlTemplate: "/search?q={search_term_string}" },
});

<Seo
	title="Example"
	canonical={seo.canonical(request.url)}
	site={seo.site}
	og={{ image: seo.absolute("/og/home.png"), imageAlt: "The Example dashboard" }}
	schema={[organization, website]}
/>;
```

## Pattern: An Article Page

An article states its dates, byline and publisher, and sits under a breadcrumb trail; the Open
Graph type switches to `article`.

```tsx
import { createSeo, Seo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "Notes on building for the web.",
});

let url = `/articles/${post.slug}`;

let article = seo.schema.article({
	headline: post.title,
	description: post.summary,
	datePublished: post.publishedAt,
	dateModified: post.updatedAt,
	author: { name: post.authorName, url: "/about" },
	publisher: { name: "Example", logo: "/icon-512.png" },
	image: [post.cover, post.coverSquare],
	section: "Guides",
	keywords: post.tags,
	inLanguage: "en",
	url,
});

let breadcrumbs = seo.schema.breadcrumbs([
	{ name: "Articles", url: "/articles" },
	{ name: post.title, url },
]);

<Seo
	title={post.title}
	description={post.summary}
	canonical={seo.canonical(url)}
	site={seo.site}
	og={{ type: "article", image: seo.absolute(post.cover), locale: "en_US" }}
	schema={[article, breadcrumbs]}
/>;
```

## Pattern: A Product Page With Pricing And FAQ

Describe the software with its offer and features, and mark up the same questions the page
renders, from one list so the two stay identical.

```tsx
import { createSeo, Seo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
});

let questions = [
	{ question: "Is there a free plan?", answer: "Yes, up to 10 projects." },
	{ question: "Can I export my data?", answer: "Yes, as CSV or JSON at any time." },
];

let schema = [
	seo.schema.softwareApplication({
		name: "Example",
		applicationCategory: "WebApplication",
		operatingSystem: "Any",
		url: "/pricing",
		offers: { price: "0", priceCurrency: "USD", description: "Free plan", url: "/signup" },
		featureList: ["Full-text search", "Bulk export"],
	}),
	seo.schema.faq(questions),
];

<html>
	<head>
		<Seo title="Pricing" canonical={seo.canonical("/pricing")} site={seo.site} schema={schema} />
	</head>
	<body>
		{questions.map((entry) => (
			<details>
				<summary>{entry.question}</summary>
				<p>{entry.answer}</p>
			</details>
		))}
	</body>
</html>;
```

## Pattern: A Book Sold As Several Packages

Each package is its own offer inside one `Book` node.

```typescript
import { createSeo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "The Novel",
	defaultDescription: "A novel about the places a language remembers.",
});

let book = seo.schema.book({
	name: "The Novel",
	author: { name: "Jane Doe", url: "/about" },
	url: "/",
	image: "/cover.jpg",
	bookFormat: "https://schema.org/EBook",
	inLanguage: "en",
	numberOfPages: 180,
	datePublished: new Date("2026-03-01"),
	offers: [
		{ price: "29", priceCurrency: "USD", description: "Book", url: "/checkout" },
		{ price: "49", priceCurrency: "USD", description: "Book and workshop", url: "/checkout/pro" },
	],
});
```

## Pattern: Keeping A Page Out Of The Index

Signed-in screens and thin filtered views opt out per page; site-wide crawl policy belongs in
`robots.txt`.

```tsx
import { createSeo, Seo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
});

<Seo.Meta
	title="Your account"
	canonical={seo.canonical(request.url)}
	site={seo.site}
	robots={seo.robotsTag({ index: false, follow: true })}
/>;
```

## Pattern: Adding Structured Data Outside `remix/component`

Where the HTML comes from elsewhere, such as a static page served by a Cloudflare Worker,
serialize the nodes with `jsonLdString` and append the script to the existing `<head>`.

```typescript
import { createSeo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
});

let body = seo.jsonLdString([
	seo.schema.organization({ name: "Example Inc", logo: "/icon-512.png" }),
	seo.schema.webPage({ name: "Status", description: "Live service status.", url: "/status" }),
]);

let response = await fetch(request);

return new HTMLRewriter()
	.on("head", {
		element(head) {
			head.append(`<script type="application/ld+json">${body}</script>`, { html: true });
		},
	})
	.transform(response);
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
		"@sdxc/seo": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
