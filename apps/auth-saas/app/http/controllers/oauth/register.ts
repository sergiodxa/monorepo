/**
 * `POST /oauth/register` — RFC 7591 Dynamic Client Registration: a relying party
 * registers itself against this tenant ahead of its first `/authorize` call and
 * gets back a client id — a secret too, for a confidential client — reusing the
 * exact record and validation `registerClient` already applies to every client
 * this tenant holds, whether a dashboard wrote it or a caller registered it here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { RegisterClientResult } from "~/database/clients";

import routes from "~/routes/tenant";

/** The auth methods a registering client may declare; a public client sets `none`. */
let TokenEndpointAuthMethodSchema = s.enum_([
	"client_secret_basic",
	"client_secret_post",
	"none",
] as const);

/** The registration request body's own fields, RFC 7591 §2's client metadata. */
let RegisterClientBodySchema = s.object({
	redirect_uris: s.array(s.string()),
	post_logout_redirect_uris: s.optional(s.array(s.string())),
	client_name: s.optional(s.string()),
	token_endpoint_auth_method: s.optional(TokenEndpointAuthMethodSchema),
	grant_types: s.optional(s.array(s.string())),
	response_types: s.optional(s.array(s.string())),
	scope: s.optional(s.string()),
});

/** Every reason `registerClient` can refuse a record, in the one client-facing sentence RFC 7591 §3.2.2's `invalid_client_metadata` names it with. */
function describeRegistrationFailure(failure: Exclude<RegisterClientResult, { ok: true }>): string {
	if (failure.reason === "entitlement-required") {
		return "This tenant is not entitled to one or more of the requested grant types.";
	}
	if (failure.reason === "invalid-redirect-uri") {
		return `redirect_uris carries an invalid entry "${failure.uri}" (${failure.detail}).`;
	}
	if (failure.reason === "invalid-post-logout-redirect-uri") {
		return `post_logout_redirect_uris carries an invalid entry "${failure.uri}" (${failure.detail}).`;
	}
	if (failure.reason === "invalid-grant-type") {
		return `grant_types carries an unsupported value "${failure.value}".`;
	}
	if (failure.reason === "invalid-response-type") {
		return `response_types carries an unsupported value "${failure.value}".`;
	}
	return `token_endpoint_auth_method "${failure.method}" does not match the requested client kind.`;
}

/**
 * Registers a new OAuth client against this tenant, with no authentication required —
 * the whole point of dynamic registration is that a client reaches this endpoint before
 * it holds any credential at all.
 *
 * @param ctx - The request context (provides `tenantStub` and `request`).
 * @returns The freshly registered client as an RFC 7591 registration response, or a
 * `400 invalid_client_metadata` naming which rule refused it.
 * @example
 * router.map(routes.register, register);
 */
export default createAction(routes.register, async (ctx) => {
	let parsedBody = s.parseSafe(
		RegisterClientBodySchema,
		await ctx.request.json().catch(() => null),
	);
	if (!parsedBody.success) {
		return json(
			{
				error: "invalid_client_metadata",
				error_description: "A JSON body with a redirect_uris array is required.",
			},
			{ status: 400 },
		);
	}

	let body = parsedBody.value;
	let tokenEndpointAuthMethod = body.token_endpoint_auth_method ?? "client_secret_basic";

	let registered = await ctx.tenantStub.registerClient({
		name: body.client_name ?? "Registered client",
		kind: tokenEndpointAuthMethod === "none" ? "public" : "confidential",
		redirectUris: body.redirect_uris,
		postLogoutRedirectUris: body.post_logout_redirect_uris ?? [],
		grantTypes: body.grant_types ?? ["authorization_code"],
		responseTypes: body.response_types ?? ["code"],
		scopes: body.scope ? body.scope.split(/\s+/).filter(Boolean) : [],
		tokenEndpointAuthMethod,
		requireConsent: true,
	});

	if (!registered.ok) {
		return json(
			{
				error: "invalid_client_metadata",
				error_description: describeRegistrationFailure(registered),
			},
			{ status: 400 },
		);
	}

	let client = registered.client;

	return json(
		{
			client_id: client.id,
			...(registered.secret ? { client_secret: registered.secret } : {}),
			client_id_issued_at: Math.floor(client.createdAt / 1000),
			client_secret_expires_at: 0,
			redirect_uris: client.redirectUris,
			post_logout_redirect_uris: client.postLogoutRedirectUris,
			token_endpoint_auth_method: client.tokenEndpointAuthMethod,
			grant_types: client.grantTypes,
			response_types: client.responseTypes,
			client_name: client.name,
			scope: client.scopes.join(" "),
		},
		{ status: 201, headers: { "Cache-Control": "no-store" } },
	);
});
