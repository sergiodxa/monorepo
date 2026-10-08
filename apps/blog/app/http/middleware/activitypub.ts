/**
 * Middleware publishing the blog's ActivityPub federation into request context as
 * `ctx.activityPub`, built over that request's database and job enqueuer, so a route
 * answers through it and a test installs a federation of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Federation } from "@sdxc/activitypub";
import type { Middleware, RequestContext } from "remix/router";

import { createContextKey } from "remix/router";

/** Where the federation lives on a request or job context, as `ctx.activityPub`. */
export const ActivityPub = createContextKey<Federation>();

declare module "remix/router" {
	interface RequestContext {
		/** The blog's federation, published on the routes that answer ActivityStreams. */
		activityPub: Federation;
	}
}

/**
 * Creates middleware that publishes the federation as `ctx.activityPub`. It runs after the
 * global `database()` and `jobEnqueuer()` middleware, whose `ctx.db` and `ctx.jobs` the
 * federation stores to and queues through.
 *
 * @param source Builds the federation for a request; it may import the service on demand,
 * so only a federating route loads it.
 * @example lazy(() => import("~/app/http/controllers/activitypub"), [activityPub(source)]);
 */
export default function activityPub(
	source: (ctx: RequestContext) => Federation | Promise<Federation>,
): Middleware {
	return async (ctx, next) => {
		ctx.set(ActivityPub, await source(ctx), { property: "activityPub" });
		return next();
	};
}
