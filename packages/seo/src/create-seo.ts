/**
 * The configured factory at the center of the package: one call binds a site's origin
 * and identity, and everything else — canonical URLs, absolute asset URLs, schema.org
 * builders, JSON-LD serialization, robots directives — reads from that one instance.
 * Every product value lives in the configuration, never in this package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RobotsOptions } from "./lib/robots";
import type { SchemaOrg, SeoSchema } from "./lib/schema";

import { serializeJsonLd } from "./lib/json-ld";
import { robotsDirectives } from "./lib/robots";
import { createSchemaBuilders } from "./lib/schema";
import { absoluteUrl, canonicalUrl, normalizeBaseUrl } from "./lib/urls";

/** Twitter card metadata for the site, unchanged from page to page. */
export interface SeoTwitter {
	/** The site's own handle, including the `@`, emitted as `twitter:site`. */
	site?: string;
	/** The default content author's handle, emitted as `twitter:creator`. */
	creator?: string;
	/** Card layout. Defaults to `"summary_large_image"`. */
	card?: "summary" | "summary_large_image";
}

/** Configuration for {@link createSeo}. Everything product-specific is here. */
export interface SeoConfig {
	/**
	 * The site's canonical base URL. Its origin is forced onto every canonical URL, so
	 * a preview deployment or `workers.dev` host never advertises itself as canonical.
	 */
	baseUrl: string | URL;
	/** Site name for `og:site_name` and for the nodes describing the site itself. */
	siteName: string;
	/** Description used when a page or node passes none of its own. */
	defaultDescription: string;
	/** Twitter handles and card layout. Omit entirely on a site with no presence there. */
	twitter?: SeoTwitter;
}

/** The site identity `Seo.Meta` needs, derived from {@link SeoConfig}. */
export interface SeoSite {
	/** Site name, emitted as `og:site_name`. */
	name: string;
	/** Description a page falls back to when it passes none. */
	description: string;
	/** Twitter handles and card layout, when the site has them. */
	twitter?: SeoTwitter;
}

/** A configured SEO instance. One per site, typically registered in the service container. */
export interface SeoService {
	/** The configured origin, with no trailing slash, every URL is resolved against. */
	readonly baseUrl: string;
	/** Site identity to hand to `Seo.Meta`, so a layout never restates it. */
	readonly site: SeoSite;
	/** Typed schema.org builders bound to this configuration. */
	readonly schema: SeoSchema;
	/**
	 * Resolves a request URL or path to the page's one canonical URL: configured origin,
	 * no trailing slash outside the root, query string preserved.
	 */
	canonical(url: string | URL): string;
	/** Resolves an asset path to an absolute URL, leaving already-absolute URLs alone. */
	absolute(path: string | URL): string;
	/** Builds the `robots` meta content for a page, e.g. `"noindex, follow"`. */
	robotsTag(options?: RobotsOptions): string;
	/**
	 * Serializes nodes for an `application/ld+json` script body, escaped so content can
	 * never close the script early. For JSX outside `remix/ui`; `remix/ui` pages use
	 * `Seo.JsonLd`.
	 */
	jsonLdString(schema: SchemaOrg.Node | SchemaOrg.Node[]): string;
}

/**
 * Creates the SEO instance a site resolves all of its head metadata through. The
 * configured `baseUrl` is reduced to its origin once, and every URL the instance
 * returns is built from that fixed origin, no matter which host served the request.
 *
 * @param config - The site's origin, name, default description, and Twitter handles.
 * @returns An instance exposing canonical URLs, schema builders, and serialization.
 * @example let seo = createSeo({ baseUrl: "https://example.com", siteName: "Example", defaultDescription: "..." });
 * @example seo.canonical("/features/monitors/") // "https://example.com/features/monitors"
 */
export function createSeo(config: SeoConfig): SeoService {
	let baseUrl = normalizeBaseUrl(config.baseUrl);

	let site: SeoSite = {
		name: config.siteName,
		description: config.defaultDescription,
		...(config.twitter && { twitter: config.twitter }),
	};

	let schemaBuilders = createSchemaBuilders({
		baseUrl,
		siteName: config.siteName,
		defaultDescription: config.defaultDescription,
	});

	return {
		baseUrl,
		site,
		schema: schemaBuilders,

		canonical(url) {
			return canonicalUrl(baseUrl, url);
		},

		absolute(path) {
			return absoluteUrl(baseUrl, path);
		},

		robotsTag(options) {
			return robotsDirectives(options);
		},

		jsonLdString(schema) {
			return serializeJsonLd(schema);
		},
	};
}
