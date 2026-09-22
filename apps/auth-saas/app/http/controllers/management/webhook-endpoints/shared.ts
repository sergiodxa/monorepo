/**
 * What every route in this directory shares: reading the `:endpointId` path
 * param, the `problem+json` response for an endpoint the tenant does not
 * hold, the entitlement refusal outbound webhooks are gated behind, and
 * mapping a URL or event type refusal onto its own response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type {
	WebhookEndpointValidationFailure,
	WebhookUrlValidationFailureReason,
} from "~/database/webhook-endpoints";

import { problem } from "~/app/http/lib/problem";

/** Parses and requires the `:endpointId` path param every single-endpoint route matches. */
export function endpointIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ endpointId: s.string() }), ctx.params).endpointId;
}

/** An endpoint the tenant does not hold, for a route naming one in its path. */
export function endpointNotFound(): Response {
	return problem({
		type: "https://docs.example.com/errors/not-found",
		title: "No such webhook endpoint exists",
		status: 404,
	});
}

/** A caller registering or updating an endpoint against a plan this tenant is not entitled to. */
export function webhookEntitlementRequired(): Response {
	return problem({
		type: "https://docs.example.com/errors/entitlement-required",
		title: "This tenant is not entitled to outbound webhooks",
		status: 403,
		detail: "Outbound webhooks are not included on this tenant's plan.",
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
		return problem({
			type: "https://docs.example.com/errors/invalid-url",
			title: "The given URL is not valid for a webhook endpoint",
			status: 400,
			detail: `This URL ${webhookUrlDetail(result.detail)}`,
		});
	}

	return problem({
		type: "https://docs.example.com/errors/unknown-event-type",
		title: "One of the given event types is not recognized",
		status: 400,
		detail: `"${result.value}" is not a supported event type.`,
	});
}
