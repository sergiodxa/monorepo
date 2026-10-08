/**
 * Billing webhook controller. On a paid order it tags the buyer's newsletter
 * profile with the tier they bought, so the newsletter can segment on it. Verification,
 * deduplication and dispatch belong to the endpoint; what is left here is the
 * one thing a paid order means to this funnel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingWebhookHandlers } from "@sdxc/billing";
import type { RequestContext } from "remix/router";

import { BillingError, BillingWebhook } from "@sdxc/billing";
import { parseEmailAddress } from "@sdxc/email-address";
import { NewsletterError } from "@sdxc/newsletter";
import { isFailure, isSuccess } from "@sdxc/result";

import { Product } from "~/app/data/product";
import { polar } from "~/app/lib/billing";

/** The newsletter metadata values that drive purchase segmentation. */
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
 * buyer the newsletter already holds, so every tagged address opted in itself;
 * any other buyer's purchase is recorded in the log alone. A newsletter failure
 * is thrown, so the endpoint answers `503` and the platform redelivers.
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

		let address = parseEmailAddress(email);

		if (isFailure(address)) {
			log.note("order.untagged", { reason: "invalid_email" });
			return;
		}

		let tagged = await context.newsletter.subscribers.update(
			{ email: address.data },
			{ metadata: { purchase: tier } },
		);

		if (isFailure(tagged) && tagged.error.code !== "not_found") throw tagged.error;

		log.set({ order: { tagged: isSuccess(tagged) } });
		log.note("order.paid", { email });
	},
};

/**
 * Asks the platform to redeliver after any newsletter failure as well as a retryable
 * billing one: a paid order whose tag never landed would otherwise be acknowledged
 * and the purchase lost from segmentation.
 *
 * @param error - What the handler threw.
 * @returns Whether the endpoint answers `503`.
 */
export function retryDelivery(error: unknown): boolean {
	if (error instanceof NewsletterError) return true;
	return error instanceof BillingError && error.retryable;
}

/** POST /webhooks/polar — records a paid order against the buyer's newsletter profile. */
export default new BillingWebhook(polar, handlers, { retry: retryDelivery });
