/**
 * Billing webhook controller. On a paid order it tags the buyer in Buttondown
 * with the tier they bought, so the newsletter can segment on it. Verification,
 * deduplication and dispatch belong to the endpoint; what is left here is the
 * one thing a paid order means to this funnel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingWebhookHandlers } from "@sdxc/billing";
import type { RequestContext } from "remix/router";

import { BillingWebhook } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";

import { Product } from "~/app/data/product";
import { polar } from "~/app/lib/billing";
import { Buttondown } from "~/app/services/buttondown";

/** The Buttondown metadata values that drive purchase segmentation. */
const TIERS: Record<string, string> = {
	[Product.Complete]: "complete",
	[Product.Essentials]: "individual",
};

/**
 * Reads the buyer's address, which the order names only by customer. A read
 * that fails is thrown so the delivery is retried rather than acknowledged as
 * a purchase nobody was tagged for.
 *
 * @param context - The request context, for the platform the delivery came from.
 * @param customerId - The customer the order was paid by, when it named one.
 * @returns The buyer's address, or `null` when the platform holds none.
 * @throws {BillingError} When the customer could not be read.
 */
async function buyerEmail(context: RequestContext, customerId: string | null) {
	if (customerId === null) return null;

	let customer = await context.billing.customers.find({ id: customerId });
	if (isFailure(customer)) throw customer.error;

	return customer.data.email;
}

/**
 * What this funnel does about each delivery it is sent. Tagging reaches only a
 * buyer already subscribed, so every tagged address opted into the newsletter
 * itself; an unsubscribed buyer's purchase is recorded in the log alone.
 */
export const handlers: BillingWebhookHandlers = {
	/**
	 * @param event - The paid order, with the package named by our own slug.
	 * @param context - The request context, for its log and the platform.
	 */
	async "order.paid"(event, context) {
		let log = context.log;
		let tier = event.order.productSlug === null ? undefined : TIERS[event.order.productSlug];

		log.set({ order: { id: event.order.id, product: event.order.productSlug, tier } });

		if (!tier) {
			log.note("order.untagged", { reason: "unsold_package" });
			return;
		}

		let email = await buyerEmail(context, event.order.customerId);

		if (email === null) {
			log.note("order.untagged", { reason: "no_customer" });
			return;
		}

		let buttondown = getServiceContainer().get(Buttondown);
		let subscribed = await buttondown.isSubscribed(email);

		if (subscribed) await buttondown.addMetadata(email, { purchase: tier });

		log.set({ order: { tagged: subscribed } });
		log.note("order.paid", { email });
	},
};

/** POST /webhooks/polar — records a paid order against the buyer's newsletter profile. */
export default new BillingWebhook(polar, handlers);
