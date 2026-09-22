/**
 * `POST /oauth/token` — the management API's own token endpoint: exchanges a
 * management client's id and secret for a short-lived access token about that
 * client, scoped to the tenant it was registered under. `client_credentials` is
 * the only grant this endpoint answers; it never issues a code or a refresh token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { resolveClientAuth, tokenError } from "~/app/http/controllers/oauth/token";
import { issueManagementClientCredentialsToken } from "~/app/services/management-token-grant";
import routes from "~/routes/management";

/**
 * Reads every `resource` field a form presented, per RFC 8707 §2.
 *
 * @param form - The parsed request body.
 * @returns Each presented value, in the order the caller sent them.
 */
function resources(form: FormData): string[] {
	return form.getAll("resource").filter((value): value is string => typeof value === "string");
}

/**
 * Exchanges a management client's credentials for an access token bound to its
 * own tenant.
 *
 * @param ctx - The request context (provides `db`).
 * @returns The minted access token as OAuth-shaped JSON with `Cache-Control:
 * no-store`, or the error the grant was refused for.
 * @example
 * router.map(routes.token, token);
 */
export default createAction(routes.token, async (ctx) => {
	let form: FormData;
	try {
		form = await ctx.request.formData();
	} catch {
		return tokenError(
			400,
			"invalid_request",
			"The request body must be application/x-www-form-urlencoded.",
		);
	}

	let grantType = form.get("grant_type");
	if (typeof grantType !== "string") {
		return tokenError(400, "invalid_request", "grant_type is required.");
	}

	if (grantType !== "client_credentials") {
		return tokenError(
			400,
			"unsupported_grant_type",
			`Grant type "${grantType}" is not supported. This endpoint mints only a client's own access token.`,
		);
	}

	let clientAuth = resolveClientAuth(ctx.request, form);
	if (!clientAuth.ok)
		return tokenError(clientAuth.status, clientAuth.error, clientAuth.description);

	if (clientAuth.auth.authScheme === "none" || clientAuth.auth.clientSecret === null) {
		return tokenError(
			401,
			"invalid_client",
			"The client credentials grant requires the application to authenticate.",
		);
	}

	let scope = form.get("scope");

	let outcome = await issueManagementClientCredentialsToken(ctx.db, {
		clientId: clientAuth.auth.clientId,
		clientSecret: clientAuth.auth.clientSecret,
		scope: typeof scope === "string" ? scope : null,
		resources: resources(form),
		now: Date.now(),
		issuer: `https://api.${env.PLATFORM_DOMAIN}`,
	});

	if (outcome.kind === "error")
		return tokenError(outcome.status, outcome.error, outcome.description);

	return json(
		{
			access_token: outcome.accessToken,
			token_type: outcome.tokenType,
			expires_in: outcome.expiresIn,
			scope: outcome.scope,
		},
		{ status: 200, headers: { "Cache-Control": "no-store" } },
	);
});
