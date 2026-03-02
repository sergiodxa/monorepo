import { Logger } from "@pkg/logger/request";

import middleware from "~/lib/middleware";

/**
 * Logger middleware for platform routes.
 * Creates a Logger for each request.
 */
export default middleware((context, next) => {
	context.logger = new Logger(context.request);
	return next();
});

declare module "remix/fetch-router" {
	export interface RequestContext {
		logger: Logger;
	}
}
