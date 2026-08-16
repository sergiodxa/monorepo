/**
 * Middleware that publishes the host-provided analytics sink on the request context.
 *
 * Controllers emit authentication/registration events through `context.analytics`
 * so they stay decoupled from whichever (or no) analytics backend the host wired up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsSink } from "../../index";

import middleware from "../lib/middleware";

// Declared here (an imported module, not an ambient .d.ts) so the augmentation is
// applied in consuming projects that compile the provider's source.
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
