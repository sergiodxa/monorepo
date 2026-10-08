/**
 * Lands a test visitor on a page the way a browser follows a campaign link, and hands back
 * the attribution cookie the response set, so a later form post or checkout in the same
 * test carries the campaign exactly as a returning browser would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fetchApp } from "~/app/lib/test/router";

/** A desktop browser's `User-Agent`, since the middleware records nothing for an automated client. */
export const BROWSER =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Requests a page as a document navigation and keeps the cookie it set.
 *
 * @param path - The landing URL, usually carrying `utm_*` parameters.
 * @returns The `Cookie` header value to send on the visitor's next request.
 * @throws {Error} When the page set no attribution cookie.
 * @example let cookie = await landFrom("/?utm_source=newsletter&utm_campaign=launch");
 */
export async function landFrom(path: string): Promise<string> {
	let response = await fetchApp(path, {
		headers: { accept: "text/html", "sec-fetch-dest": "document", "user-agent": BROWSER },
	});
	let cookie = response.headers.getSetCookie().find((header) => header.startsWith("attribution="));
	if (!cookie) throw new Error(`${path} set no attribution cookie`);
	return cookie.split(";")[0] ?? "";
}
