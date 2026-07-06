/**
 * Database middleware and accessor for the blog app. Uses a singleton middleware
 * to instantiate the Drizzle database client (bound to the D1 database from the
 * Worker bindings) once per request, and exposes getDB() so models and loaders
 * share a single connection instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSingletonMiddleware } from "remix-utils/middleware/singleton";

import database from "~/db";

import { getBindings } from "./bindings";
import { getContext } from "./context-storage";

const [drizzleMiddleware, getDBFromContext] = createSingletonMiddleware({
	instantiator() {
		return database(getBindings().db);
	},
});

export function getDB() {
	let context = getContext();
	return getDBFromContext(context);
}

export { drizzleMiddleware };
