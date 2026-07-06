/**
 * Batched logging middleware for the app's request pipeline. Wires up
 * `createBatchedLoggerMiddleware`, exports the middleware, and provides a `logger()` accessor
 * that resolves the request-scoped `BatchedLogger` from context storage. Exists so route and
 * loader code can emit structured logs without threading a logger instance by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createBatchedLoggerMiddleware, type BatchedLogger } from "@pkg/logger";

import { getContext } from "./context-storage";

let [loggerMiddleware, getLoggerFromContext] = createBatchedLoggerMiddleware();
export { loggerMiddleware };

export function logger(): BatchedLogger {
	return getLoggerFromContext(getContext());
}
