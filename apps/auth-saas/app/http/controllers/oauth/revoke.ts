/**
 * `POST /oauth/revoke` — RFC 7009 token revocation: a client surrenders a refresh token
 * it holds and the grant behind it ends, authenticating the way it does at the token
 * endpoint, a public client by its `client_id` alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import routes from "~/routes/tenant";

import { resolveClientAuth, tokenError } from "./token";

/**
 * Revokes the presented token. Every request a client may make answers `200` with no body
 * once the token no longer works, whether or not it ever did (RFC 7009 §2.2).
 *
 * @param ctx - The request context (provides `tenantStub` and the parsed form).
 * @returns An empty `200`, or the caller's own authentication failure.
 * @example
 * router.map(routes.revoke, revoke);
 */
export default createAction(routes.revoke, async (ctx) => {
	let form = ctx.formData;

	let token = form.get("token");
	if (typeof token !== "string" || token.length === 0) {
		return tokenError(400, "invalid_request", "token is required.");
	}

	let clientAuth = resolveClientAuth(ctx.request, form);
	if (!clientAuth.ok) {
		return tokenError(clientAuth.status, clientAuth.error, clientAuth.description);
	}

	let hint = form.get("token_type_hint");
	let result = await ctx.tenantStub.revokeToken({
		token,
		tokenTypeHint: typeof hint === "string" ? hint : null,
		clientId: clientAuth.auth.clientId,
		clientSecret: clientAuth.auth.clientSecret,
		authScheme: clientAuth.auth.authScheme,
		now: Date.now(),
	});

	if (result.kind === "error") return tokenError(result.status, result.error, result.description);

	return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
});
