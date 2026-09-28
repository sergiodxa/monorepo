/**
 * `POST /oauth/token` — the management API's own token endpoint: exchanges a
 * machine client's id and secret for a short-lived access token about that
 * client, through the platform tenant's own, ordinary client-credentials
 * grant. `client_credentials` is the only grant this endpoint answers; it
 * never issues a code or a refresh token — a person's own token comes from
 * the platform tenant's own authorization-code flow instead, not from here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { resolveClientAuth, tokenError } from "~/app/http/controllers/oauth/token";
import { platformTenantStub } from "~/app/lib/platform-tenant";
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
 * Exchanges a machine client's credentials for an access token, minted by the
 * platform tenant's own token endpoint under its own signing key.
 *
 * @param ctx - The request context.
 * @returns The minted access token as OAuth-shaped JSON with `Cache-Control:
 * no-store`, or the error the grant was refused for.
 * @example
 * router.map(routes.token, token);
 */
export default createAction(routes.token, async (ctx) => {
	let form = ctx.formData;

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
	let requestedResources = resources(form);

	let platform = platformTenantStub();

	let outcome = await platform.issueClientCredentialsToken({
		scope: typeof scope === "string" ? scope : null,
		resource: requestedResources[0] ?? null,
		clientId: clientAuth.auth.clientId,
		clientSecret: clientAuth.auth.clientSecret,
		authScheme: clientAuth.auth.authScheme === "basic" ? "basic" : "post",
		now: Date.now(),
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
