/**
 * Publishes the control plane's models as `ctx.models`, bound to the request's `ctx.db`. It
 * reads `ctx.db` on the first model access, so it runs after `database()`, and a request that
 * touches no model binds nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { models as publishModels } from "@sdxc/data-model/router";

import type { Models } from "~/app/models";

import { models as registry } from "~/app/models";

declare module "remix/router" {
	interface RequestContext {
		/** The control plane's models, bound to `ctx.db` by the `models()` middleware. */
		models: Models;
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
