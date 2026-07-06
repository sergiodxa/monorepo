/**
 * Logging middleware and accessor for the blog app. Installs a batched logger on
 * the request context and exposes getLogger() plus a small logger facade with
 * info/error methods, so any code path can emit structured, request-scoped log
 * events that are flushed together per request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createBatchedLoggerMiddleware, type BatchedLogger } from "@pkg/logger";

import { getContext } from "./context-storage";

let [loggerMiddleware, getLoggerFromContext] = createBatchedLoggerMiddleware();
export { loggerMiddleware };

export function getLogger(): BatchedLogger {
	return getLoggerFromContext(getContext());
}

export const logger = {
	info: (event: string, payload?: Record<string, unknown>) => getLogger().info(event, payload),
	error: (event: string, payload?: Record<string, unknown>) => getLogger().error(event, payload),
};
