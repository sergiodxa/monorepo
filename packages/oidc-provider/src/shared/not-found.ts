/**
 * The router's default handler, returning a plain 404 for unmatched routes.
 *
 * Registered as `defaultHandler` on the provider router (see `provider.ts`) so
 * unknown paths get a consistent `404 Not Found` instead of an error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import requestHandler from "./lib/request-handler";

/** Request handler that responds with a bare `404 Not Found`. */
export default requestHandler(() => {
	return new Response("Not Found", { status: 404 });
});
