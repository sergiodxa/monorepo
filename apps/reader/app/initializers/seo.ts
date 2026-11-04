/**
 * The site's configured SEO instance: canonical URLs, absolute asset URLs and the
 * schema.org builders every public page's head is resolved through, all naming the
 * origin and publisher in `config/site.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@sdxc/seo";

import { createSeo } from "@sdxc/seo";

import { OG_LOCALES, PUBLISHER, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/site";

/**
 * The site's one SEO instance. There is no site Twitter account, and no social
 * card image, so the card stays a summary and pages omit `og:image`.
 *
 * @example SEO.canonical(ctx.url) // "https://reader.sergiodxa.com/features/search"
 */
export const SEO = createSeo({
	baseUrl: SITE_URL,
	siteName: SITE_NAME,
	defaultDescription: SITE_DESCRIPTION,
	twitter: { card: "summary" },
});

/** What a public product page contributes to its `SoftwareApplication` node. */
export interface ProductSchemaInput {
	/** The product or capability the page is about. */
	name: string;
	/** The page's own meta description, reused as the node's description. */
	description: string;
	/** The page's path, resolved through the canonical rules. */
	url: string;
	/** Capabilities this page itself shows, so the node stays within the page. */
	featureList?: string[];
	/** The price the page states. Omit when the page names no price. */
	offer?: SchemaOrg.OfferInput;
}

/**
 * The `og:locale` for a request language, falling back to the language tag when a
 * page is served in a language the map does not name.
 *
 * @param locale - The request's `ctx.locale`.
 * @returns The Open Graph locale, such as `"en_US"`.
 */
export function openGraphLocale(locale: string): string {
	return OG_LOCALES[locale] ?? locale;
}

/**
 * The publisher node the home page carries. The URL is the site origin, because a
 * publisher URL is resolved like a page URL, and the profiles stay in `sameAs`.
 *
 * @returns The organization node.
 */
export function publisherSchema(): SchemaOrg.Organization {
	return SEO.schema.organization({
		name: PUBLISHER.name,
		sameAs: [...PUBLISHER.sameAs],
	});
}

/**
 * The `SoftwareApplication` node for a page about Reader or one capability of it.
 * It is a web application that runs in a browser; a page that states a price passes
 * it as `offer`, and one that does not advertises none.
 *
 * @param input - The page's name, description, path and the capabilities it shows.
 * @returns The node, with the page URL already canonical.
 */
export function productSchema(input: ProductSchemaInput): SchemaOrg.SoftwareApplication {
	return SEO.schema.softwareApplication({
		name: input.name,
		description: input.description,
		applicationCategory: "WebApplication",
		operatingSystem: "Any",
		url: input.url,
		...(input.featureList && { featureList: input.featureList }),
		...(input.offer && { offers: input.offer }),
	});
}
