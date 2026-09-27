/**
 * What every route in this directory shares: reading the `:endpointId` path
 * param, the `problem+json` response for an endpoint the tenant does not
 * hold, the entitlement refusal outbound webhooks are gated behind, and
 * mapping a URL or event type refusal onto its own response, and the schema an
 * endpoint's body is held to on register and on update.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type {
	WebhookEndpointRecord,
	WebhookEndpointValidationFailure,
	WebhookUrlValidationFailureReason,
} from "~/database/webhook-endpoints";

import { managementProblem } from "~/app/http/lib/problem";

/**
 * An endpoint's writable members: the body a registration sends whole, and the shape a
 * merge-patched endpoint must still have, so both routes hold one set of rules.
 */
export const WEBHOOK_ENDPOINT_BODY_SCHEMA = s.object({
	url: s.string(),
	description: s.string(),
	eventTypes: s.array(s.string()),
});

/** Projects an endpoint's record onto {@link WEBHOOK_ENDPOINT_BODY_SCHEMA}, the resource a merge patch edits. */
export function writableWebhookEndpoint(
	endpoint: WebhookEndpointRecord,
): s.InferOutput<typeof WEBHOOK_ENDPOINT_BODY_SCHEMA> {
	return { url: endpoint.url, description: endpoint.description, eventTypes: endpoint.eventTypes };
}

/** Parses and requires the `:endpointId` path param every single-endpoint route matches. */
export function endpointIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ endpointId: s.string() }), ctx.params).endpointId;
}

/** An endpoint the tenant does not hold, for a route naming one in its path. */
export function endpointNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such webhook endpoint exists.",
	});
}

/** A caller registering or updating an endpoint against a plan this tenant is not entitled to. */
export function webhookEntitlementRequired(): Response {
	return managementProblem("entitlementRequired", {
		detail:
			"This tenant is not entitled to outbound webhooks. Outbound webhooks are not included on this tenant's plan.",
	});
}

/** Renders one URL refusal reason as a short sentence's tail. */
function webhookUrlDetail(reason: WebhookUrlValidationFailureReason): string {
	switch (reason) {
		case "not-absolute":
			return "is not an absolute URL.";
		case "insecure-scheme":
			return "must use https.";
		case "literal-address-host":
			return "may not name a literal address or localhost.";
		case "has-userinfo":
			return "may not carry userinfo.";
		case "non-default-port":
			return "must use its scheme's own default port.";
	}
}

/** Maps every URL and event type refusal onto its own `problem+json` response. */
export function webhookEndpointValidationFailure(
	result: WebhookEndpointValidationFailure,
): Response {
	if (result.reason === "invalid-url") {
		return managementProblem("invalidUrl", {
			detail: `This URL ${webhookUrlDetail(result.detail)}`,
		});
	}

	return managementProblem("unknownEventType", {
		detail: `"${result.value}" is not a supported event type.`,
	});
}
