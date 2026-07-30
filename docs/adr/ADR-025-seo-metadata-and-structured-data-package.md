# ADR-025: SEO Metadata And Structured Data Package

## Status

**Proposed** - 2026-07-29

## Background

Two applications independently implement the same head-of-document concerns: canonical URL resolution, Open Graph and Twitter metadata, and schema.org JSON-LD builders. One keeps them in an app library module that also hardcodes the product's base URL and description; the other builds them inside route query modules.

The monorepo already has packages for the other machine-readable outputs of a site, feeds and sitemaps. Structured data and metadata are the missing sibling.

## Context

### Current State

| Location                                        | What it does                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `apps/r3-uptime/app/lib/seo.ts`                 | `canonicalUrl()`, `BASE_URL`, and Organization/WebSite/page schemas |
| `apps/r3-uptime/resources/layouts/document.tsx` | Emits `seo.jsonLd` into the document head                           |
| `apps/r3-uptime` marketing and docs controllers | Each chooses a schema builder per page                              |
| `apps/blog` post-type query modules             | Article-style structured data on the React Router stack             |
| `packages/sitemap`, `packages/rss`              | The already-extracted machine-readable outputs                      |

### Issues Identified

| Issue                                              | Impact                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Canonical URL logic duplicated                     | Two implementations of trailing-slash and host normalization rules         |
| Schema builders are untyped object literals        | A misspelled `@type` or missing required property fails silently in search |
| Base URL and site description are module constants | The code cannot move to a package without carrying one product's identity  |
| Metadata tags are hand-written per layout          | Open Graph and Twitter tags drift between pages                            |
| JSON-LD serialization is per call site             | Script-closing sequences inside content are an escaping hazard             |

## Decision

Create `@pkg/seo`: a configured factory producing canonical URLs, typed schema.org builders, and `remix/ui` head elements, with no product identity inside the package.

### 1. Configured Factory

```ts
let seo = createSeo({
	baseUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "...",
	twitter: { site: "@example" },
});
```

Every product value that is currently a module constant becomes configuration. Apps construct one instance, typically registered in `@pkg/service-container` (ADR-008).

### 2. Canonical URLs

```ts
seo.canonical("/features/monitors/"); // "https://example.com/features/monitors"
seo.canonical(request.url); // same, whatever host served the request
seo.absolute("/og/cover.png"); // absolute asset URL
```

The rules the existing implementation encodes are kept: force the configured origin regardless of the serving host (custom domain, workers.dev, preview deployment), drop the trailing slash everywhere except the root, and preserve the query string. Preview deployments therefore never advertise themselves as canonical.

### 3. Typed Structured Data

```ts
seo.schema.organization({ name, url, logo });
seo.schema.website({ searchAction });
seo.schema.webPage({ name, description, url });
seo.schema.article({ headline, datePublished, dateModified, author, image });
seo.schema.breadcrumbs([
	{ name, url },
	{ name, url },
]);
seo.schema.faq([{ question, answer }]);
seo.schema.softwareApplication({ name, applicationCategory, offers });
```

Builders are typed interfaces rather than free-form records, so required properties are enforced at compile time and `@context` and `@type` cannot be misspelled. The package models only the types the sites use; adding one is a small, reviewed change rather than a pasted literal.

### 4. Head Elements As `remix/ui`

```tsx
<head>
	<Seo.Meta
		title={title}
		description={description}
		canonical={seo.canonical(ctx.url)}
		og={{ type: "article", image }}
	/>
	<Seo.JsonLd schema={[organization, article, breadcrumbs]} />
</head>
```

`Seo.Meta` emits title, description, canonical link, Open Graph, and Twitter tags from one input. `Seo.JsonLd` serializes one or many schema objects into a single `application/ld+json` script, escaping the sequences that would otherwise let content break out of the script element.

React Router applications can use the same builders and serialize with `seo.jsonLdString(schemas)` where JSX is not `remix/ui`.

### 5. Robots Directives

```ts
seo.robotsTag({ index: false, follow: true }); // "noindex, follow"
```

Per-page `robots` directives, which are a head concern. Site-wide crawl policy stays in the blog engine, which owns the `robots.txt` route.

## Consequences

### Positive

- **One canonical implementation** - host and trailing-slash normalization stops being decided twice.
- **Typed schemas** - structured data errors surface at compile time instead of in a search console weeks later.
- **Consistent social metadata** - every page emits the same tag set from the same input.
- **Safe serialization** - JSON-LD escaping is handled once.
- **Product-agnostic** - the package carries no base URL, site name, or description of its own.
- **Completes the family** - metadata joins feeds and sitemaps as extracted machine-readable output.

### Negative

- **Schema coverage is partial** - the package models what the sites need, so a new page type may need a builder added first.
- **Hand-written schema types** - a full schema.org type set is enormous; the curated subset is a deliberate maintenance trade.

### Neutral

- **Open Graph image generation is out of scope** - producing images is a separate concern and is not part of this decision.
- **Existing markup output can be identical** - adoption is a refactor, not a change in what search engines see, and should be verified as such.

## Implementation Plan

### Phase 1: Factory And URLs

**Priority:** High
**Estimated Effort:** 2 hours

1. `createSeo()`, `canonical()`, `absolute()`, `robotsTag()`, with tests covering preview hosts and trailing slashes.

### Phase 2: Schemas

**Priority:** High
**Estimated Effort:** 3 hours

1. Typed builders for the schema types the two sites use.
2. `jsonLdString()` with escaping tests.

### Phase 3: Components And Adoption

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `Seo.Meta` and `Seo.JsonLd` as `remix/ui` components.
2. Replace the app SEO module and the document layout wiring; verify rendered head output is unchanged.
3. Adopt the builders on the React Router blog through `jsonLdString()`.
4. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Use `schema-dts` For Types

Depend on a generated TypeScript definition of all of schema.org.

**Rejected because**: it is a very large type surface for the handful of types in use, and its deeply optional shapes provide little help in enforcing the properties that actually matter for a given page.

### 2. Keep SEO In Each App

Leave both implementations in place.

**Rejected because**: canonical URL rules are subtle and already diverging, and structured data mistakes are silent. This is exactly the kind of logic that benefits from one tested copy.

### 3. Include `robots.txt` Generation

Extend the package to build `robots.txt`.

**Rejected because**: the blog engine already owns that route, and the file is about crawl policy for a whole site rather than metadata for a document.

## References

- [schema.org](https://schema.org/)
- [Open Graph protocol](https://ogp.me/)
- [Google: Structured data general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [ADR-008: Service Container for Remix v3](./ADR-008-service-container-for-remix-v3.md)
- [ADR-017: README Package Description Source of Truth](./ADR-017-readme-package-description-source-of-truth.md)

## Current Progress

- [ ] Phase 1: Factory And URLs
- [ ] Phase 2: Schemas
- [ ] Phase 3: Components And Adoption

## Notes

- Page titles and descriptions are content, so they stay in the app's i18n layer; the package accepts them as input and never generates copy.
- Multiple JSON-LD objects belong in one script as an array; several separate scripts are valid but harder to audit.
- Adoption should compare rendered head output before and after per page type, since a canonical or `og:url` regression is invisible in tests that only check status codes.
