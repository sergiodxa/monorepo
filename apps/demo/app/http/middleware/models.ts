/**
 * Middleware publishing the board's models as `ctx.models`, bound to the request's database.
 * It reads `ctx.db` on the first model access, so it runs after `database()`, and a request
 * that touches no model binds nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { models as publishModels } from "@sdxc/data-model/router";

import { models } from "~/app/models";

/**
 * MCP tools and controllers typed as `RequestContext` read the board's models too, and they see
 * only what `RequestContext` declares, so the property is declared here as `ctx.db` is.
 */
declare module "remix/router" {
	interface RequestContext {
		/** The board's models, bound to `ctx.db` by the global `models()` middleware. */
		models: BoundRegistry<typeof models>;
	}
}

/** Creates the middleware; install it after `database()`, whose `ctx.db` it binds to. */
export default function modelsMiddleware() {
	return publishModels(models, (ctx) => ({ db: ctx.db }));
}
