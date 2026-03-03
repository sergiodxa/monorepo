import { Logger } from "@pkg/logger/request";

import middleware from "~/lib/middleware";

/**
 * Logger middleware for platform routes.
 * Creates a Logger for each request.
 * Ensures logs are flushed even on errors.
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
