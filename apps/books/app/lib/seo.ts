/**
 * The site's configured SEO instance: canonical URLs, absolute asset URLs, and the
 * schema.org builders every page's head metadata is resolved through. Configured once
 * here so no view restates the origin, the site name, or the default description.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSeo } from "@pkg/seo";

/**
 * The canonical origin. Forced onto every canonical URL, so the `workers.dev`
 * subdomain the app is verified on before cutover never advertises itself as
 * canonical, and neither does a preview deployment.
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
