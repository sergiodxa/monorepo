/**
 * The cron backstop for outbound webhook delivery: claims every tenant's own pending
 * deliveries already past their next attempt and fans one `deliverWebhook` message out
 * per delivery. A delivery's own row already carries when it is next due, so this
 * sweep's five-minute cadence only decides how soon a due delivery gets picked up —
 * the gap between attempts comes from `deliverWebhook`'s own retry delay, which keeps
 * running however often or rarely this fires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { forEachProvisionedTenant } from "~/app/jobs/lib/for-each-tenant";

import { dispatcher } from "./dispatcher";

/** How many due deliveries one tenant's own claim reads per sweep. */
const CLAIM_BATCH_SIZE = 100;

export default createJobHandler(jobs.sweepDueWebhookDeliveries, async (ctx) => {
	let now = Date.now();
	let enqueued = 0;

	let { visited } = await forEachProvisionedTenant(
		ctx.database,
		ctx.tenant,
		async (stub, tenantId) => {
			let claimed = await stub.claimDueDeliveries({ before: now, limit: CLAIM_BATCH_SIZE });
			if (claimed.deliveries.length === 0) return;

			await dispatcher.enqueueMany(
				jobs.deliverWebhook,
				claimed.deliveries.map((delivery) => ({ tenantId, deliveryId: delivery.deliveryId })),
			);

			enqueued += claimed.deliveries.length;
		},
		{ signal: ctx.signal },
	);

	ctx.log.set({ tenants: { visited }, webhooks: { enqueued } });
});
