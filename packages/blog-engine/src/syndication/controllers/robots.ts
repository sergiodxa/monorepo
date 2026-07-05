import { text } from "@pkg/http/response";
import { createAction } from "remix/fetch-router";

import routes from "../../routes";

/** Serves `/robots.txt` pointing crawlers at the sitemap (URL derived per request). */
export default createAction(routes.robots, async ({ request }) => {
	let origin = new URL(request.url).origin;
	let body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
	return text(body);
});
