/**
 * `POST /webhooks/billing` — where the payment platform delivers. It verifies the
 * signature, records the delivery before trusting it, and re-reads what the customer holds,
 * so a replayed, late or duplicated delivery still leaves the reader's tier saying what is
 * true.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BillingWebhook } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { polar } from "~/app/lib/billing";
import { syncCustomer, UnknownCustomerError } from "~/app/lib/billing-sync";
import { deliveries } from "~/database/registry";
import routes from "~/routes/web";

/**
 * Verifies, deduplicates and dispatches one delivery. Every handler is the same line on
 * purpose: the delivery says a customer moved, and the snapshot read back from the
 * platform is what the tier is written from. Nothing reads state out of the payload.
 */
export const endpoint = new BillingWebhook(
	polar,
	{
		/** A paid checkout is the moment a reader first holds a subscription. */
		async "checkout.completed"(event) {
			await sync(event.checkout.customerId);
		},

		/** A new subscription starts entitling everything the tier sells. */
		async "subscription.activated"(event) {
			await sync(event.subscription.customerId);
		},

		/** A plan, price or period change reaches the projection as the new snapshot. */
		async "subscription.updated"(event) {
			await sync(event.subscription.customerId);
		},

		/** A cancellation stops renewal, and the snapshot says whether the reading is over. */
		async "subscription.canceled"(event) {
			await sync(event.subscription.customerId);
		},

		/** A revoked subscription ends the tier as soon as the snapshot reports it. */
		async "subscription.revoked"(event) {
			await sync(event.subscription.customerId);
		},

		/** A settled payment is what clears a lapse, inside the grace period or after it. */
		async "order.paid"(event) {
			await sync(event.order.customerId);
		},

		/** A refund can withdraw what the order it reverses had granted. */
		async "order.refunded"(event) {
			await sync(event.order.customerId);
		},
	},
	{ store: deliveries },
);

/**
 * POST /webhooks/billing — one delivery from the payment platform.
 *
 * No guard stands in front of it. A reader's session has nothing to do with a delivery,
 * and the signature is what says whether to trust one.
 */
export default createAction(routes.webhooks.billing, { handler: endpoint.handler });

/**
 * Re-reads one customer and writes what came back. Throwing reports the failure to the
 * endpoint, which asks the platform for a redelivery when the platform said one would
 * help; a customer no reader of this app holds is nothing a retry could fix.
 *
 * @param customerId - The customer the delivery was about, or `null` when it named none.
 */
async function sync(customerId: string | null): Promise<void> {
	if (customerId === null) return;

	let synced = await syncCustomer(customerId, "webhook");
	if (!isFailure(synced)) return;
	if (synced.error instanceof UnknownCustomerError) return;

	throw synced.error;
}
