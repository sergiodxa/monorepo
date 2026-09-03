/**
 * Job middleware that gives every job its own cost ledger (ADR-007, ADR-019): the D1
 * statements, KV operations and queue writes it makes are counted against it and priced
 * for the teams it declares, and flushed once the job ends however it ended.
 *
 * Outermost in the chain, so everything the job's other middleware does — opening the
 * database included — is counted by the same ledger the handler records against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@pkg/jobs-next";

import { CostLedger, trackCost } from "~/app/services/cost";

/**
 * Opens, scopes and flushes the ledger for one delivery.
 *
 * @returns The middleware, for a dispatcher's chain.
 * @example createJobDispatcher({ middleware: [costLedger(), database()] });
 */
export function costLedger(): JobMiddleware {
	return async (ctx, next) => {
		let ledger = new CostLedger({
			handler: "queue",
			detail: ctx.name,
			/**
			 * The batch is one Worker invocation running every message in it, so each job owns
			 * one share of the single request the whole batch is billed as.
			 */
			workerRequests: ctx.batchSize > 0 ? 1 / ctx.batchSize : 1,
		});

		/** A delivered message costs one queue read and delete; each redelivery counts its own two. */
		ledger.record("queueOperation", 2);

		await trackCost(ledger, next);
	};
}
