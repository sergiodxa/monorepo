/**
 * Drizzle middleware for the auth app. Lazily instantiates a single Drizzle
 * database client over the D1 binding per request via a singleton middleware and
 * exposes a `db()` accessor, so handlers and models share one connection drawn
 * from the request context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createSingletonMiddleware } from "remix-utils/middleware/singleton";

import database from "~/db";
import { getContext } from "~/middleware/context-storage";

const [drizzleMiddleware, getDBFromContext] = createSingletonMiddleware({
	instantiator() {
		return database(env.DB);
	},
});

export function db() {
	let context = getContext();
	return getDBFromContext(context);
}

export { drizzleMiddleware };
