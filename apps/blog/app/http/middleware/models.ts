/**
 * Middleware publishing the blog's models as `ctx.models`, bound to the request's database.
 * It reads `ctx.db` on the first model access, so it runs after `database()`, and a request
 * that touches no model binds nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { models as publishModels } from "@sdxc/data-model/router";

import { models } from "~/app/models";

declare module "remix/router" {
	interface RequestContext {
		/** The blog's models, bound to `ctx.db` by the global `models()` middleware. */
		models: BoundRegistry<typeof models>;
	}
}

/**
 * Creates the middleware; install it after `database()`, whose `ctx.db` it binds to.
 *
 * @example createRouter({ middleware: [database(createDatabase), modelsMiddleware()] });
 */
export default function modelsMiddleware() {
	return publishModels(models, (ctx) => ({ db: ctx.db }));
}
