/**
 * `POST /api/webhooks/polar` — the billing platform's delivery endpoint. It verifies the
 * signature, records the delivery before trusting it, and re-reads what the customer holds
 * so a replayed or out-of-order delivery still leaves the tenant's row saying what is true.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { BillingWebhook } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";

import { failureFields, polar } from "~/app/lib/billing";
import Subscription from "~/app/models/subscription";
import { deliveries } from "~/app/models/webhook-delivery";
import { TenantApiService } from "~/app/services/tenant-api";

/**
 * Verifies, deduplicates and dispatches one delivery. Every handler does the same
 * thing on purpose: the delivery names a customer whose entitlements moved, and
 * the snapshot read from the platform is what the tenant's row is written from.
 *
 * @example
 * router.map(routes.api.webhooks, { actions: { polar: polarWebhook } });
 */
export default new BillingWebhook(
	polar,
	{
		/**
		 * A paid checkout is the moment a tenant first holds a subscription, so the
		 * link between the tenant and what it bought comes from the snapshot.
		 */
		async "checkout.completed"(event, context) {
			await syncCustomer(event.checkout.customerId, context);
		},

		/** A new subscription starts entitling the tenant's provider surface. */
		async "subscription.activated"(event, context) {
			await syncCustomer(event.subscription.customerId, context);
		},

		/** A plan, price or period change reaches the projection as the new snapshot. */
		async "subscription.updated"(event, context) {
			await syncCustomer(event.subscription.customerId, context);
		},

		/** A cancellation stops renewal, and the snapshot says whether access is over. */
		async "subscription.canceled"(event, context) {
			await syncCustomer(event.subscription.customerId, context);
		},

		/** A revoked subscription ends access immediately. */
		async "subscription.revoked"(event, context) {
			await syncCustomer(event.subscription.customerId, context);
		},

		/** A settled payment can restore a tenant that lapsed on a failed one. */
		async "order.paid"(event, context) {
			await syncCustomer(event.order.customerId, context);
		},

		/** A refund can withdraw what the order it reverses had granted. */
		async "order.refunded"(event, context) {
			await syncCustomer(event.order.customerId, context);
		},
	},
	{ store: deliveries },
);

/**
 * Writes the customer's current entitlements into the tenant's row and pushes the
 * resulting gate into the tenant Durable Object. Throwing reports the failure to
 * the endpoint, which asks for a redelivery when the platform said one would help.
 *
 * @param customerId - The customer the delivery was about, or null when it named none.
 * @param context - The request context, for the request-scoped logger.
 */
async function syncCustomer(customerId: string | null, context: RequestContext): Promise<void> {
	let log = context.logger.action("/api/webhooks/polar");

	if (customerId === null) {
		log.info("Delivery named no customer");
		return;
	}

	let db = getServiceContainer().get(Database);
	let synced = await Subscription.syncFromBilling(db, { id: customerId });

	if (isFailure(synced)) {
		log.error("Entitlement sync failed", { customerId, ...failureFields(synced.error) });
		throw synced.error;
	}

	await new TenantApiService(synced.data.tenant_id).setSuspended(
		!Subscription.isEntitled(synced.data.status),
	);

	log.info("Entitlement sync completed", {
		tenantId: synced.data.tenant_id,
		status: synced.data.status,
	});
}
