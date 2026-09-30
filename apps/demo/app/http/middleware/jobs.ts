/**
 * Middleware that gives a request `ctx.jobs` and runs whatever it enqueued once the response
 * is decided. The board's queue lives in memory, so nothing outside this invocation would
 * ever claim the message; draining here is what makes the work happen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { jobEnqueuer } from "@sdxc/jobs/router";

import { createDispatcher, drain } from "~/app/jobs/dispatcher";

/**
 * Creates middleware publishing `ctx.jobs` over a queue of the request's own, then running
 * what a handler enqueued through the dispatcher that queue belongs to.
 *
 * @param openDatabase Opens the database each job run reads through.
 */
export default function jobs(openDatabase: () => DataTable): Middleware {
	return async (ctx, next) => {
		let runtime = createDispatcher(openDatabase);

		let response = await jobEnqueuer(runtime.queue)(ctx, next);
		await drain(runtime);

		return response;
	};
}
