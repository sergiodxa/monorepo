/**
 * `POST /oauth/par` — the pushed authorization request endpoint (RFC 9126): a client
 * authenticates as it would at the token endpoint, posts its authorization request, and
 * gets back a one-time `request_uri` to send the browser to `/authorize` with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import routes from "~/routes/tenant";

import { resolveClientAuth, tokenError } from "./token";

/** RFC 9126 §2.2 and §2.3 answer with `no-cache, no-store`, so neither a reference nor an error is reused. */
const NO_STORE = { "Cache-Control": "no-cache, no-store" };

/** Every string member of the posted form; a file member names no authorization parameter. */
function formParameters(form: FormData): Record<string, string> {
	let parameters: Record<string, string> = {};
	for (let [name, value] of form) if (typeof value === "string") parameters[name] = value;
	return parameters;
}

/**
 * Authenticates the client, validates the pushed request through the tenant's own
 * authorization rules, and answers with the `request_uri` it was stored under. A
 * `client_id` beside `Basic` credentials is the request's own required member (§2.1), so
 * it must name the authenticated client rather than count as a second credential.
 *
 * @param ctx - The request context (provides `tenantStub` and `formData`).
 * @returns `201` with `request_uri` and `expires_in`, or a token-endpoint-shaped OAuth error.
 * @example
 * router.map(routes.pushedAuthorizationRequest, pushedAuthorizationRequest);
 */
export default createAction(routes.pushedAuthorizationRequest, async (ctx) => {
	let parameters = formParameters(ctx.formData);

	let authForm = ctx.formData;
	let basic = ctx.request.headers.get("Authorization")?.startsWith("Basic ") ?? false;
	if (basic && parameters.client_id !== undefined) {
		authForm = new FormData();
		for (let [name, value] of ctx.formData) if (name !== "client_id") authForm.append(name, value);
	}

	let clientAuth = resolveClientAuth(ctx.request, authForm);
	if (!clientAuth.ok) {
		return withNoStore(tokenError(clientAuth.status, clientAuth.error, clientAuth.description));
	}

	if (parameters.client_id !== undefined && parameters.client_id !== clientAuth.auth.clientId) {
		return withNoStore(
			tokenError(400, "invalid_request", "client_id does not name the authenticated client."),
		);
	}

	let outcome = await ctx.tenantStub.pushAuthorizationRequest({
		clientId: clientAuth.auth.clientId,
		clientSecret: clientAuth.auth.clientSecret,
		authScheme: clientAuth.auth.authScheme,
		parameters,
		now: Date.now(),
	});

	if (outcome.kind === "error") {
		return withNoStore(tokenError(outcome.status, outcome.error, outcome.description));
	}

	return json(
		{ request_uri: outcome.requestUri, expires_in: outcome.expiresIn },
		{ status: 201, headers: NO_STORE },
	);
});

/** Adds the `no-cache, no-store` RFC 9126 §2.3 shows on every error to a token error response. */
function withNoStore(response: Response): Response {
	for (let [name, value] of Object.entries(NO_STORE)) response.headers.set(name, value);
	return response;
}
