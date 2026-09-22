/**
 * What every route in this directory shares: reading the `:clientId` path
 * param, the `problem+json` response for a client the tenant does not hold,
 * the entitlement refusal a machine-access grant type is gated behind, and
 * mapping a redirect URI, grant type, response type or auth method refusal
 * onto its own response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type {
	ClientRecordValidationFailure,
	RedirectUriValidationFailureReason,
} from "~/database/clients";

import { problem } from "~/app/http/lib/problem";

/** Parses and requires the `:clientId` path param every single-client route matches. */
export function clientIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ clientId: s.string() }), ctx.params).clientId;
}

/** A client the tenant does not hold, for a route naming one in its path. */
export function clientNotFound(): Response {
	return problem({
		type: "https://docs.example.com/errors/not-found",
		title: "No such client exists",
		status: 404,
	});
}

/** A caller registering or updating a client into a grant this tenant's plan does not include. */
export function clientEntitlementRequired(): Response {
	return problem({
		type: "https://docs.example.com/errors/entitlement-required",
		title: "This tenant is not entitled to a client credentials grant",
		status: 403,
		detail: "Machine-to-machine access is not included on this tenant's plan.",
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
			return problem({
				type: "https://docs.example.com/errors/invalid-redirect-uri",
				title: "One of the given redirect URIs is not valid",
				status: 400,
				detail: `"${result.uri}" ${redirectUriDetail(result.detail)}`,
			});
		case "invalid-post-logout-redirect-uri":
			return problem({
				type: "https://docs.example.com/errors/invalid-post-logout-redirect-uri",
				title: "One of the given post-logout redirect URIs is not valid",
				status: 400,
				detail: `"${result.uri}" ${redirectUriDetail(result.detail)}`,
			});
		case "invalid-grant-type":
			return problem({
				type: "https://docs.example.com/errors/invalid-grant-type",
				title: "One of the given grant types is not supported",
				status: 400,
				detail: `"${result.value}" is not a supported grant type.`,
			});
		case "invalid-response-type":
			return problem({
				type: "https://docs.example.com/errors/invalid-response-type",
				title: "One of the given response types is not supported",
				status: 400,
				detail: `"${result.value}" is not a supported response type.`,
			});
		case "invalid-auth-method":
			return problem({
				type: "https://docs.example.com/errors/invalid-auth-method",
				title: "This auth method does not match the client's kind",
				status: 400,
				detail: `"${result.method}" is not valid for a ${result.kind} client.`,
			});
	}
}
