/**
 * `GET /robots.txt` — keeps crawlers on the public site and out of the signed-in app, its
 * form actions, the API and token-addressed pages, states the site's AI usage preferences,
 * and points crawlers at the sitemap on the production origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Robots } from "@sdxc/robots";

import { text } from "@sdxc/http/response";
import { stringify } from "@sdxc/robots";
import { createAction } from "remix/router";

import { APP_ORIGIN } from "~/config/origin";
import routes from "~/routes/web";

/**
 * The site-wide usage preferences: search engines may index and link to every public page, and
 * every other category stays unstated.
 */
const USAGE_PREFERENCES: Robots.UsagePreferences = { search: true };

/**
 * Path prefixes only a signed-in visitor, an API client or the holder of an emailed token
 * reaches; a crawler following one lands on a sign-in redirect or a private page.
 */
const PRIVATE_PREFIXES = [
	"/app/",
	"/actions/",
	"/api/",
	"/auth",
	"/logout",
	"/invite/",
	"/try/report/",
	"/unsubscribe/",
	"/digests/",
	"/webhooks/",
	"/reports/",
];

/** Answers the same file on every host, the sitemap always on the production origin. */
export default createAction(routes.robots, () => {
	let body = stringify({
		groups: [
			{
				userAgents: ["*"],
				rules: [
					{ allow: true, pattern: "/" },
					...PRIVATE_PREFIXES.map((pattern) => ({ allow: false, pattern })),
				],
				contentUsage: [{ preferences: USAGE_PREFERENCES }],
			},
		],
		sitemaps: [new URL(routes.sitemap.href(), APP_ORIGIN).toString()],
		records: [],
	});

	return text(body, { headers: { "Cache-Control": "public, max-age=3600" } });
});
