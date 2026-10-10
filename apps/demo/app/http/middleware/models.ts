/**
 * Middleware publishing the board's models as `ctx.models`, bound to the request's database
 * and language. It reads both on the first model access, so it runs after `database()` and
 * the i18n middleware, and a request that touches no model binds nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundModels } from "@sdxc/data-model";
import type { Middleware } from "remix/router";

import { models as publishModels } from "@sdxc/data-model/router";

import { models } from "~/app/models";

declare module "remix/router" {
	interface RequestContext {
		/** The board's models, bound to `ctx.db` by the global `models()` middleware. */
		models: BoundModels<typeof models.entries>;
	}
}

/** Creates the middleware; install it after `database()`, whose `ctx.db` it binds to. */
export default function modelsMiddleware(): Middleware {
	return publishModels(models, (ctx) => ({ db: ctx.db, locale: ctx.locale })) as Middleware;
}
