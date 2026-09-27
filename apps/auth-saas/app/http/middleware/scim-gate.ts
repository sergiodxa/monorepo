/**
 * Gates every `/scim/v2/*` resource route on a per-token write budget and
 * this tenant's own `scim` entitlement, both checked before the tenant
 * object is asked to do anything. The budget is enforced on the `sha256` of
 * the presented bearer token rather than the caller's address, since the
 * thing being throttled is one connection's own sync worker, not whichever
 * network it happens to call from — a throttled request never reaches the
 * object. The entitlement is read from the tenant's own local enforcement
 * record through `hasEntitlement`, the one RPC call this gate makes before
 * handing control to the route's own handler, which resolves the token
 * itself against the connection it authorizes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { errorResponse, ScimError } from "@sdxc/scim";
import { createContextKey } from "remix/router";

/** The feature slug a SCIM connection's own add-on is sold under. */
export const SCIM_FEATURE = "scim";

export const ScimTokenContext = createContextKey<string>();

declare module "remix/router" {
	interface RequestContext {
		/** The bearer token a `/scim/v2/*` request presented, already found well-formed. */
		scimToken: string;
	}
}

/** SHA-256 of a value, hex-encoded — the key admission control is keyed on. */
async function digestToken(value: string): Promise<string> {
	let hashed = await sha256(value);
	if (isFailure(hashed)) throw new Error("scim rate-limit key hashing failed");
	return Hex.encode(hashed.data);
}

export interface ScimGateOptions {
	/**
	 * Whether this route requires the `scim` entitlement outright. Defaults to
	 * `true`. A user's `DELETE` and its pure `active: false` deactivation are
	 * admitted whatever the billing state, because a lapsed invoice is a poor
	 * reason to leave an ex-employee's account open — those two routes pass
	 * `false` here and enforce the entitlement themselves, conditionally, once
	 * their own handler has seen what the request actually asks for.
	 */
	requireEntitlement?: boolean;
}

/**
 * Builds the SCIM gate for a `/scim/v2/*` resource route.
 *
 * @param limiter - The `RateLimit` binding this connection's writes share,
 * keyed on the presented token rather than the caller's address.
 * @param options - Whether this route's entitlement is checked here
 * unconditionally, or left to its own handler.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.scimUsersCreate, { middleware: [scimGate(env.MANAGEMENT_RATE_LIMITER)], handler });
 */
export function scimGate(limiter: RateLimit, options: ScimGateOptions = {}): Middleware {
	let requireEntitlement = options.requireEntitlement ?? true;

	return async (ctx, next) => {
		let authorization = ctx.request.headers.get("Authorization");
		if (!authorization?.startsWith("Bearer ") || authorization.length <= "Bearer ".length) {
			return errorResponse(new ScimError(401, "A bearer token is required."));
		}

		let token = authorization.slice("Bearer ".length);

		let key = await digestToken(token);
		let { success } = await limiter.limit({ key });
		if (!success) {
			return errorResponse(new ScimError(429, "This connection has exceeded its write budget."), {
				headers: { "Retry-After": "1" },
			});
		}

		if (requireEntitlement) {
			let { entitled } = await ctx.tenantStub.hasEntitlement({ feature: SCIM_FEATURE });
			if (!entitled) {
				return errorResponse(
					new ScimError(403, "SCIM provisioning is not entitled for this tenant."),
				);
			}
		}

		ctx.set(ScimTokenContext, token, { property: "scimToken" });
		return next();
	};
}
