/**
 * Request-logging middleware for platform routes. Attaches a per-request
 * {@link Logger} to the context, records the response, and guarantees logs are
 * flushed on both success and error paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Logger } from "@pkg/logger/request";

import middleware from "~/app/lib/middleware";

/**
 * Logger middleware for platform routes.
 * Creates a Logger for each request.
 * Ensures logs are flushed even on errors.
 *
 * @returns The downstream response, after recording it and flushing logs.
 * @throws Re-throws any downstream error after logging it as `unhandled_error`.
 * @example
 * router.use(logger);
 */
export default middleware(async (context, next) => {
	context.logger = new Logger(context.request);

	try {
		let response = await next();
		context.logger.response = response;
		context.logger.flush();
		return response;
	} catch (error) {
		context.logger.error("unhandled_error", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		context.logger.flush();
		throw error;
	}
});

declare module "remix/fetch-router" {
	export interface RequestContext {
		logger: Logger;
	}
}
