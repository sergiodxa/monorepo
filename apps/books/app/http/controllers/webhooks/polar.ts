/**
 * Billing webhook controller. On a paid order it tags the buyer in Buttondown
 * with the tier they bought, so the newsletter can segment on it. Verification,
 * deduplication and dispatch belong to the endpoint; what is left here is the
 * one thing a paid order means to this funnel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingWebhookHandlers } from "@pkg/billing";
import type { RequestContext } from "remix/router";

import { BillingWebhook } from "@pkg/billing";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";

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
	 * @param context - The request context, for the logger and the platform.
	 */
	async "order.paid"(event, context) {
		let log = context.logger;
		let tier = event.order.productSlug === null ? undefined : TIERS[event.order.productSlug];

		if (!tier) {
			log.info("order_paid_untagged", { orderId: event.order.id });
			return;
		}

		let email = await buyerEmail(context, event.order.customerId);

		if (email === null) {
			log.info("order_paid_untagged", { orderId: event.order.id });
			return;
		}

		let buttondown = getServiceContainer().get(Buttondown);

		if (await buttondown.isSubscribed(email)) {
			await buttondown.addMetadata(email, { purchase: tier });
		}

		log.info("order_paid", {
			channel: "payments",
			email,
			product: event.order.productSlug,
			orderId: event.order.id,
		});
	},
};

/** POST /webhooks/polar — records a paid order against the buyer's newsletter profile. */
export default new BillingWebhook(polar, handlers);
