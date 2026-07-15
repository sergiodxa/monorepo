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

/** The Polar product id a paying team's owner must hold an active subscription to. */
const SUBSCRIPTION_PRODUCT_ID = "94161883-14eb-42e2-bb26-b4647199cda1";

/** The Polar meter id tracking ingested `ping` usage events. */
const PING_METER_ID = "22fabd9b-8b03-4cc2-8981-230717267cd5";

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

	/** Whether the team owner (by external id) has an active monitoring subscription. */
	static async hasActiveSubscription(polar: PolarClient, ownerId: string): Promise<boolean> {
		return await polar.hasActiveSubscription(ownerId, SUBSCRIPTION_PRODUCT_ID);
	}

	/**
	 * The team's Polar-billed `ping` usage for the calendar month containing `date`,
	 * scoped to `teamId` via the meter's ingested metadata (see
	 * `~/app/jobs/ping.ts`/`~/workflows/ping.ts` for where usage would be ingested).
	 * Throws when the request fails or the owner has no Polar customer — callers on
	 * a billing dashboard should treat that as "usage unavailable" rather than "0".
	 */
	static async getUsagePerMonth(polar: PolarClient, ownerId: string, teamId: string, date: Date) {
		let start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
		let end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
		return await polar.getMeterUsage(ownerId, PING_METER_ID, { start, end }, { teamId });
	}

	/**
	 * The same monthly `ping` usage as {@link getUsagePerMonth}, scoped down further to
	 * one monitor's own ingested metadata, for a monitor detail page's usage stat.
	 */
	static async getUsagePerMonthForMonitor(
		polar: PolarClient,
		ownerId: string,
		monitorId: string,
		date: Date,
	) {
		let start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
		let end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
		return await polar.getMeterUsage(ownerId, PING_METER_ID, { start, end }, { monitorId });
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
