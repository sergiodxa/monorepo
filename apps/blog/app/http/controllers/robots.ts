/**
 * `GET /robots.txt` — lets every crawler fetch every path, states the site's AI usage
 * preferences as an IETF AI Preferences `Content-Usage` rule, and points crawlers at the
 * canonical sitemap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Robots } from "@sdxc/robots";

import { text } from "@sdxc/http/response";
import { stringify } from "@sdxc/robots";
import { createAction } from "remix/router";

import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * The site-wide usage preferences: search engines may index and link to every page, and every
 * other category stays unstated.
 */
const USAGE_PREFERENCES: Robots.UsagePreferences = { search: true };

/** Answers the file for every host, with the sitemap always at the canonical origin. */
export default createAction(routes.robots, () => {
	let body = stringify({
		groups: [
			{
				userAgents: ["*"],
				rules: [{ allow: true, pattern: "/" }],
				contentUsage: [{ preferences: USAGE_PREFERENCES }],
			},
		],
		sitemaps: [new URL(routes.sitemap.href(), PROFILE.canonical.origin).toString()],
		records: [],
	});

	return text(body, { headers: { "Cache-Control": "public, max-age=3600" } });
});
