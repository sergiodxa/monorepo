/**
 * Controller for `/robots.txt`: every crawler may read the public site, the CMS and auth
 * routes are disallowed since they sit behind a login and only answer a crawler with
 * redirects, and the sitemap URL comes from the request origin so it works on any host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Action } from "remix/router";

import { text } from "@sdxc/http/response";
import { stringify } from "@sdxc/robots";
import { createAction } from "remix/router";

import routes from "../../routes.js";

/**
 * Serves `/robots.txt`, pointing crawlers at the sitemap and away from `/cms` and `/auth/`.
 * The rules stop at the segment boundary, so a post type whose path merely starts with
 * `cms` or `auth` (`/authors`) stays crawlable.
 */
const robotsController: Action<typeof routes.robots> = createAction(
	routes.robots,
	async ({ request }) => {
		let origin = new URL(request.url).origin;
		let body = stringify({
			groups: [
				{
					userAgents: ["*"],
					rules: [
						{ allow: true, pattern: "/" },
						{ allow: false, pattern: "/cms$" },
						{ allow: false, pattern: "/cms/" },
						{ allow: false, pattern: "/auth/" },
					],
				},
			],
			sitemaps: [new URL(routes.sitemap.href(), origin).toString()],
			records: [],
		});
		return text(body);
	},
);

export default robotsController;
