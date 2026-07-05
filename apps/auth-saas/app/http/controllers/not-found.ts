/**
 * The application-wide 404 fallback handler, used when no route matches the
 * incoming request. Returns a plain `404 Not Found` response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import requestHandler from "~/app/lib/request-handler";

/**
 * Fallback handler for unmatched routes.
 *
 * @returns A plain-text `404 Not Found` response.
 * @example
 * // Wired as the router's default/not-found handler.
 * export default notFound;
 */
export default requestHandler(() => {
	return new Response("Not Found", { status: 404 });
});
