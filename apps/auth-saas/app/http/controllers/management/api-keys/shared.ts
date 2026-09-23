/**
 * What every route in this directory shares: reading the `:keyId` path param,
 * the `problem+json` response for a key the tenant does not hold, the
 * entitlement refusal machine-to-machine access is gated behind, and the
 * refusal for a tenant that has not chosen its own key prefix yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import { managementProblem } from "~/app/http/lib/problem";

/** Parses and requires the `:keyId` path param every single-key route matches. */
export function keyIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ keyId: s.string() }), ctx.params).keyId;
}

/** A key the tenant does not hold, for a route naming one in its path. */
export function apiKeyNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such API key exists.",
	});
}

/** A caller minting or rotating a key against a plan this tenant is not entitled to. */
export function apiKeyEntitlementRequired(): Response {
	return managementProblem("entitlementRequired", {
		detail:
			"This tenant is not entitled to machine-to-machine access. Machine-to-machine access is not included on this tenant's plan.",
	});
}

/** A caller minting or rotating a key before this tenant has chosen its own key prefix. */
export function apiKeyPrefixNotSet(): Response {
	return managementProblem("prefixNotSet");
}
