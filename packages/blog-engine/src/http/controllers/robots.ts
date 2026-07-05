import { text } from "@pkg/http/response";

import action from "../../shared/lib/action";

/** Serves `/robots.txt` pointing crawlers at the sitemap (URL derived per request). */
export default action<"GET", "/robots.txt">(async ({ request }) => {
	let origin = new URL(request.url).origin;
	let body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
	return text(body);
});
