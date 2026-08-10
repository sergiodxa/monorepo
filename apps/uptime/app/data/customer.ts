/**
 * Billing customer provisioning for the auth flow. Resolves a signed-in subject to a
 * Polar customer — by external id first, then by email, creating one when neither
 * exists — and links the external id when a matched customer lacks one. Wraps
 * `@pkg/polar` so login provisioning stays independent of the Polar SDK's shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarClient } from "@pkg/polar";

import type IdToken from "~/app/auth/value-objects/id-token";

import { SUBSCRIPTION_PRODUCT_ID } from "~/app/data/subscription";

export default class Customer {
	/**
	 * Finds or creates the Polar customer for a signed-in subject, linking the
	 * external id when an existing customer (found by email) is missing one.
	 */
	static async findOrCreate(polar: PolarClient, idToken: IdToken) {
		let customer = await polar.getExternalCustomer(idToken.subject);
		if (customer) return customer;

		customer = await polar.findCustomerByEmail(idToken.email);
		if (!customer) return await polar.createCustomer(idToken.email, idToken.name);
		if (customer.externalId) return customer;

		return await polar.updateCustomer(customer.id, { externalId: idToken.subject });
	}

	/** Creates a hosted Polar checkout session for the team owner to subscribe. */
	static async checkout(polar: PolarClient, ownerId: string, successUrl: string): Promise<string> {
		let customer = await polar.getExternalCustomer(ownerId);
		let session = await polar.createCheckoutSession(
			SUBSCRIPTION_PRODUCT_ID,
			customer?.id,
			successUrl,
		);
		return session.url;
	}

	/** Creates a hosted Polar customer-portal session for the team owner to manage billing. */
	static async portal(polar: PolarClient, ownerId: string): Promise<string> {
		let customer = await polar.getExternalCustomer(ownerId);
		if (!customer) throw new Error(`No Polar customer found for owner ${ownerId}`);
		let session = await polar.createPortalSession(customer.id);
		return session.url;
	}

	/**
	 * Revokes every active monitoring subscription for the team owner (used on team
	 * deletion). Best-effort: a Polar failure here must never block deleting the
	 * team and its data, so any error is swallowed, matching
	 * {@link PolarClient.hasActiveSubscription}'s fail-open convention.
	 */
	static async cancelSubscriptions(polar: PolarClient, ownerId: string): Promise<void> {
		try {
			let subscriptions = await polar.listActiveSubscriptions(ownerId, SUBSCRIPTION_PRODUCT_ID);
			await Promise.all(
				subscriptions.map((subscription) => polar.revokeSubscription(subscription.id)),
			);
		} catch {
			// intentionally empty
		}
	}
}
