/**
 * The platform's configured billing provider and the `WebhookStore` its webhook
 * endpoint is mounted with, both built once at module scope the same way
 * `session-cookie.ts` reads `SESSION_SECRET` — read from the Worker's own secret
 * bindings, with nothing reaching the network until a call actually needs it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, WebhookDelivery, WebhookStore } from "@sdxc/billing";

import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

import { createDatabase } from "~/app/lib/database";
import BillingDelivery from "~/app/models/billing-delivery";

/**
 * The platform's Polar organization. `products` is empty until ADR-019 (Plan
 * Catalog and Feature Split) names the real product slugs this platform sells —
 * until then a checkout names an unconfigured product and every such read
 * reports the slug as unknown, rather than a slug invented here standing in for
 * one ADR-019 has not named yet.
 */
export const polar: Billing = new PolarBilling({
	accessToken: env.POLAR_ACCESS_TOKEN,
	webhookSecret: env.POLAR_WEBHOOK_SECRET,
	products: {},
});

/**
 * The `billing_deliveries` table as a `WebhookStore`, so `BillingWebhook` keeps
 * its deduplication trail in D1 rather than in memory.
 */
export class D1WebhookStore implements WebhookStore {
	async find(id: string): Promise<WebhookDelivery | null> {
		let row = await BillingDelivery.findById(createDatabase(), id);
		if (!row) return null;

		return {
			id: row.id,
			type: row.type,
			payload: row.payload,
			valid: row.valid,
			processed: row.processed,
		};
	}

	async record(delivery: WebhookDelivery): Promise<void> {
		await BillingDelivery.record(createDatabase(), delivery);
	}

	async markProcessed(id: string): Promise<void> {
		await BillingDelivery.markProcessed(createDatabase(), id);
	}
}

/** The platform's own delivery store, built once and reused by the webhook endpoint. */
export const billingDeliveries: WebhookStore = new D1WebhookStore();
