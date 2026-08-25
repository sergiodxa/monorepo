/**
 * Background job that repairs the local projection of Polar subscription state (ADR-005
 * §5). Webhooks get missed — a deploy mid-delivery, a 500, a rotated signing secret — and
 * a missed one is invisible: the projection just keeps answering with what it last heard.
 * This is the daily sweep that notices, and the only Polar query left on the billing path:
 * one paginated list a day instead of a point read per owner per minute.
 *
 * Every repair is logged at error level on purpose. A nonzero repair count doesn't mean
 * this job failed, it means webhook delivery is broken, which is exactly the failure that
 * would otherwise stay silent until a paying customer's monitors went quiet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subscription as PolarSubscription } from "@pkg/polar";

import { Job } from "@pkg/jobs";
import { isActiveSubscriptionStatus, PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Subscription, { SUBSCRIPTION_PRODUCT_ID } from "~/app/data/subscription";
import TrialConversion from "~/app/data/trial-conversion";

export class ReconcileSubscriptionsJob extends Job {
	/** The "Reconcile Polar Subscriptions" cron monitor this job reports itself to when it completes. */
	static override monitorId = "2df6d6d9-54e9-4a84-954a-e1d357421459";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let polar = getServiceContainer().get(PolarClient);

		let live = await polar.listActiveSubscriptionsByProduct(SUBSCRIPTION_PRODUCT_ID);
		let stored = await Subscription.listAll(db);

		let liveIds = new Set(live.map((subscription) => subscription.id));
		let activeStoredIds = new Set(
			stored
				.filter((row) => isActiveSubscriptionStatus(row.status))
				.map((row) => row.polar_subscription_id),
		);

		/**
		 * Both directions of drift resolve to the same fetch: the subscription state
		 * Polar reports right now. A drifted row is re-fetched, keeping the
		 * projection aligned with Polar's own status through one repair loop.
		 */
		let drifted: PolarSubscription[] = live.filter(
			(subscription) => !activeStoredIds.has(subscription.id),
		);

		for (let row of stored) {
			if (!isActiveSubscriptionStatus(row.status)) continue;
			if (liveIds.has(row.polar_subscription_id)) continue;
			drifted.push(await polar.getSubscription(row.polar_subscription_id));
		}

		let repaired = 0;

		for (let subscription of drifted) {
			let ownerId = subscription.customer.externalId;

			if (!ownerId) {
				this.logger.error("job.reconcile_subscriptions.unlinked_customer", {
					subscriptionId: subscription.id,
					customerId: subscription.customerId,
				});
				continue;
			}

			await Subscription.upsert(db, ownerId, subscription);
			let entitled = isActiveSubscriptionStatus(subscription.status);
			let monitors = await Subscription.applyEntitlement(db, ownerId, entitled);
			repaired += 1;

			/**
			 * The trial funnel's payment stamp, repaired here because a missed webhook
			 * would otherwise leave a converted customer counted as a free signup.
			 * `markPaid` only sets an unset stamp, dating the payment to the day of repair.
			 */
			if (entitled) await TrialConversion.markPaid(db, ownerId);

			this.logger.error("job.reconcile_subscriptions.repaired", {
				subscriptionId: subscription.id,
				ownerId,
				status: subscription.status,
				entitled,
				monitors,
			});
		}

		this.logger.info("job.reconcile_subscriptions.completed", {
			live: live.length,
			stored: stored.length,
			repaired,
		});
	}
}
