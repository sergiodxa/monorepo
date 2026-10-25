/**
 * `POST /webhooks/billing` — where the payment platform delivers. It verifies the
 * signature, records the delivery before trusting it, and re-reads what the customer holds,
 * so a replayed, late or duplicated delivery still leaves the reader's tier saying what is
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { BillingWebhook } from "@sdxc/billing";
import { isFailure, success } from "@sdxc/result";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";

import { polar } from "~/app/initializers/billing";
import { deliveries } from "~/app/models/registry";
import { syncCustomer, UnknownCustomerError } from "~/app/services/billing-sync";
import routes from "~/routes/web";

/**
 * Verifies, deduplicates and dispatches one delivery. Every handler is the same line on
 * purpose: the delivery says a customer moved, and the snapshot read back from the
 * platform is what the tier is written from. Nothing reads state out of the payload.
 */
export const endpoint = new BillingWebhook<AppContext>(
	polar,
	{
		/** A paid checkout is the moment a reader first holds a subscription. */
		async "checkout.completed"(event) {
			return sync(event.checkout.customerId);
		},

		/** A new subscription starts entitling everything the tier sells. */
		async "subscription.activated"(event) {
			return sync(event.subscription.customerId);
		},

		/** A plan, price or period change reaches the projection as the new snapshot. */
		async "subscription.updated"(event) {
			return sync(event.subscription.customerId);
		},

		/** A cancellation stops renewal, and the snapshot says whether the reading is over. */
		async "subscription.canceled"(event) {
			return sync(event.subscription.customerId);
		},

		/** A revoked subscription ends the tier as soon as the snapshot reports it. */
		async "subscription.revoked"(event) {
			return sync(event.subscription.customerId);
		},

		/** A settled payment is what clears a lapse, inside the grace period or after it. */
		async "order.paid"(event) {
			return sync(event.order.customerId);
		},

		/** A refund can withdraw what the order it reverses had granted. */
		async "order.refunded"(event) {
			return sync(event.order.customerId);
		},
	},
	{ store: deliveries },
);

/**
 * POST /webhooks/billing — one delivery from the payment platform, behind no guard: the
 * signature alone says whether to trust it.
 */
export default createAction(routes.webhooks.billing, {
	handler: (ctx) => endpoint.handler(ctx),
});

/**
 * Re-reads one customer and writes what came back. A returned failure reaches the
 * endpoint, which asks the platform for a redelivery when the platform said one would
 * help; a customer no reader of this app holds is nothing a retry could fix.
 *
 * @param customerId - The customer the delivery was about, or `null` when it named none.
 */
async function sync(customerId: string | null): Promise<Result<null, Error>> {
	if (customerId === null) return success(null);

	let synced = await syncCustomer(customerId, "webhook");
	if (isFailure(synced) && !(synced.error instanceof UnknownCustomerError)) return synced;

	return success(null);
}
