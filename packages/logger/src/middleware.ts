/**
 * Request-logging middleware. Attaches a per-request {@link Logger} to the context as
 * `ctx.logger`, records the response on it, and flushes on both the success and the
 * error path, so handlers log through the request logger instead of the console.
 *
 * The module augmentation that types `ctx.logger` ships from this file rather than an
 * ambient `.d.ts`, because an ambient declaration is not pulled in transitively: a
 * consumer only gets the type by importing the middleware it comes with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Logger } from "./request-logger";

declare module "remix/router" {
	interface RequestContext {
		/** The request-scoped logger, flushed once the response is settled. */
		logger: Logger;
	}
}

/**
 * Creates a `Logger` for each request and flushes it once the request completes.
 *
 * @returns The downstream response, after recording it and flushing logs.
 * @throws Re-throws any downstream error after logging it as `unhandled_error`.
 * @example
 * createRouter({ middleware: [logger] });
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
