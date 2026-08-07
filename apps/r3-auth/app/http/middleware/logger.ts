/**
 * Request-logging middleware. Attaches a per-request {@link Logger} to the context,
 * records the response, and flushes on both the success and the error path, so every
 * handler logs through `ctx.logger` instead of the console.
 *
 * Nothing logged here may carry a token, an authorization code, a client secret or
 * password material: this server's logs are the one place those values could leak
 * without an attacker touching the database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/fetch-router";

import { Logger } from "@pkg/logger/request";

declare module "remix/fetch-router" {
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
 * createRouter({ middleware: [asyncContext(), logger] });
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
