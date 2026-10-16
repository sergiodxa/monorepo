/**
 * The app's SEO instance: one configuration the document layout, the sitemap and robots.txt
 * resolve URLs through, so every published link names `SITE_URL` whichever host served it.
 */

import { createSeo } from "@sdxc/seo";

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/constants";

/** Canonical URLs drop the trailing slash and tracking parameters, matching the router's redirects. */
export const seo = createSeo({
	baseUrl: SITE_URL,
	siteName: SITE_NAME,
	defaultDescription: SITE_DESCRIPTION,
});
