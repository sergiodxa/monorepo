/**
 * `POST /oauth/introspect` — RFC 7662 introspection of the access and refresh tokens this
 * tenant issues, for an authenticated confidential client, answered as a signed JWT
 * (RFC 9701) when the caller's `Accept` asks for `application/token-introspection+jwt`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { INTROSPECTION_JWT_MEDIA_TYPE } from "~/app/models/tenant/introspection";
import routes from "~/routes/tenant";

import { resolveClientAuth, tokenError } from "./token";

/**
 * Whether an `Accept` header asks for the signed form: it lists the JWT media type with
 * a non-zero weight. Anything else, including no header, gets JSON.
 *
 * @param accept - The header value.
 */
export function acceptsSignedIntrospection(accept: string | null): boolean {
	if (accept === null) return false;

	return accept.split(",").some((range) => {
		let [type = "", ...params] = range.split(";").map((part) => part.trim().toLowerCase());
		if (type !== INTROSPECTION_JWT_MEDIA_TYPE) return false;
		let weight = params.find((param) => param.startsWith("q="));
		return weight === undefined || Number(weight.slice(2)) > 0;
	});
}

/**
 * Describes the presented token to the authenticated caller. A token this tenant does not
 * honor, or a refresh token issued to another client, is `{ "active": false }`.
 *
 * @param ctx - The request context (provides `tenantStub` and the parsed form).
 * @returns The description as JSON or a signed JWT, never cached, or the caller's own
 *   authentication failure.
 * @example
 * router.map(routes.tokenIntrospection, tokenIntrospection);
 */
export default createAction(routes.tokenIntrospection, async (ctx) => {
	let form = ctx.formData;

	let token = form.get("token");
	if (typeof token !== "string" || token.length === 0) {
		return tokenError(400, "invalid_request", "token is required.");
	}

	let clientAuth = resolveClientAuth(ctx.request, form);
	if (!clientAuth.ok) {
		return tokenError(clientAuth.status, clientAuth.error, clientAuth.description);
	}

	let authScheme = clientAuth.auth.authScheme;
	if (authScheme === "none") {
		return tokenError(
			401,
			"invalid_client",
			"Introspection requires the application to authenticate.",
		);
	}

	let hint = form.get("token_type_hint");
	let result = await ctx.tenantStub.introspectToken({
		token,
		tokenTypeHint: typeof hint === "string" ? hint : null,
		clientId: clientAuth.auth.clientId,
		clientSecret: clientAuth.auth.clientSecret,
		authScheme,
		signed: acceptsSignedIntrospection(ctx.request.headers.get("Accept")),
		now: Date.now(),
	});

	if (result.kind === "error") return tokenError(result.status, result.error, result.description);

	if (result.kind === "jwt") {
		return new Response(result.jwt, {
			status: 200,
			headers: { "Content-Type": INTROSPECTION_JWT_MEDIA_TYPE, "Cache-Control": "no-store" },
		});
	}

	return json(result.description, { status: 200, headers: { "Cache-Control": "no-store" } });
});
