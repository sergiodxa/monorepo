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
