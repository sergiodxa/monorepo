/**
 * The site's configured SEO instance: canonical URLs, absolute asset URLs, and the
 * schema.org builders every page's head metadata is resolved through, all naming the
 * origin, site name and description in `config/constants.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSeo } from "@sdxc/seo";

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/constants";

/**
 * The site's SEO instance.
 *
 * @example seo.canonical(ctx.url) // "https://books.sergiodxa.com/release"
 */
export const seo = createSeo({
	baseUrl: SITE_URL,
	siteName: SITE_NAME,
	defaultDescription: SITE_DESCRIPTION,
	twitter: { card: "summary_large_image" },
});
