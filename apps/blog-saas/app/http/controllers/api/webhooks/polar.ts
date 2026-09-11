/**
 * The billing webhook endpoint mounted at `POST /api/webhooks/polar`: it verifies and
 * records every delivery, then re-reads the customer's entitlements and writes them
 * into the control plane, so a replay and an out-of-order delivery both land the same
 * state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { BillingWebhook } from "@sdxc/billing";

import { polar } from "~/app/lib/billing";
import { createProvisioner } from "~/app/lib/provisioner";
import { syncEntitlements } from "~/app/services/entitlements";
import { deliveries } from "~/app/services/webhook-deliveries";

/**
 * Runs the entitlement sync for the customer a delivery named.
 *
 * @param db The control-plane database the projection is written into.
 * @param customerId The platform's customer id, or `null` when the delivery named none.
 * @returns A promise resolving once the projection is written.
 */
function sync(db: Database, customerId: string | null): Promise<void> {
	return syncEntitlements(polar, db, createProvisioner(db), customerId);
}

/**
 * Every delivery that can move entitlement runs the same sync, because the payload
 * says only that something changed and the snapshot says what is true now.
 */
export default new BillingWebhook(
	polar,
	{
		async "checkout.completed"(event, ctx) {
			await sync(ctx.db, event.checkout.customerId);
		},

		async "order.paid"(event, ctx) {
			await sync(ctx.db, event.order.customerId);
		},

		async "subscription.activated"(event, ctx) {
			await sync(ctx.db, event.subscription.customerId);
		},

		async "subscription.updated"(event, ctx) {
			await sync(ctx.db, event.subscription.customerId);
		},

		async "subscription.canceled"(event, ctx) {
			await sync(ctx.db, event.subscription.customerId);
		},

		async "subscription.revoked"(event, ctx) {
			await sync(ctx.db, event.subscription.customerId);
		},
	},
	{ store: deliveries },
);
