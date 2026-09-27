/**
 * What every route in this directory shares: reading the `:clientId` path
 * param, the `problem+json` response for a client the tenant does not hold,
 * the entitlement refusal a machine-access grant type is gated behind, and
 * mapping a redirect URI, grant type, response type or auth method refusal
 * onto its own response, and projecting a client onto the writable members a merge
 * patch edits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type {
	ClientRecord,
	ClientRecordValidationFailure,
	RedirectUriValidationFailureReason,
} from "~/database/clients";

import { managementProblem } from "~/app/http/lib/problem";
import { CLIENT_BODY_SCHEMA } from "~/app/http/openapi/clients";

/** Projects a client's record onto {@link CLIENT_BODY_SCHEMA}, the resource a merge patch edits. */
export function writableClient(client: ClientRecord): s.InferOutput<typeof CLIENT_BODY_SCHEMA> {
	return {
		name: client.name,
		kind: client.kind,
		redirectUris: client.redirectUris,
		postLogoutRedirectUris: client.postLogoutRedirectUris,
		grantTypes: client.grantTypes,
		responseTypes: client.responseTypes,
		scopes: client.scopes,
		tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
		requireConsent: client.requireConsent,
		idTokenSignedResponseAlg: client.idTokenSignedResponseAlg,
	};
}

/** Parses and requires the `:clientId` path param every single-client route matches. */
export function clientIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ clientId: s.string() }), ctx.params).clientId;
}

/** A client the tenant does not hold, for a route naming one in its path. */
export function clientNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such client exists.",
	});
}

/** A caller registering or updating a client into a grant this tenant's plan does not include. */
export function clientEntitlementRequired(): Response {
	return managementProblem("entitlementRequired", {
		detail:
			"This tenant is not entitled to a client credentials grant. Machine-to-machine access is not included on this tenant's plan.",
	});
}

/** Renders one redirect URI's own refusal reason as a short sentence's tail. */
function redirectUriDetail(reason: RedirectUriValidationFailureReason): string {
	if (reason === "not-absolute") return "is not an absolute URI.";
	if (reason === "has-fragment") return "may not carry a fragment.";
	return "must use https, unless its host is a loopback address.";
}

/** Maps every redirect URI, grant type, response type and auth method refusal onto its own `problem+json` response. */
export function clientRecordValidationFailure(result: ClientRecordValidationFailure): Response {
	switch (result.reason) {
		case "invalid-redirect-uri":
			return managementProblem("invalidRedirectUri", {
				detail: `"${result.uri}" ${redirectUriDetail(result.detail)}`,
			});
		case "invalid-post-logout-redirect-uri":
			return managementProblem("invalidPostLogoutRedirectUri", {
				detail: `"${result.uri}" ${redirectUriDetail(result.detail)}`,
			});
		case "invalid-grant-type":
			return managementProblem("invalidGrantType", {
				detail: `"${result.value}" is not a supported grant type.`,
			});
		case "invalid-response-type":
			return managementProblem("invalidResponseType", {
				detail: `"${result.value}" is not a supported response type.`,
			});
		case "invalid-auth-method":
			return managementProblem("invalidAuthMethod", {
				detail: `"${result.method}" is not valid for a ${result.kind} client.`,
			});
	}
}
