/**
 * The product's own SEO instance: one `@pkg/seo` configuration holding the canonical
 * origin, site name, and default description every `<head>` URL and schema.org node is
 * built from, plus the one builder whose defaults are product facts rather than page
 * input. Controllers and the document layout read their metadata through it, so the
 * product's identity is stated here and nowhere else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@pkg/seo";

import { createSeo } from "@pkg/seo";

/**
 * The site's one configured SEO instance: resolves canonical URLs onto the product's
 * origin regardless of which host served the request, and binds the schema.org builders
 * to the same identity. No `twitter.site`/`creator` handle, since there's no account.
 *
 * @example SEO.canonical(ctx.url) // "https://uptime.sergiodxa.com/features/monitors"
 */
export const SEO = createSeo({
	baseUrl: "https://uptime.sergiodxa.com",
	siteName: "Uptime",
	defaultDescription:
		"Usage-based uptime monitoring service. Monitor websites, APIs, DNS, SSL certificates, and cron jobs from multiple global regions.",
	twitter: { card: "summary_large_image" },
});

/** What a page contributes to its `SoftwareApplication` node — everything else is a product fact. */
export interface ProductSchemaInput {
	/** The product or capability the page is about, as the schema's `name`. */
	name: string;
	/** The page's own meta description, reused as the node's description. */
	description: string;
	/** The capabilities the page itself lists, so the node never claims features it doesn't show. */
	featureList?: string[];
}

/**
 * Builds the `SoftwareApplication` node for a page whose subject is the product or one
 * of its capabilities, filling in the facts that are the same on every such page: it's a
 * web application, it runs anywhere, and it is sold on the one usage-based plan.
 *
 * @param input - The page's own name, description, and rendered feature list.
 * @returns The node, with page URLs and prices already in schema.org's shapes.
 * @example getSoftwareApplicationSchema({ name: "Monitors", description: content.metaDescription })
 */
export function getSoftwareApplicationSchema(
	input: ProductSchemaInput,
): SchemaOrg.SoftwareApplication {
	return SEO.schema.softwareApplication({
		name: input.name,
		description: input.description,
		applicationCategory: "WebApplication",
		operatingSystem: "Any",
		offers: {
			price: "0",
			priceCurrency: "USD",
			description: "Usage-based pricing starting at $0/month",
		},
		...(input.featureList && { featureList: input.featureList }),
	});
}
