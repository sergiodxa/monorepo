import { createBatchedLoggerMiddleware, type BatchedLogger } from "@pkg/logger";

import { getContext } from "./context-storage";

let [loggerMiddleware, getLoggerFromContext] = createBatchedLoggerMiddleware();
export { loggerMiddleware };

export function logger(): BatchedLogger {
	return getLoggerFromContext(getContext());
}
