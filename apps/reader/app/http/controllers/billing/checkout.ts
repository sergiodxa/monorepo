/**
 * `GET /billing/checkout/:plan` — opens the hosted page where a reader buys a paid tier.
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

import type { Tier } from "~/app/services/entitlement";

import { BILLING_PARAM } from "~/app/http/controllers/billing/outcome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { CONNECTION, failureFields, polar } from "~/app/initializers/billing";
import { findBillingCustomer, linkBillingCustomer } from "~/app/models/registry";
import { isTier, TIER_PRODUCTS } from "~/app/services/entitlement";
import routes from "~/routes/web";

/** The tier named by the path, before it is checked against the two that are for sale. */
const CheckoutParams = s.object({ plan: s.string() });

/** Whether a tier is one this app sells a checkout for. */
function isPurchasable(tier: Tier): tier is Exclude<Tier, "free"> {
	return tier !== "free";
}

/**
 * GET /billing/checkout/:plan — starts a purchase and hands the reader to the platform.
 * A failure returns them to the settings page with a note: nothing has been charged, and
 * the panel they pressed from is where the offer and the explanation both live.
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
			currentLog()?.fail(checkout.error, { billing: failureFields(checkout.error) });
			return back();
		}

		if (checkout.data.url === null) return back();

		return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
	},
});

/** Where a reader who cannot be handed to the platform is left, with a note saying so. */
function back(): Response {
	let query = new URLSearchParams({ [BILLING_PARAM]: "failed" });
	return redirect(`${routes.settings.href()}?${query}`, { status: redirect.Status.SeeOther });
}

/**
 * The platform customer a reader buys as. The catalog link is preferred; when it is missing
 * the platform is asked by subject, and only then is a customer created — so a reader the
 * platform already knows is adopted rather than refused as a duplicate.
 *
 * @param subject - The reader's OIDC subject, which becomes the customer's external id.
 * @param email - The address the OIDC `email` claim carried.
 */
async function customerFor(subject: string, email: string): Promise<string | null> {
	let linked = await findBillingCustomer(subject, CONNECTION);
	if (linked !== null) return linked.provider_customer_id;

	let existing = await polar.customers.find({ externalId: subject });
	if (!isFailure(existing)) {
		await linkBillingCustomer(subject, CONNECTION, existing.data.id);
		return existing.data.id;
	}

	if (existing.error.code !== "not_found") {
		currentLog()?.fail(existing.error, { billing: failureFields(existing.error) });
		return null;
	}

	let created = await polar.customers.create({ email, externalId: subject });

	if (!isFailure(created)) {
		await linkBillingCustomer(subject, CONNECTION, created.data.id);
		return created.data.id;
	}

	/**
	 * A conflict means the platform already holds this person under email or subject. Resolve
	 * the same way a first sign-in does: find them, attach the subject when an address match
	 * has none yet, and record the link so the next checkout does not ask again.
	 */
	if (created.error.code === "conflict") {
		let bySubject = await polar.customers.find({ externalId: subject });
		if (!isFailure(bySubject)) {
			await linkBillingCustomer(subject, CONNECTION, bySubject.data.id);
			return bySubject.data.id;
		}

		let byEmail = await polar.customers.findByEmail(email);
		if (!isFailure(byEmail) && byEmail.data.externalId === null) {
			let updated = await polar.customers.update({ id: byEmail.data.id }, { externalId: subject });
			if (!isFailure(updated)) {
				await linkBillingCustomer(subject, CONNECTION, updated.data.id);
				return updated.data.id;
			}
			currentLog()?.fail(updated.error, { billing: failureFields(updated.error) });
			return null;
		}

		if (!isFailure(byEmail) && byEmail.data.externalId === subject) {
			await linkBillingCustomer(subject, CONNECTION, byEmail.data.id);
			return byEmail.data.id;
		}
	}

	currentLog()?.fail(created.error, { billing: failureFields(created.error) });
	return null;
}
