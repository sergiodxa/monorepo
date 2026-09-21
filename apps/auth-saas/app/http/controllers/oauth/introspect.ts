/**
 * `POST /api-keys/introspect` — the tenant's own backend verifies a presented
 * API key, authenticating itself the same way it would at the token endpoint,
 * and reads back the resolved subject, scopes and expiry rather than the
 * credential itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import routes from "~/routes/tenant";

import { resolveClientAuth, tokenError } from "./token";

/**
 * The introspection request's own body: the presented key under RFC 7662's
 * `token` name, plus a `client_id`/`client_secret` pair carried alongside it
 * for a caller authenticating with `client_secret_post` — the JSON-bodied
 * equivalent of the form fields `client_secret_post` reads at the token
 * endpoint.
 */
let IntrospectBodySchema = s.object({
	token: s.string(),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});

/**
 * Verifies a presented API key on the caller's own behalf. The caller
 * authenticates as a registered client first — `client_secret_basic` or
 * `client_secret_post`, the same two schemes the token endpoint accepts from
 * a confidential client — and only then does the key it presented get
 * resolved. Every way a key fails to resolve, from malformed to expired to
 * revoked to simply unknown, answers the same `{ active: false }` at `200`,
 * the one shape RFC 7662 asks an introspection response to collapse them
 * into; only a caller that fails its own authentication answers differently.
 *
 * @param ctx - The request context (provides `tenantStub` and `request`).
 * @returns The resolved subject, scopes and expiry as RFC 7662-shaped JSON,
 * or the caller's own authentication failure.
 * @example
 * router.map(routes.apiKeysIntrospect, introspect);
 */
export default createAction(routes.apiKeysIntrospect, async (ctx) => {
	let parsedBody = s.parseSafe(IntrospectBodySchema, await ctx.request.json().catch(() => null));
	if (!parsedBody.success) {
		return json(
			{
				error: "invalid_request",
				error_description: "A JSON body with a token field is required.",
			},
			{ status: 400 },
		);
	}

	let form = new FormData();
	if (parsedBody.value.client_id) form.set("client_id", parsedBody.value.client_id);
	if (parsedBody.value.client_secret) form.set("client_secret", parsedBody.value.client_secret);

	let clientAuth = resolveClientAuth(ctx.request, form);
	if (!clientAuth.ok)
		return tokenError(clientAuth.status, clientAuth.error, clientAuth.description);

	if (clientAuth.auth.authScheme === "none") {
		return tokenError(
			401,
			"invalid_client",
			"This endpoint requires the caller to authenticate with its registered credentials.",
		);
	}

	let authenticated = await ctx.tenantStub.authenticateClient({
		clientId: clientAuth.auth.clientId,
		clientSecret: clientAuth.auth.clientSecret,
		authScheme: clientAuth.auth.authScheme,
	});
	if (!authenticated.ok) {
		return tokenError(authenticated.status, "invalid_client", authenticated.description);
	}

	let resolved = await ctx.tenantStub.authenticateApiKey({
		presented: parsedBody.value.token,
		now: Date.now(),
	});
	if (!resolved.ok) return json({ active: false }, { status: 200 });

	return json(
		{
			active: true,
			sub: resolved.subjectId,
			scope: resolved.scopes.join(" "),
			exp: Math.floor(resolved.expiresAt / 1000),
		},
		{ status: 200 },
	);
});
