import { createLoggerMiddleware, getLoggerFromContext, type BatchedLogger } from "@pkg/logger";

import { getContext } from "./context-storage";

export const loggerMiddleware = createLoggerMiddleware();

export function getLogger(): BatchedLogger {
	return getLoggerFromContext(getContext());
}

export const logger = {
	info: (event: string, payload?: Record<string, unknown>) => getLogger().info(event, payload),
	warn: (event: string, payload?: Record<string, unknown>) => getLogger().warn(event, payload),
	error: (event: string, payload?: Record<string, unknown>) => getLogger().error(event, payload),
};
