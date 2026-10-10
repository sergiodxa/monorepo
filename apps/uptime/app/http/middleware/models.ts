/**
 * Middleware publishing uptime's models as `ctx.models`, bound to the request's database and
 * enqueuing through the request's `ctx.jobs`. It reads both on the first model access, so it
 * runs after `database()`, and a request that touches no model binds nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { models as publishModels } from "@sdxc/data-model/router";
import { Jobs } from "@sdxc/jobs/router";

import type { UptimeModels } from "~/app/models";

import { enqueuer } from "~/app/lib/queue";
import { models } from "~/app/models";

declare module "remix/router" {
	interface RequestContext {
		/** Uptime's models, bound to `ctx.db` by the global `models()` middleware. */
		models: UptimeModels;
	}
}

/**
 * Creates the middleware; install it after `database()`, whose `ctx.db` it binds to. A
 * router without `jobEnqueuer()`, such as a test's, enqueues through the module enqueuer.
 *
 * @example createRouter({ middleware: [database(createDatabase), modelsMiddleware()] });
 */
export default function modelsMiddleware(): Middleware {
	return publishModels(models, (ctx) => ({
		db: ctx.db,
		jobs: ctx.get(Jobs) ?? enqueuer,
	})) as Middleware;
}
