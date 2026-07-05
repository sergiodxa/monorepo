import type { OIDCConfig } from "../../auth/oidc";

import middleware from "../lib/middleware";

/** Attaches the engine's OIDC relying-party config to the context as `ctx.oidc`. */
export default (config: OIDCConfig) =>
	middleware((context, next) => {
		context.oidc = config;
		return next();
	});

declare module "remix/fetch-router" {
	export interface RequestContext {
		oidc: OIDCConfig;
	}
}
