/**
 * Publishes the blog's Privacy Pass origin as `ctx.privacyPass`, challenging for tokens from
 * {@link PRIVACY_PASS_ISSUER} and keeping redemptions in the `CACHE` namespace. A test
 * installs its own instance, with a test issuer's keys and an in-memory store.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { PrivacyPass } from "@sdxc/privacy-pass";

import { KVRedemptionStore } from "~/app/models/privacy-pass-redemptions";

/**
 * Declared in this imported module, so the property exists wherever the middleware does.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Challenges for and redeems Privacy Pass tokens on the routes behind `privacyPass()`. */
		privacyPass: PrivacyPass;
	}
}

/**
 * The issuer whose tokens the blog accepts. Apple devices fetch tokens from it on their own
 * when answering a `PrivateToken` challenge, with no prompt for the visitor.
 */
export const PRIVACY_PASS_ISSUER = "demo-pat.issuer.cloudflare.com";

/**
 * Creates the middleware publishing `ctx.privacyPass`. The instance is built once per
 * isolate, so the issuer's keys are fetched once and reused until their `max-age` passes.
 *
 * @param env Environment bindings, read for the `CACHE` namespace.
 * @param instance The origin to publish in place of the default, as a test supplies.
 * @returns Middleware that sets `ctx.privacyPass` before the handler runs.
 */
export default function privacyPass(env: App.Env, instance?: PrivacyPass): Middleware {
	let resolved =
		instance ??
		new PrivacyPass({ issuer: PRIVACY_PASS_ISSUER, store: new KVRedemptionStore(env.CACHE) });

	return (ctx, next) => {
		ctx.privacyPass = resolved;
		return next();
	};
}
