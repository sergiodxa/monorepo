/**
 * The site's `@sdxc/seo` instance, built over the one origin and description in
 * `config/constants.ts`, so every canonical URL, absolute asset URL and head tag a page emits
 * names the same address whichever host served it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSeo } from "@sdxc/seo";

import { AUTHOR_X_HANDLE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/constants";

/** Resolves every canonical URL, absolute asset URL and head tag the site emits. */
export const seo = createSeo({
	baseUrl: SITE_URL,
	siteName: SITE_NAME,
	defaultDescription: SITE_DESCRIPTION,
	twitter: { site: AUTHOR_X_HANDLE, creator: AUTHOR_X_HANDLE },
});
