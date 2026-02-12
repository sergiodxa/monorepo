import { createContext, type MiddlewareFunction, type RouterContextProvider } from "react-router";

import { BatchedLogger } from "./batched-logger";

type Getter = (context: RouterContextProvider | Readonly<RouterContextProvider>) => BatchedLogger;

/**
 * Creates a middleware that provides a BatchedLogger instance for each request.
 * The logger is stored in the React Router context and automatically flushed after the handler completes.
 */
export function createBatchedLoggerMiddleware(): [MiddlewareFunction<Response>, Getter] {
	let batchedLoggerContext = createContext<BatchedLogger>();

	return [
		async ({ request, context }, next) => {
			let logger = BatchedLogger.fromRequest(request);
			context.set(batchedLoggerContext, logger);

			try {
				return await next();
			} finally {
				logger.flush();
			}
		},
		/**
		 * Retrieves the BatchedLogger instance from the React Router context.
		 * Must be called within a request that has the logger middleware active.
		 */
		(context) => {
			let logger = context.get(batchedLoggerContext);
			if (logger) return logger;
			throw new Error(
				"Failed to find BatchedLogger in context. Did you forget to add batchedLoggerMiddleware?",
			);
		},
	];
}
