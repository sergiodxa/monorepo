/**
 * Middleware that gives a request a job dispatcher and runs whatever it enqueued once the
 * response is decided. The board's queue lives in memory, so nothing outside this
 * invocation would ever claim the message; draining here is what makes the work happen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

import type { Dispatcher } from "~/app/jobs/dispatcher";

import { createDispatcher, drain } from "~/app/jobs/dispatcher";

/** Where the request's dispatcher lives on the context, published as `ctx.jobs`. */
export const Jobs = createContextKey<Dispatcher>();

declare module "remix/router" {
	interface RequestContext {
		/** The dispatcher a handler enqueues through, published by the global `jobs()` middleware. */
		jobs: Dispatcher;
	}
}

/**
 * Creates middleware publishing `ctx.jobs` and running what a handler enqueued.
 *
 * @param openDatabase Opens the database each job run reads through.
 */
export default function jobs(openDatabase: () => DataTable): Middleware {
	return async (ctx, next) => {
		let runtime = createDispatcher(openDatabase);
		ctx.set(Jobs, runtime.dispatcher, { property: "jobs" });

		let response = await next();
		await drain(runtime);

		return response;
	};
}
