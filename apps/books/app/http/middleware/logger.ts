/**
 * Request-logging middleware. Attaches a per-request {@link Logger} to the context,
 * records the response, and guarantees logs are flushed on both the success and error
 * paths, so every handler logs through `ctx.logger` instead of the console.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/fetch-router";

import { Logger } from "@pkg/logger/request";

declare module "remix/fetch-router" {
	interface RequestContext {
		/** Logger scoped to the current request, flushed once it completes. */
		logger: Logger;
	}
}

/**
 * Creates a `Logger` for each request and flushes it once the request completes.
 *
 * @returns The downstream response, after recording it and flushing logs.
 * @throws Re-throws any downstream error after logging it as `unhandled_error`.
 * @example
 * createRouter({ middleware: [logger, ...] });
 */
export const logger: Middleware = async (ctx, next) => {
	ctx.logger = new Logger(ctx.request);

	try {
		let response = await next();
		ctx.logger.response = response;
		return response;
	} catch (error) {
		ctx.logger.error("unhandled_error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		throw error;
	} finally {
		ctx.logger.flush();
	}
};

export default logger;
