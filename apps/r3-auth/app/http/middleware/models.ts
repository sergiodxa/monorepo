/**
 * Publishes the authorization server's models as `ctx.models`, bound to the request's
 * database. It reads `ctx.db` on the first model access, so it runs after `database()`, and
 * a request that touches no model binds nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { models as publishModels } from "@sdxc/data-model/router";

import type { AuthModels } from "~/app/models";

import { models as registry } from "~/app/models";

declare module "remix/router" {
	interface RequestContext {
		/** The app's models, bound to `ctx.db` by the global `models()` middleware. */
		models: AuthModels;
	}
}

/**
 * Creates the middleware; install it after `database()`, whose `ctx.db` it binds to.
 *
 * @example createRouter({ middleware: [database(createDatabase), models()] });
 */
export function models() {
	return publishModels(registry, (ctx) => ({ db: ctx.db }));
}
