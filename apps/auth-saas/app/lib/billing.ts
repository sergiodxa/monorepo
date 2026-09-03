/**
 * The platform's configured billing provider, constructed once per isolate so the
 * dashboard, the webhook endpoint and the daily usage job all bill against the same
 * Polar organization and stamp the same connection code on every id they store.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BillingError } from "@sdxc/billing";
import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

/** Our own name for the plan every paying tenant is on, as each call site addresses it. */
export const PLAN = "pro";

/** Our own name for the meter the daily job reports monthly active users against. */
export const MAU_METER = "mau";

/**
 * Names the credential set every stored provider id was issued by, so a tenant
 * billed through a second organization later stays distinguishable from these.
 */
export const CONNECTION = "polar";

/**
 * The billing platform this deployment sells through. The credentials resolve on
 * first use rather than at construction, so an isolate that never bills pays
 * nothing for it and a rotated secret is picked up by the next one.
 */
export let polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET ?? "",
	products: { [PLAN]: env.POLAR_PRODUCT_ID },
	connection: CONNECTION,
});

/**
 * Describes a failed billing call in the terms whoever reads the log can act on:
 * the normalized reason, the platform's own code for a support ticket, and whether
 * repeating the call could help.
 *
 * @param error - The failure a billing call reported.
 * @returns Fields to merge into a log entry.
 * @example
 * log.error("Checkout failed", { tenantId, ...failureFields(checkout.error) });
 */
export function failureFields(error: unknown): Record<string, unknown> {
	if (error instanceof BillingError) {
		return { code: error.code, providerCode: error.providerCode, retryable: error.retryable };
	}

	return { error: error instanceof Error ? error.message : String(error) };
}
