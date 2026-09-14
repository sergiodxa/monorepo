/**
 * Where the transaction level of the context merge comes from: the contract an
 * API instance calls, and the implementation this package ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { EvaluationContext } from "../core/context.js";

/**
 * Carries context for the work in flight, so code that learns something about
 * the subject halfway through a request has somewhere to put it and every
 * evaluation underneath reads it without being handed anything.
 */
export interface TransactionContextPropagator {
	/** The context of the transaction this call runs inside, or nothing outside one. */
	getTransactionContext(): EvaluationContext | undefined;
	/** Runs `callback` with `context` current, restoring what was current before. */
	setTransactionContext<T>(context: EvaluationContext, callback: () => T): T;
}

/**
 * The propagator backed by `AsyncLocalStorage`, which is what lets a nested
 * call see the context an outer one set without threading it through every
 * signature in between.
 *
 * @example flags.setTransactionContext({ targetingKey: user.id }, () => next());
 */
export function asyncLocalStoragePropagator(): TransactionContextPropagator {
	let storage = new AsyncLocalStorage<EvaluationContext>();

	return {
		getTransactionContext() {
			return storage.getStore();
		},
		setTransactionContext(context, callback) {
			return storage.run(context, callback);
		},
	};
}
