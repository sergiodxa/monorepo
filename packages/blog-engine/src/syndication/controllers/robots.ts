/**
 * Controller for `/robots.txt`, allowing all crawlers and pointing them at the
 * sitemap. The sitemap URL is derived from the request origin so it works on any host
 * or subdomain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { text } from "@pkg/http/response";
import { createAction } from "remix/router";

import routes from "../../routes";

/** Serves `/robots.txt` pointing crawlers at the sitemap (URL derived per request). */
export default createAction(routes.robots, async ({ request }) => {
	let origin = new URL(request.url).origin;
	let body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
	return text(body);
});
