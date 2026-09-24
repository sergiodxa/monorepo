/**
 * The trace bound to the running invocation, kept in `AsyncLocalStorage` so an outbound call
 * or an enqueue deep inside the work can name the invocation's span as its parent without
 * being handed it. Outside an invocation there is no current trace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { TraceContext } from "./context.js";

const STORAGE = new AsyncLocalStorage<TraceContext>();

/**
 * The trace of the invocation this call runs inside, or `undefined` outside one, which is
 * what lets `inject()` write nothing when there is nothing to propagate.
 *
 * @example let traceId = currentTrace()?.traceId;
 */
export function currentTrace(): TraceContext | undefined {
	return STORAGE.getStore();
}

/**
 * Runs `fn` with `trace` as the current trace, restoring whatever was current before once it
 * returns. Nesting is what gives each job in a batch its own trace while the batch's stays
 * current around them.
 *
 * @param trace The trace to make current.
 * @param fn The work that reads it through {@link currentTrace}.
 * @returns What `fn` returned.
 * @example await runWithTrace(continueTrace(unwrap(parse(traceparent))), () => work());
 */
export function runWithTrace<T>(trace: TraceContext, fn: () => T): T {
	return STORAGE.run(trace, fn);
}
