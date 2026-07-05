import type { Logger } from "@pkg/logger/request";

import middleware from "../lib/middleware";

/** Attaches a request-scoped logger to the context as `ctx.logger`. */
export default (logger: Logger) =>
	middleware((context, next) => {
		context.logger = logger;
		return next();
	});

declare module "remix/fetch-router" {
	export interface RequestContext {
		logger: Logger;
	}
}
