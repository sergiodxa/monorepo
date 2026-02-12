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
