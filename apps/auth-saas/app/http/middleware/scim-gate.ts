/**
 * Gates every `/scim/v2/*` resource route on a well-formed bearer token and a
 * per-token write budget, both checked before the tenant object is asked to do
 * anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { errorResponse, ScimError } from "@sdxc/scim";
import { createContextKey } from "remix/router";

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

/**
 * Builds the SCIM gate for a `/scim/v2/*` resource route.
 *
 * @param limiter - The `RateLimit` binding this connection's writes share, keyed on the presented token.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.scimUsersCreate, { middleware: [scimGate(env.MANAGEMENT_RATE_LIMITER)], handler });
 */
export function scimGate(limiter: RateLimit): Middleware {
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

		ctx.set(ScimTokenContext, token, { property: "scimToken" });
		return next();
	};
}
