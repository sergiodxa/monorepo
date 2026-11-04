/**
 * The site's `@sdxc/seo` instance and the structured data for its one public HTML
 * page. Every canonical URL, social tag and schema.org node names the production
 * origin, whichever host served the request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@sdxc/seo";

import { createSeo } from "@sdxc/seo";

import { OPERATIONS } from "~/config/catalog";
import {
	AUTHOR_NAME,
	AUTHOR_PROFILES,
	AUTHOR_X_HANDLE,
	SITE_BRAND,
	SITE_DESCRIPTION,
	SITE_ORIGIN,
	SITE_TITLE,
} from "~/config/site";

/**
 * Resolves canonical URLs onto {@link SITE_ORIGIN} and binds the schema.org builders
 * to the landing's name and description. The Twitter card is `summary`, the layout
 * that fits a title and description.
 *
 * @example seo.canonical(ctx.url) // "https://api.sdxc.dev/"
 */
export const seo = createSeo({
	baseUrl: SITE_ORIGIN,
	siteName: SITE_BRAND,
	defaultDescription: SITE_DESCRIPTION,
	twitter: { site: AUTHOR_X_HANDLE, creator: AUTHOR_X_HANDLE, card: "summary" },
});

/**
 * Structured data for the public landing: the publisher, the site, the page itself
 * and the API. The application node lists the capabilities the catalog table shows;
 * each row keeps its own USDC price in the table.
 */
export const LANDING_SCHEMA: SchemaOrg.Node[] = [
	seo.schema.organization({
		name: AUTHOR_NAME,
		url: "/",
		sameAs: [...AUTHOR_PROFILES],
	}),
	seo.schema.website({ url: "/" }),
	seo.schema.webPage({
		name: SITE_TITLE,
		description: SITE_DESCRIPTION,
		url: "/",
		inLanguage: "en",
	}),
	seo.schema.softwareApplication({
		name: SITE_BRAND,
		description: SITE_DESCRIPTION,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Any",
		url: "/",
		featureList: OPERATIONS.map((operation) => operation.description),
	}),
];
