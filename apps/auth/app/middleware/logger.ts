/**
 * Logger middleware for the auth app. Installs a batched logger into the
 * request context and exposes helpers to read it back, including a convenience
 * `logger` object with `info`/`error` methods so any module can emit structured
 * log events tied to the current request without threading the logger through.
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
