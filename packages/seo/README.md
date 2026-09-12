# @sdxc/seo

Canonical URLs, typed [schema.org](https://schema.org/) structured data and head metadata,
all resolved through one configured instance.

A page's head has rules that are easy to get subtly wrong: the canonical URL must name one
origin regardless of which host served the request, structured data must spell `@context`
and `@type` exactly, and JSON-LD must not let page content close its own `<script>`.
`createSeo()` takes the site's identity and returns everything else, so one install serves
any site and the copy stays in the application.

## Installation

```bash
npm add @sdxc/seo
```

The head elements are [`remix`](https://www.npmjs.com/package/remix) components, rendered
by `remix/ui`, which installs alongside this package. The URL helpers, schema builders and
`jsonLdString` are plain functions and run anywhere.

## Usage

### Configure Once

```typescript
import { createSeo } from "@sdxc/seo";

let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
	twitter: { site: "@example" },
});
```

### Canonical And Absolute URLs

```typescript
seo.canonical("/features/search/"); // "https://example.com/features/search"
seo.canonical("https://preview.workers.dev/pricing"); // "https://example.com/pricing"
seo.canonical("/docs?section=api"); // "https://example.com/docs?section=api"
seo.absolute("/og/cover.png"); // "https://example.com/og/cover.png"
```

Whatever host served the request, one canonical URL comes out, so `seo.canonical(request.url)`
is the whole of what a page does about canonicalization.

### Structured Data

```typescript
let organization = seo.schema.organization({
	name: "Example Inc",
	logo: "/icon-512.png",
	sameAs: ["https://github.com/example"],
});

let breadcrumbs = seo.schema.breadcrumbs([
	{ name: "Docs", url: "/docs" },
	{ name: "API", url: "/docs/api" },
]);

seo.jsonLdString([organization, breadcrumbs]);
// '[{"@context":"https://schema.org","@type":"Organization",…}]'
```

### Head Elements

```tsx
import { Seo } from "@sdxc/seo";

<head>
	<Seo.Meta
		title="API reference"
		description="Every endpoint, with request and response examples."
		canonical={seo.canonical(request.url)}
		site={seo.site}
		og={{ type: "article", image: seo.absolute("/og/api.png") }}
	/>
	<Seo.JsonLd schema={[organization, breadcrumbs]} />
</head>;
```

## API

### `createSeo(config: SeoConfig): SeoService`

Creates the instance a site resolves all of its head metadata through. The configured base
URL is reduced to its origin once, and every URL the instance returns is built from that
origin rather than from the host that served the request.

- `config.baseUrl`: The site's canonical base URL, as a string or `URL`
- `config.siteName`: Site name for `og:site_name` and for nodes describing the site
- `config.defaultDescription`: Description used when a page or node passes none
- `config.twitter`: Optional `site`/`creator` handles and `card` layout

### `seo.canonical(url: string | URL): string`

Resolves a request URL or a root-relative path to the page's one canonical URL.

The configured origin replaces whatever host served the request, the trailing slash is
dropped everywhere but the root, the query string is preserved verbatim, and the hash is
dropped. Because the query string is preserved verbatim, a trailing slash sitting before a
`?` stays — the slash is only dropped when it is the resolved URL's last character.

### `seo.absolute(path: string | URL): string`

Resolves an asset path against the configured origin, leaving an already-absolute URL alone
so a CDN host passes through. It performs no trailing-slash normalization, since an asset
URL is not a page URL.

```typescript
seo.absolute("/og/cover.png"); // "https://example.com/og/cover.png"
seo.absolute("https://cdn.example.net/cover.png"); // unchanged
```

### `seo.robotsTag(options?: RobotsOptions): string`

Builds the `robots` meta content for one page from `index` and `follow` booleans, both
defaulting to `true`. Both directives are always spelled out, so the emitted value states
the page's full policy.

```typescript
seo.robotsTag({ index: false, follow: true }); // "noindex, follow"
seo.robotsTag(); // "index, follow"
```

### `seo.jsonLdString(schema: SchemaOrg.Node | SchemaOrg.Node[]): string`

Serializes one node or several for a `<script type="application/ld+json">` body. Every `<`
becomes its unicode escape, so no string value can emit a `</script` or `<!--` sequence and
break out of the script element; the JSON still parses back to the original text. Use it
wherever the JSX is not `remix/ui`, and `Seo.JsonLd` where it is.

### `seo.baseUrl: string`

The configured origin, with no trailing slash — useful for building URLs the package has no
builder for, such as a feed entry or a
[`@sdxc/sitemap`](https://www.npmjs.com/package/@sdxc/sitemap) document.

### `seo.site: SeoSite`

The site identity `Seo.Meta` needs (`name`, `description`, and `twitter`), so a layout
passes configuration through instead of restating it.

### `seo.schema: SeoSchema`

Typed builders bound to this configuration. Page URLs go through the canonical rules, so a
node's `url` agrees with the canonical link; image and logo paths are made absolute; dates
accept a `Date` or an already-formatted string; and optional properties are omitted rather
than emitted empty.

#### `seo.schema.organization(input): SchemaOrg.Organization`

The publisher behind the site. `url` defaults to the configured base URL, and `sameAs`
carries profile URLs proving the same entity elsewhere.

```typescript
seo.schema.organization({ name: "Example Inc", logo: "/icon-512.png" });
```

#### `seo.schema.website(input?): SchemaOrg.WebSite`

The site as a whole, for the one page whose subject is the site itself. Name, URL, and
description all fall back to the configuration. A `searchAction` template is prefixed
without percent-encoding, so the braces around the query placeholder survive.

```typescript
seo.schema.website({ searchAction: { urlTemplate: "/search?q={search_term_string}" } });
```

#### `seo.schema.webPage(input): SchemaOrg.WebPage`

A page with no more specific type. A single `image` becomes the page's
`primaryImageOfPage`.

```typescript
seo.schema.webPage({
	name: "Pricing",
	description: "Every plan, and what each one includes.",
	url: "/pricing",
	image: "/og/pricing.png",
});
```

#### `seo.schema.article(input): SchemaOrg.Article`

A dated, authored page. The byline defaults to a `Person`; pass
`author: { name, kind: "Organization" }` for an organizational one. A single image is
normalized into a list.

```typescript
seo.schema.article({
	headline: post.title,
	datePublished: post.publishedAt,
	dateModified: post.updatedAt,
	author: { name: "Sergio", url: "/about" },
	image: post.cover,
	url: `/blog/${post.slug}`,
});
```

#### `seo.schema.breadcrumbs(crumbs): SchemaOrg.BreadcrumbList`

The trail leading to the current page. Positions are numbered from the given order.

```typescript
seo.schema.breadcrumbs([
	{ name: "Home", url: "/" },
	{ name: "Docs", url: "/docs" },
]);
```

#### `seo.schema.faq(questions): SchemaOrg.FAQPage`

A page's question-and-answer section. Pass the same pairs the page renders:
[Google's structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
require the marked-up answers to be visible to the visitor.

```typescript
seo.schema.faq([{ question: "Is there a free plan?", answer: "Yes, up to 10 projects." }]);
```

#### `seo.schema.softwareApplication(input): SchemaOrg.SoftwareApplication`

A product or capability page whose subject is the software itself. It takes one `offers`
object, since an application page quotes one price.

```typescript
seo.schema.softwareApplication({
	name: "Example",
	applicationCategory: "WebApplication",
	operatingSystem: "Any",
	offers: { price: "0", priceCurrency: "USD", description: "Usage-based pricing" },
	featureList: ["Full-text search", "Bulk export"],
});
```

#### `seo.schema.book(input): SchemaOrg.Book`

A page selling one book. Only the title and its author are required; every other property
is one a sales page either knows or leaves out. The byline behaves as `article`'s, a single
cover image is normalized into a list, and `bookFormat` takes a
[schema.org `BookFormatType`](https://schema.org/BookFormatType) URL so a typo cannot
compile. Pass an array to `offers` when the book is sold as more than one package: each
price is its own `Offer`, and a single offer is normalized into the same list.

```typescript
seo.schema.book({
	name: "Álem",
	author: { name: "Sergio", url: "/about" },
	description: "A novel about the places a language remembers.",
	url: "/",
	image: "/og.jpg",
	bookFormat: "https://schema.org/EBook",
	inLanguage: "es",
	numberOfPages: 180,
	offers: [
		{ price: "29", priceCurrency: "USD", description: "Book", url: "/checkout" },
		{ price: "49", priceCurrency: "USD", description: "Book and workshop", url: "/checkout/pro" },
	],
});
```

### `Seo`

`remix/ui` component emitting a page's whole head contribution: the `Seo.Meta` tag set, plus
a `Seo.JsonLd` script when `schema` is given.

**Props:**

- Everything `Seo.Meta` accepts
- `schema?`: `SchemaOrg.Node | SchemaOrg.Node[]` - Structured data for the page

```tsx
<Seo title={title} canonical={seo.canonical(request.url)} site={seo.site} schema={article} />
```

### `Seo.Meta`

`remix/ui` component emitting the title, description, canonical link, robots directives, and
the Open Graph and Twitter tag sets. Both social namespaces restate the title and
description, because every consumer of these cards reads its own namespace and ignores the
other's. A tag whose input is missing is skipped, so a page states only what it has.

**Props:**

- `title?`: `string` - The page title, already localized
- `description?`: `string` - Meta description. Falls back to `site.description`
- `canonical`: `string` - The page's canonical absolute URL, from `seo.canonical()`
- `site?`: `SeoSite` - Site identity, from `seo.site`
- `og?`: `Seo.OpenGraph` - `type`, `image`, `imageAlt`, and `locale`
- `robots?`: `string` - Content from `seo.robotsTag()`

```tsx
<Seo.Meta
	title={title}
	description={description}
	canonical={seo.canonical(request.url)}
	site={seo.site}
	og={{ type: "article", image: seo.absolute("/og/cover.png") }}
/>
```

### `Seo.JsonLd`

`remix/ui` component emitting structured data as one `application/ld+json` script. Several
nodes go into a single script as an array, which is valid and far easier to audit than
several scripts. The JSON is set through `innerHTML`, since JSX escapes text nodes and would
leave the data unparseable.

**Props:**

- `schema`: `SchemaOrg.Node | SchemaOrg.Node[]` - The nodes to serialize

```tsx
<Seo.JsonLd schema={[organization, article, breadcrumbs]} />
```

### Types

#### `SeoConfig`

```typescript
interface SeoConfig {
	baseUrl: string | URL;
	siteName: string;
	defaultDescription: string;
	twitter?: SeoTwitter;
}
```

#### `SeoSite`

```typescript
interface SeoSite {
	name: string;
	description: string;
	twitter?: SeoTwitter;
}
```

#### `SeoTwitter`

```typescript
interface SeoTwitter {
	site?: string;
	creator?: string;
	card?: "summary" | "summary_large_image";
}
```

#### `RobotsOptions`

```typescript
interface RobotsOptions {
	index?: boolean;
	follow?: boolean;
}
```

#### `SeoService`

The interface `createSeo` returns: `baseUrl`, `site`, `schema`, and the `canonical`,
`absolute`, `robotsTag` and `jsonLdString` methods.

#### `SeoSchema`

The builder set exposed as `seo.schema`, with one method per node type.

#### `SchemaOrg`

Namespace of the node shapes the builders return (`SchemaOrg.Organization`,
`SchemaOrg.Article`, `SchemaOrg.BreadcrumbList`, …), their nested types
(`SchemaOrg.ListItem`, `SchemaOrg.Offer`, …), and the inputs the builders accept
(`SchemaOrg.ArticleInput`, …). `SchemaOrg.Node` is the union of every top-level node, and is
what serialization accepts.

## Pattern: One Instance Per Site

The configuration is read once at boot, so build the instance once and share it rather than
calling the factory per request.

```typescript
import { createSeo } from "@sdxc/seo";

/** The site's one SEO instance, shared by every page and layout. */
export const SEO = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "A searchable catalog of public datasets, with an API.",
	twitter: { site: "@example" },
});
```

## Pattern: A Document Layout That Takes Metadata As Input

Let the layout accept the metadata input and pass it straight through, so each page decides
its own copy and structured data while the tag set stays identical everywhere.

```tsx
import { Seo } from "@sdxc/seo";
import type { Handle, RemixNode } from "remix/ui";

interface Props {
	children: RemixNode;
	locale?: string;
	seo?: Seo.Props;
}

function DocumentLayout(handle: Handle<Props>) {
	return () => (
		<html lang={handle.props.locale}>
			<head>
				<meta charSet="utf-8" />
				{handle.props.seo && <Seo {...handle.props.seo} />}
			</head>
			<body>{handle.props.children}</body>
		</html>
	);
}
```

## Pattern: Serializing Outside `remix/ui`

Where the JSX is not `remix/ui`, build the same nodes and serialize them by hand.

```tsx
let body = seo.jsonLdString([organization, article]);

<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: body }} />;
```

## Pattern: Keeping A Page Out Of The Index

Signed-in screens and thin filtered views say so per page; site-wide crawl policy belongs in
`robots.txt`.

```tsx
<Seo.Meta
	canonical={seo.canonical(request.url)}
	robots={seo.robotsTag({ index: false, follow: true })}
/>
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
