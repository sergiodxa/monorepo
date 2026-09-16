/**
 * `POST /billing/checkout/:plan` — opens the hosted page where a reader buys a paid tier.
 * The customer is created carrying their OIDC subject, so the snapshot that comes back
 * names their object directly and the tier lands without a lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Tier } from "~/app/lib/entitlement";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { CONNECTION, failureFields, polar } from "~/app/lib/billing";
import { isTier, TIER_PRODUCTS } from "~/app/lib/entitlement";
import { findBillingCustomer, linkBillingCustomer } from "~/database/registry";
import routes from "~/routes/web";

/** The tier named by the path, before it is checked against the two that are for sale. */
const CheckoutParams = s.object({ plan: s.string() });

/** Whether a tier is one this app sells a checkout for. */
function isPurchasable(tier: Tier): tier is Exclude<Tier, "free"> {
	return tier !== "free";
}

/**
 * POST /billing/checkout/:plan — starts a purchase and hands the reader to the platform.
 *
 * A failure returns them to the settings page rather than to an error screen: nothing has
 * been charged, nothing has changed, and the panel they pressed from is where the offer
 * is.
 */
export default createAction(routes.billing.checkout, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();

		/** The guard has already answered an anonymous request, so this holds a reader's id. */
		if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

		let { plan } = s.parse(CheckoutParams, ctx.params);
		if (!isTier(plan) || !isPurchasable(plan)) return back();

		let customerId = await customerFor(viewer.id, viewer.email);
		if (customerId === null) return back();

		let checkout = await polar.checkouts.create({
			product: TIER_PRODUCTS[plan],
			customer: { id: customerId },
			returnTo: new URL(routes.settings.href(), ctx.url).toString(),
			/**
			 * Keyed on the reader and the tier, so a form submitted twice reaches the session
			 * already open instead of opening a second one.
			 */
			idempotencyKey: `checkout_${viewer.id}_${plan}`,
		});

		if (isFailure(checkout)) {
			ctx.log.fail(checkout.error, { billing: failureFields(checkout.error) });
			return back();
		}

		if (checkout.data.url === null) return back();

		return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
	},
});

/** Where a reader who cannot be handed to the platform is left, which is where they were. */
function back(): Response {
	return redirect(routes.settings.href(), { status: redirect.Status.SeeOther });
}

/**
 * The platform customer a reader buys as, creating one the first time and recording the
 * link so a delivery naming only the platform's own id still reaches them.
 *
 * @param subject - The reader's OIDC subject, which becomes the customer's external id.
 * @param email - The address the OIDC `email` claim carried.
 */
async function customerFor(subject: string, email: string): Promise<string | null> {
	let linked = await findBillingCustomer(subject, CONNECTION);
	if (linked !== null) return linked.provider_customer_id;

	let created = await polar.customers.create({ email, externalId: subject });

	if (isFailure(created)) {
		currentLog()?.fail(created.error, { billing: failureFields(created.error) });
		return null;
	}

	await linkBillingCustomer(subject, CONNECTION, created.data.id);

	return created.data.id;
}
