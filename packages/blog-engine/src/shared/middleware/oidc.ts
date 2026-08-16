/**
 * Middleware that attaches the engine's OIDC relying-party config to the request
 * context as `ctx.oidc`, and the module augmentation that types it. Lets auth
 * controllers read the provider config without threading it through every call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { EngineAuthConfig } from "../../auth/oidc";

import middleware from "../lib/middleware";

/** Attaches the engine's OIDC relying-party config to the context as `ctx.oidc`. */
export default (config: EngineAuthConfig) =>
	middleware((context, next) => {
		context.oidc = config;
		return next();
	});

declare module "remix/router" {
	export interface RequestContext {
		oidc: EngineAuthConfig;
	}
}
