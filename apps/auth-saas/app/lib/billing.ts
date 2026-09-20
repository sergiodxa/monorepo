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
import { buildFeatureMap, buildProductMap } from "~/app/services/billing/catalog";

/**
 * Parses a JSON-encoded id map secret — `POLAR_PRODUCT_IDS`, `POLAR_FEATURE_IDS`
 * or `POLAR_METER_IDS` — into our own slugs mapped to Polar's ids, answering `{}`
 * for anything that is not a JSON object of strings rather than throwing at
 * module load. A slug this then leaves unconfigured gets the "unknown product"
 * failure `@sdxc/billing` already produces for it, which is the same shape of
 * failure a genuinely unset secret would produce.
 *
 * @param raw - The secret's raw value, or `undefined` when unset.
 * @returns Our own slugs mapped to Polar's ids.
 */
export function parseIdMap(raw: string | undefined): Record<string, string> {
	if (!raw) return {};

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

	let ids: Record<string, string> = {};
	for (let [slug, id] of Object.entries(parsed as Record<string, unknown>)) {
		if (typeof id === "string") ids[slug] = id;
	}

	return ids;
}

/**
 * The platform's Polar organization. `products`, `features` and `meters` merge
 * the plan and add-on catalog's own slugs (`PLANS`/`ADDONS`) with this
 * environment's own ids, read from bindings since sandbox and production
 * share none of them.
 */
export const polar: Billing = new PolarBilling({
	accessToken: env.POLAR_ACCESS_TOKEN,
	webhookSecret: env.POLAR_WEBHOOK_SECRET,
	products: buildProductMap(parseIdMap(env.POLAR_PRODUCT_IDS)),
	features: buildFeatureMap(parseIdMap(env.POLAR_FEATURE_IDS)),
	meters: parseIdMap(env.POLAR_METER_IDS),
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
