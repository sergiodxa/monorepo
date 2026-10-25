/**
 * Background job that repairs the local projection of billing state. Deliveries
 * get missed — a deploy mid-delivery, a 500, a rotated signing secret — and a missed one is
 * invisible: the projection just keeps answering with what it last heard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CustomerRef } from "@sdxc/billing";

import { DAY_MS } from "@sdxc/dates/zone";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import { MONITORING_PRODUCT, polar } from "~/app/initializers/billing";
import jobs from "~/app/jobs";
import { syncEntitlements } from "~/app/services/entitlements";

/** Subscriptions read per page, which keeps the whole walk to a handful of requests. */
const PAGE_SIZE = 100;

/** Pages the walk follows before it gives up, so a populated account cannot hang the job. */
const MAX_PAGES = 50;

/** The states the platform's list is narrowed to, being the ones that grant monitoring. */
const LIVE_STATUSES = ["active", "trialing"] as const;

/**
 * How long a handled delivery is kept. It only has to outlast the platform's own retry window,
 * after which the row proves nothing a redelivery could ask about, and the daily delete is
 * what keeps this table from growing without a bound.
 */
const DELIVERY_RETENTION_DAYS = 30;

export default createJobHandler(jobs.reconcileSubscriptions, async (ctx) => {
	let stored = await ctx.models.subscriptions.query().all();

	/**
	 * Keyed by how each customer is addressed, so an owner already in the projection is asked
	 * about by our own subject id and a newly discovered one by the platform's customer id —
	 * the only identifier a subscription read carries.
	 */
	let customers = new Map<string, CustomerRef>();
	for (let row of stored) {
		customers.set(`external:${row.external_customer_id}`, { externalId: row.external_customer_id });
	}

	let known = new Set(stored.map((row) => row.billing_subscription_id));
	let live = 0;
	let cursor: string | undefined;

	for (let page = 0; page < MAX_PAGES; page++) {
		let listed = await polar.subscriptions.list({
			product: MONITORING_PRODUCT,
			status: [...LIVE_STATUSES],
			limit: PAGE_SIZE,
			cursor,
		});

		if (isFailure(listed)) {
			/**
			 * The walk is the discovery half only. Losing it costs nothing the owners already in
			 * the projection need, so the sweep goes on rather than skipping every repair.
			 */
			ctx.log.warn("subscriptions.list_failed", {
				code: listed.error.code,
				provider_code: listed.error.providerCode,
			});
			break;
		}

		live += listed.data.items.length;

		for (let subscription of listed.data.items) {
			if (known.has(subscription.id)) continue;
			if (subscription.customerId === null) continue;
			customers.set(`id:${subscription.customerId}`, { id: subscription.customerId });
		}

		if (listed.data.cursor === null) break;
		cursor = listed.data.cursor;
	}

	let swept = new Set<string>();
	let repaired = 0;

	for (let customer of customers.values()) {
		let synced = await syncEntitlements(ctx.models, customer);

		if (isFailure(synced)) {
			ctx.log.warn("subscriptions.read_failed", {
				code: synced.error.code,
				provider_code: synced.error.providerCode,
				"customer.id": identify(customer),
			});
			continue;
		}

		if (synced.data === null) {
			/**
			 * A platform customer with no external id was never linked to a signed-in subject, so
			 * there is no owner whose monitors this could apply to.
			 */
			ctx.log.warn("subscriptions.unlinked_customer", { "customer.id": identify(customer) });
			continue;
		}

		let { ownerId, changed, entitled, monitors } = synced.data;

		/** One owner reachable by both identifiers is one owner, and one repair at most. */
		if (swept.has(ownerId)) continue;
		swept.add(ownerId);

		if (!changed) continue;

		/**
		 * The trial funnel's payment stamp, repaired here because a missed delivery would
		 * otherwise leave a converted customer counted as a free signup. `markPaid` only sets an
		 * unset stamp, dating the payment to the day of repair.
		 */
		if (entitled) await ctx.models.trialConversions.markPaid(ownerId);

		repaired += 1;

		ctx.log.note("subscriptions.repaired", { "owner.id": ownerId, entitled, monitors });
	}

	let pruned = await ctx.models.billingWebhookDeliveries.prune(
		Date.now() - DELIVERY_RETENTION_DAYS * DAY_MS,
	);

	ctx.log.set({
		subscriptions: { live, stored: stored.length, swept: swept.size, repaired, pruned },
	});
});

/**
 * The identifier a customer is named by, whichever arm of the union names it, so one
 * `customer.id` field answers "which customer" for both.
 */
function identify(customer: CustomerRef): string {
	return "id" in customer ? customer.id : customer.externalId;
}
