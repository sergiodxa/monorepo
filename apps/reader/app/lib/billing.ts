/**
 * The configured payment platform, built once per isolate so the checkout route, the
 * delivery endpoint and the daily reconciliation all bill against the same organization
 * and stamp the same connection code on every id they store.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";

import { BillingError } from "@sdxc/billing";
import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

import { TIER_PRODUCTS } from "~/app/lib/entitlement";

/**
 * Names the credential set every stored provider id was issued by, so a reader billed
 * through a second organization later stays distinguishable from these.
 */
export const CONNECTION = "polar";

/**
 * The platform this deployment sells through. Credentials resolve on first use rather
 * than at construction, so an isolate that never bills pays nothing for it and a rotated
 * secret is picked up by the next one.
 *
 * Deliveries fail closed while the signing secret is unset, which is what a deployment
 * that has not configured the endpoint wants.
 */
export let polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET,
	products: {
		[TIER_PRODUCTS.paid]: env.POLAR_PAID_PRODUCT_ID,
		[TIER_PRODUCTS.premium]: env.POLAR_PREMIUM_PRODUCT_ID,
	},
	connection: CONNECTION,
});

/**
 * Describes a failed billing call in the terms whoever reads the log can act on: the
 * normalized reason, the platform's own code for a support ticket, and whether repeating
 * the call could help.
 *
 * @param error - The failure a billing call reported
 * @returns Flat scalar fields for a note, a warning, or the `billing` namespace of `fail()`
 * @example ctx.log.fail(checkout.error, { billing: failureFields(checkout.error) });
 */
export function failureFields(error: unknown): Record<string, Log.Value | undefined> {
	if (error instanceof BillingError) {
		return { code: error.code, provider_code: error.providerCode, retryable: error.retryable };
	}

	return { reason: error instanceof Error ? error.message : String(error) };
}
