/**
 * Middleware that attaches the request-scoped {@link Logger} to the context as
 * `ctx.logger`, and the module augmentation that types it, so controllers can log
 * against the per-request logger created in `index.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Logger } from "@sdxc/logger/request";

import middleware from "../lib/middleware.js";

/** Attaches a request-scoped logger to the context as `ctx.logger`. */
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
