/**
 * Middleware that publishes the host-provided analytics sink on the request context.
 *
 * Controllers emit authentication/registration events through `context.analytics`
 * so they stay decoupled from whichever (or no) analytics backend the host wired up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsSink } from "../../index.js";

import middleware from "../lib/middleware.js";

/**
 * Reaches consuming projects through their own compilation of this
 * imported file, keeping the `RequestContext` extension available
 * wherever this middleware is used.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Host-provided analytics sink (no-op when none was configured). */
		analytics: AnalyticsSink;
	}
}

/**
 * Attaches the host-provided analytics sink to the request context so
 * controllers can emit authentication/registration events without importing a
 * runtime-specific service.
 * @param sink - The analytics sink resolved from provider config.
 * @returns A router middleware that assigns the sink and continues the chain.
 * @example
 * router.use(analytics(config.analytics));
 */
export default (sink: AnalyticsSink) => {
	return middleware((context, next) => {
		context.analytics = sink;
		return next();
	});
};
