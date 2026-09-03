/**
 * The billing webhook endpoint mounted at `POST /api/webhooks/polar`: it verifies and
 * records every delivery, then re-reads the customer's entitlements and writes them
 * into the control plane, so a replay and an out-of-order delivery both land the same
 * state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { BillingWebhook } from "@sdxc/billing";
import { getServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";

import { polar } from "~/app/lib/billing";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
import { syncEntitlements } from "~/app/services/entitlements";
import { deliveries } from "~/app/services/webhook-deliveries";

/**
 * Runs the entitlement sync for the customer a delivery named, resolving the
 * control-plane services from the scope the request already opened.
 *
 * @param customerId The platform's customer id, or `null` when the delivery named none.
 * @returns A promise resolving once the projection is written.
 */
function sync(customerId: string | null): Promise<void> {
	let container = getServiceContainer();

	return syncEntitlements(
		polar,
		container.get(Database),
		container.get(BlogProvisioner),
		customerId,
	);
}

/**
 * Every delivery that can move entitlement runs the same sync, because the payload
 * says only that something changed and the snapshot says what is true now.
 */
export default new BillingWebhook(
	polar,
	{
		async "checkout.completed"(event) {
			await sync(event.checkout.customerId);
		},

		async "order.paid"(event) {
			await sync(event.order.customerId);
		},

		async "subscription.activated"(event) {
			await sync(event.subscription.customerId);
		},

		async "subscription.updated"(event) {
			await sync(event.subscription.customerId);
		},

		async "subscription.canceled"(event) {
			await sync(event.subscription.customerId);
		},

		async "subscription.revoked"(event) {
			await sync(event.subscription.customerId);
		},
	},
	{ store: deliveries },
);
