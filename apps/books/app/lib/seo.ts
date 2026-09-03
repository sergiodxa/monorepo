/**
 * The site's configured SEO instance: canonical URLs, absolute asset URLs,
 * and the schema.org builders every page's head metadata is resolved
 * through, keeping the origin, site name, and default description
 * centralized here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSeo } from "@sdxc/seo";

/**
 * The canonical origin. Forced onto every canonical URL, so canonical links
 * always point here whether the request lands on the pre-cutover
 * `workers.dev` subdomain or a preview deployment.
 */
export const BASE_URL = "https://books.sergiodxa.com";

/** The Open Graph card image, published in newsletters and social posts already in the wild. */
export const OG_IMAGE_URL = `${BASE_URL}/og.jpg`;

/**
 * The site's SEO instance.
 *
 * @example seo.canonical(ctx.url) // "https://books.sergiodxa.com/release"
 */
export const seo = createSeo({
	baseUrl: BASE_URL,
	siteName: "React Router OAuth2 Handbook",
	defaultDescription:
		"A practical guide to implementing secure OAuth2 authentication in React Router and Remix applications.",
	twitter: { card: "summary_large_image" },
});
