/**
 * Database middleware for the app's request pipeline. Uses `createSingletonMiddleware` to
 * lazily instantiate the Drizzle database over the Cloudflare `DB` binding once per request
 * and exposes a `db()` accessor that resolves it from context storage. Exists so route and
 * loader code can query the database without constructing a connection at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createSingletonMiddleware } from "remix-utils/middleware/singleton";

import database from "~/db";

import { getContext } from "./context-storage";

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
