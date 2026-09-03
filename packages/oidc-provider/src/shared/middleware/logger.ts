/**
 * Middleware that publishes the request-scoped logger on the router context.
 *
 * The provider creates one {@link Logger} per request (see `index.ts`) and this
 * middleware exposes it as `context.logger` so any controller can log without
 * threading the logger through arguments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Logger } from "@sdxc/logger/request";

import middleware from "../lib/middleware.js";

/**
 * Builds a middleware that stores the given logger on the request context.
 * @param logger - The request-scoped logger to expose as `context.logger`.
 * @returns A router middleware that assigns the logger and continues the chain.
 * @example
 * router.use(logger(new Logger(request)));
 */
export default (logger: Logger) =>
	middleware((context, next) => {
		context.logger = logger;
		return next();
	});

declare module "remix/router" {
	export interface RequestContext {
		logger: Logger;
	}
}
