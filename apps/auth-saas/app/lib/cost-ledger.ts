/**
 * The async-local ledger: one per unit of work — a `fetch` request, a queue message, a
 * scheduled job — so concurrent work in one invocation each gets its own with no
 * crosstalk, the same way `@sdxc/logger`'s `currentLog` carries a request's own log
 * without being handed it. A call site records through {@link recordCost}, a free
 * function that costs nothing on a path no ledger ever wraps; the invocation's own
 * middleware wraps its work in {@link runWithLedger} and calls {@link flush} once at the
 * end to price what accumulated and write it where it joins to revenue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { currentLog } from "@sdxc/logger";

import type { CostQuantities } from "./cost-rates";

import {
	COST_RESOURCES,
	createCostQuantities,
	MODELLED_CPU_MS_PER_HANDLER,
	priceCostQuantities,
	RATE_CARD_VERSION,
} from "./cost-rates";

/** The kind of invocation a ledger was opened for, the same handler classes the rate card models CPU for. */
export type LedgerSource = "fetch" | "queue" | "scheduled";

interface LedgerState {
	tenantId: string;
	source: LedgerSource;
	quantities: CostQuantities;
}

const STORAGE = new AsyncLocalStorage<LedgerState>();

/**
 * Adds to the running quantities of the ledger open around this call, or does nothing at
 * all outside one. A call site that never runs under a ledger — nothing wraps it yet, or
 * never will — costs exactly what it already costs, so instrumenting a new path never
 * requires guarding the call.
 *
 * @param quantities - However much of each resource this call consumed; a partial set is
 * fine.
 * @example recordCost({ kvReads: 1 });
 */
export function recordCost(quantities: Partial<CostQuantities>): void {
	let state = STORAGE.getStore();
	if (state === undefined) return;

	for (let resource of COST_RESOURCES) {
		let units = quantities[resource];
		if (units !== undefined) state.quantities[resource] += units;
	}
}

/**
 * Runs `fn` with a fresh ledger current, so every {@link recordCost} call underneath —
 * however deep, across however many awaited calls — adds to this one unit of work's own
 * quantities rather than nowhere.
 *
 * @param tenantId - The tenant this unit of work is attributed to, or `"platform"` for
 * scheduled work serving no particular tenant.
 * @param source - What kind of invocation this is, for the rate card's own modelled CPU.
 * @param fn - The unit of work; call {@link flush} from inside it, once, before it returns.
 * @returns Whatever `fn` returned.
 * @example
 * await runWithLedger(tenantId, "fetch", async () => {
 * 	let response = await router.fetch(request);
 * 	flush(env);
 * 	return response;
 * });
 */
export function runWithLedger<T>(tenantId: string, source: LedgerSource, fn: () => T): T {
	let state: LedgerState = { tenantId, source, quantities: createCostQuantities() };
	return STORAGE.run(state, fn);
}

/** What {@link flush} needs to write the invocation's one analytics data point. */
export interface FlushEnv {
	ANALYTICS: AnalyticsEngineDataset;
}

/**
 * Folds the request's own share and the handler class's modelled CPU into whatever
 * {@link recordCost} accumulated, prices the total, writes it as one analytics data
 * point indexed by tenant id, and logs the same totals on the invocation's own log. Does
 * nothing outside a ledger, the same as {@link recordCost}, and must run from inside the
 * {@link runWithLedger} call it reads its quantities from — once that call returns, there
 * is nothing left to fold.
 *
 * Catches and logs its own failure rather than rethrowing: instrumentation failing the
 * request it measures would be worse than no instrumentation.
 *
 * @param env - Where `ANALYTICS` is bound.
 */
export function flush(env: FlushEnv): void {
	let state = STORAGE.getStore();
	if (state === undefined) return;

	try {
		let quantities = { ...state.quantities };
		quantities.workerRequests += 1;
		quantities.workerCpuMs += MODELLED_CPU_MS_PER_HANDLER[state.source];

		let cents = priceCostQuantities(quantities);

		env.ANALYTICS.writeDataPoint({
			indexes: [state.tenantId],
			blobs: [state.source, state.tenantId, RATE_CARD_VERSION],
			doubles: [...COST_RESOURCES.map((resource) => quantities[resource]), cents],
		});

		currentLog()?.set({
			cost: {
				tenantId: state.tenantId,
				source: state.source,
				rateCardVersion: RATE_CARD_VERSION,
				cents,
			},
		});
	} catch (error) {
		currentLog()?.warn("cost.flush_failed", {
			message: error instanceof Error ? error.message : String(error),
		});
	}
}
