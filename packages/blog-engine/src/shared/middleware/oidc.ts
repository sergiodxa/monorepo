/**
 * Middleware that attaches the engine's OIDC config and the request's relying-party
 * client to the request context, and the module augmentation that types them, so the auth
 * controllers read both straight off the request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Issuer } from "@sdxc/auth/issuer";
import type { RelyingParty } from "@sdxc/auth/relying-party";

import type { EngineAuthConfig } from "../../auth/oidc.js";

import { createRelyingParty } from "../../auth/oidc.js";
import middleware from "../lib/middleware.js";

/**
 * Attaches the blog's OIDC config as `ctx.oidc` and a client bound to this
 * request's hostname as `ctx.relyingParty`.
 *
 * @param config - The blog's relying-party configuration.
 * @param issuer - The blog's issuer, shared by every request the engine serves.
 * @returns The middleware to install on the engine's router.
 */
export default (config: EngineAuthConfig, issuer: Issuer) =>
	middleware((context, next) => {
		context.oidc = config;
		context.relyingParty = createRelyingParty(issuer, config, context.url);
		return next();
	});

declare module "remix/router" {
	export interface RequestContext {
		oidc: EngineAuthConfig;
		relyingParty: RelyingParty;
	}
}
