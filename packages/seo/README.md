# @pkg/seo

Canonical URLs, typed schema.org structured data, and head metadata for a site.

## Overview

A page's head has a handful of rules that are easy to get subtly wrong: the canonical
URL must name one origin regardless of which host served the request, the trailing slash
must be dropped everywhere but the root, structured data must spell `@context` and
`@type` exactly, and JSON-LD must not let page content close its own `<script>`. This
package decides each of those once and exposes them through a configured instance.

`createSeo()` takes the site's identity — base URL, name, default description, Twitter
handles — and returns everything else. The package itself carries no base URL, site name,
or description, so it can serve any site in the repo, and titles and descriptions are
always inputs: copy belongs to the app's i18n layer, never to this package.

Structured data is modeled as hand-written interfaces covering the
[schema.org](https://schema.org/) types the sites actually use, rather than a generated
definition of the whole vocabulary. Required properties are enforced at compile time, and
a new page type means adding a builder — a small reviewed change instead of a pasted
object literal.

## Usage

### Configure Once

```typescript
import { createSeo } from "@pkg/seo";

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
```

### Head Elements

```tsx
import { Seo } from "@pkg/seo";

<head>
	<Seo.Meta
		title={t("docs.api.title")}
		description={t("docs.api.description")}
		canonical={seo.canonical(ctx.url)}
		site={seo.site}
		og={{ type: "article", image: seo.absolute("/og/api.png") }}
	/>
	<Seo.JsonLd schema={[organization, breadcrumbs]} />
</head>;
```

## API

### `createSeo(config: SeoConfig): SeoService`

Creates the instance a site resolves all of its head metadata through. The configured
base URL is reduced to its origin once, and every URL the instance returns is built from
that origin rather than from the host that served the request.

**Parameters:**

- `config.baseUrl`: The site's canonical base URL, as a string or `URL`
- `config.siteName`: Site name for `og:site_name` and for nodes describing the site
- `config.defaultDescription`: Description used when a page or node passes none
- `config.twitter`: Optional `site`/`creator` handles and `card` layout

**Returns:**

- A `SeoService` exposing canonical URLs, schema builders, and serialization

**Example:**

```typescript
let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "…",
});
```

### `seo.canonical(url: string | URL): string`

Resolves a request URL or a root-relative path to the page's one canonical URL.

The rules: the configured origin replaces whatever host served the request (custom
domain, `workers.dev` subdomain, preview deployment), the trailing slash is dropped
everywhere but the root, the query string is preserved verbatim, and the hash is
dropped. Because the query string is preserved verbatim, a trailing slash sitting before
a `?` stays — the slash is only dropped when it is the resolved URL's last character.

**Example:**

```typescript
seo.canonical(ctx.url); // whatever host served the request, one canonical URL out
```

### `seo.absolute(path: string | URL): string`

Resolves an asset path against the configured origin, leaving already-absolute URLs
alone. Performs no trailing-slash normalization, since an asset URL is not a page URL.

**Example:**

```typescript
seo.absolute("/og/cover.png"); // "https://example.com/og/cover.png"
seo.absolute("https://cdn.example.net/cover.png"); // unchanged
```

### `seo.robotsTag(options?: RobotsOptions): string`

Builds the `robots` meta content for one page. Both directives are always spelled out,
so the emitted value states the page's full policy.

**Parameters:**

- `options.index`: Whether the page may be indexed. Defaults to `true`
- `options.follow`: Whether its links may be followed. Defaults to `true`

**Example:**

```typescript
seo.robotsTag({ index: false, follow: true }); // "noindex, follow"
seo.robotsTag(); // "index, follow"
```

### `seo.jsonLdString(schema: SchemaOrg.Node | SchemaOrg.Node[]): string`

Serializes one node or several for a `<script type="application/ld+json">` body. Every
`<` becomes its unicode escape, so no string value can emit a `</script` or `<!--`
sequence and break out of the script element; the JSON still parses back to the original
text. Use it where JSX is not `remix/ui`; use `Seo.JsonLd` where it is.

**Example:**

```typescript
let body = seo.jsonLdString([organization, article]);
```

### `seo.baseUrl`

The configured origin, with no trailing slash — useful for building URLs the package has
no builder for, such as a feed or sitemap entry.

### `seo.site`

The site identity `Seo.Meta` needs (`name`, `description`, and `twitter`), so a layout
never restates configuration it can pass through.

### `seo.schema`

Typed builders bound to this configuration. Page URLs go through the canonical rules, so
a node's `url` can never disagree with the canonical link; image and logo paths are made
absolute; and optional properties are omitted rather than emitted empty.

#### `seo.schema.organization(input): SchemaOrg.Organization`

The publisher behind the site. `url` defaults to the configured base URL.

```typescript
seo.schema.organization({ name: "Example Inc", logo: "/icon-512.png" });
```

#### `seo.schema.website(input?): SchemaOrg.WebSite`

The site as a whole, for the one page whose subject is the site itself. Name, URL, and
description all fall back to the configuration.

```typescript
seo.schema.website({ searchAction: { urlTemplate: "/search?q={search_term_string}" } });
```

#### `seo.schema.webPage(input): SchemaOrg.WebPage`

A page with no more specific type.

```typescript
seo.schema.webPage({ name: title, description, url: "/pricing", image: "/og/pricing.png" });
```

#### `seo.schema.article(input): SchemaOrg.Article`

A dated, authored page. The byline defaults to a `Person`; pass
`author: { name, kind: "Organization" }` for an organizational one. Dates accept a `Date`
or an already-formatted string, and a single image is normalized into a list.

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

A page's question-and-answer section. Pass the same pairs the page renders: describing
answers a visitor cannot find on the page violates Google's structured-data policy, not
merely the reader's expectations.

```typescript
seo.schema.faq([{ question: t("faq.pricing.q"), answer: t("faq.pricing.a") }]);
```

#### `seo.schema.softwareApplication(input): SchemaOrg.SoftwareApplication`

A product or capability page whose subject is the software itself.

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
is one a sales page either knows or should leave out rather than invent. The byline
behaves as `article`'s, a single cover image is normalized into a list, and `bookFormat`
takes a schema.org enumeration URL so a typo cannot compile. Pass an array to `offers`
when the book is sold as more than one package: each price is its own `Offer`, and a
single offer is accepted and normalized into the same list.

```typescript
seo.schema.book({
	name: "Álem",
	author: { name: "Sergio", url: "/about" },
	description: t("book.description"),
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

`remix/ui` component emitting a page's whole head contribution: the `Seo.Meta` tag set,
plus a `Seo.JsonLd` script when `schema` is given.

**Props:**

- Everything `Seo.Meta` accepts
- `schema?`: `SchemaOrg.Node | SchemaOrg.Node[]` - Structured data for the page

**Example:**

```tsx
<Seo title={title} canonical={seo.canonical(ctx.url)} site={seo.site} schema={article} />
```

### `Seo.Meta`

`remix/ui` component emitting the title, description, canonical link, robots directives,
and the Open Graph and Twitter tag sets. Both social namespaces restate the title and
description, because every consumer of these cards reads its own namespace and ignores
the other's. A tag whose input is missing is skipped entirely, so a page never advertises
an empty title or description.

**Props:**

- `title?`: `string` - The page title, already localized
- `description?`: `string` - Meta description. Falls back to `site.description`
- `canonical`: `string` - The page's canonical absolute URL, from `seo.canonical()`
- `site?`: `SeoSite` - Site identity, from `seo.site`
- `og?`: `Seo.OpenGraph` - `type`, `image`, `imageAlt`, and `locale`
- `robots?`: `string` - Content from `seo.robotsTag()`

**Example:**

```tsx
<Seo.Meta
	title={title}
	description={description}
	canonical={seo.canonical(ctx.url)}
	site={seo.site}
	og={{ type: "article", image: seo.absolute("/og/cover.png") }}
/>
```

### `Seo.JsonLd`

`remix/ui` component emitting structured data as one `application/ld+json` script.
Several nodes go into a single script as an array, which is valid and far easier to audit
than several scripts. The JSON is set through `innerHTML`, since JSX escapes text nodes
and would leave the data unparseable.

**Props:**

- `schema`: `SchemaOrg.Node | SchemaOrg.Node[]` - The nodes to serialize

**Example:**

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

#### `SchemaOrg`

Namespace of the node shapes the builders return (`SchemaOrg.Organization`,
`SchemaOrg.Article`, `SchemaOrg.BreadcrumbList`, …), their nested types
(`SchemaOrg.ListItem`, `SchemaOrg.Offer`, …), and the inputs the builders accept
(`SchemaOrg.ArticleInput`, …). `SchemaOrg.Node` is the union of every top-level node, and
is what serialization accepts.

## Pattern: One Instance Per Site

The configuration is read once at boot, so build the instance once and share it rather
than calling the factory per request.

```typescript
import { createSeo } from "@pkg/seo";
import { env } from "cloudflare:workers";

/** The site's one SEO instance, shared by every controller and layout. */
export const SEO = createSeo({
	baseUrl: env.BASE_URL,
	siteName: "Example",
	defaultDescription: "…",
	twitter: { site: "@example" },
});
```

Where an app resolves its dependencies through a container, register that instance there
instead, so controllers receive it by injection rather than importing a module value.

## Pattern: A Document Layout That Takes Metadata As Input

Let the layout accept the metadata input and pass it straight through, so each page
decides its own copy and structured data while the tag set stays identical everywhere.

```tsx
import { Seo } from "@pkg/seo";

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

Signed-in screens and thin filtered views should say so per page; site-wide crawl policy
belongs in `robots.txt`, not here.

```tsx
<Seo.Meta
	canonical={seo.canonical(ctx.url)}
	robots={seo.robotsTag({ index: false, follow: true })}
/>
```

## Related Packages

- [`@pkg/sitemap`](/packages/sitemap) - XML sitemaps, the crawl-side sibling of this metadata
- [`@pkg/rss`](/packages/rss) - RSS feeds, built from the same absolute URLs
- [`@pkg/service-container`](/packages/service-container) - Registration for the one configured instance

## Tips

1. **Pass `ctx.url` straight to `canonical()`** - the point of the function is that the serving host does not matter, so there is nothing to normalize first.
2. **Build social images with `absolute()`** - `og:image` and `twitter:image` are rejected as relative paths by most consumers.
3. **Only describe what the page renders** - an `FAQPage` node whose answers are nowhere on the page is a structured-data policy violation, not a shortcut to rich results.
4. **Prefer one script over several** - pass an array to `Seo.JsonLd`; multiple scripts are valid but harder to audit.
5. **Compare head output when adopting** - a canonical or `og:url` regression is invisible to a test that only checks status codes.
6. **Add a builder rather than a literal** - the typed set is deliberately partial, and a new page type is a small reviewed change.
