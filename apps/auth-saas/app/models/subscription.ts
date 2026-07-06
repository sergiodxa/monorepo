/**
 * Data model for tenant billing subscriptions. Wraps the `subscriptions` D1 table and
 * the Polar billing API, handling customer/subscription creation, status syncing,
 * cancellation, and checkout/portal URL generation, plus status label/color helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { PolarClient, PolarError } from "@pkg/polar";
import { env } from "cloudflare:workers";
import { column as c, table } from "remix/data-table";

/**
 * Lazily-constructed shared Polar client. Created once from the access token in
 * the environment and reused across calls (the previous service instantiated the
 * SDK per call; a single instance is behaviour-identical and cheaper).
 */
let polarClient: PolarClient | undefined;

/**
 * Get the shared {@link PolarClient}, constructing it on first use.
 * @returns The Polar billing client configured from `POLAR_ACCESS_TOKEN`.
 */
function polar(): PolarClient {
	return (polarClient ??= new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN }));
}

/**
 * Active-record–style model for tenant subscriptions, exposing static query and
 * mutation helpers over the `subscriptions` table plus Polar billing integration.
 *
 * @example
 * let subscription = await Subscription.findByTenant(db, tenantId);
 */
export default class Subscription {
	/** Re-exported Polar API error type for callers to catch. */
	static PolarApiError = PolarError;

	/** Error thrown when no subscription exists for a given tenant. */
	static NotFoundError = class extends Error {
		override name = "SubscriptionNotFoundError";
		/** @param tenantId - The tenant whose subscription was not found. */
		constructor(public tenantId: string) {
			super(`Subscription for tenant ${tenantId} not found`);
		}
	};

	/** The `subscriptions` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "subscriptions",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			polar_customer_id: c.text().nullable(),
			polar_subscription_id: c.text().nullable(),
			status: c.enum(["active", "canceled", "past_due", "unpaid", "incomplete", "trialing"]),
			current_period_start: c.text().nullable(),
			current_period_end: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Subscription statuses that entitle a tenant to serve traffic. `active` and
	 * `trialing` grant full access; `past_due` keeps access with a warning (the dashboard
	 * subscription gate only blocks `canceled`/`unpaid`/`incomplete`). Kept in sync with
	 * the subscription middleware so the runtime entitlement gate and the dashboard gate
	 * agree on when a tenant's OIDC provider surface stays up.
	 */
	static ENTITLING_STATUSES = new Set(["active", "trialing", "past_due"]);

	/**
	 * Whether a subscription status entitles the tenant to serve its OIDC provider surface.
	 *
	 * @param status - The local subscription status value.
	 * @returns `true` when the tenant should keep serving, `false` when it must be suspended.
	 * @example
	 * await api.setSuspended(!Subscription.isEntitled(newStatus));
	 */
	static isEntitled(status: string): boolean {
		return Subscription.ENTITLING_STATUSES.has(status);
	}

	/**
	 * Map Polar subscription status to our status enum.
	 *
	 * @param polarStatus - The raw status string returned by Polar.
	 * @returns The equivalent local subscription status (defaults to `incomplete`).
	 */
	static mapPolarStatus(
		polarStatus: string,
	): "active" | "canceled" | "past_due" | "unpaid" | "incomplete" | "trialing" {
		switch (polarStatus) {
			case "active":
				return "active";
			case "canceled":
			case "revoked":
				return "canceled";
			case "past_due":
				return "past_due";
			case "unpaid":
				return "unpaid";
			case "incomplete":
			case "incomplete_expired":
				return "incomplete";
			case "trialing":
				return "trialing";
			default:
				return "incomplete";
		}
	}

	/**
	 * Get subscription by tenant ID.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose subscription to fetch.
	 * @returns A promise resolving to the subscription row, or null when none exists.
	 */
	static findByTenant(db: Database, tenantId: string) {
		return db.findOne(Subscription.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Get subscription by ID.
	 *
	 * @param db - The platform database handle.
	 * @param id - The subscription id.
	 * @returns A promise resolving to the subscription row, or null when none exists.
	 */
	static show(db: Database, id: string) {
		return db.findOne(Subscription.table, { where: { id } });
	}

	/**
	 * Create a subscription record for a tenant.
	 * Also creates a customer in Polar if not already existing.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant to create the subscription for.
	 * @param ownerEmail - The owner email used to create the Polar customer.
	 * @param tenantName - The tenant display name for the Polar customer.
	 * @returns A promise resolving to the newly-created (trialing) subscription row.
	 * @throws {PolarError} When creating the Polar customer fails.
	 */
	static async create(db: Database, tenantId: string, ownerEmail: string, tenantName: string) {
		let id = crypto.randomUUID();
		let now = new Date().toISOString();

		// Create customer in Polar
		let customer = await polar().createCustomer(ownerEmail, tenantName, {
			tenant_id: tenantId,
		});

		await db.create(Subscription.table, {
			id,
			tenant_id: tenantId,
			polar_customer_id: customer.id,
			polar_subscription_id: null,
			status: "trialing", // Start with trial
			current_period_start: now,
			current_period_end: null,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(Subscription.table, { where: { id } }))!;
	}

	/**
	 * Update subscription with Polar subscription details.
	 * Called after checkout completion or webhook.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose subscription to link.
	 * @param polarSubscriptionId - The Polar subscription id to attach and sync from.
	 * @returns A promise resolving to the updated subscription row.
	 * @throws {Subscription.NotFoundError} When the tenant has no subscription record.
	 */
	static async linkPolarSubscription(db: Database, tenantId: string, polarSubscriptionId: string) {
		let subscription = await db.findOne(Subscription.table, {
			where: { tenant_id: tenantId },
		});
		if (!subscription) throw new Subscription.NotFoundError(tenantId);

		// Fetch subscription details from Polar
		let polarSub = await polar().getSubscription(polarSubscriptionId);

		// Map Polar status to our status enum
		let status = Subscription.mapPolarStatus(polarSub.status);

		await db.update(
			Subscription.table,
			{ id: subscription.id },
			{
				polar_subscription_id: polarSubscriptionId,
				status,
				current_period_start: polarSub.currentPeriodStart?.toISOString() ?? null,
				current_period_end: polarSub.currentPeriodEnd?.toISOString() ?? null,
				updated_at: new Date().toISOString(),
			},
		);

		return (await db.findOne(Subscription.table, { where: { id: subscription.id } }))!;
	}

	/**
	 * Sync subscription status from Polar.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose subscription to sync.
	 * @returns A promise resolving to the (possibly-updated) subscription row; unchanged
	 * when no Polar subscription is linked yet.
	 * @throws {Subscription.NotFoundError} When the tenant has no subscription record.
	 */
	static async syncFromPolar(db: Database, tenantId: string) {
		let subscription = await db.findOne(Subscription.table, {
			where: { tenant_id: tenantId },
		});
		if (!subscription) throw new Subscription.NotFoundError(tenantId);

		if (!subscription.polar_subscription_id) {
			// No subscription linked yet, nothing to sync
			return subscription;
		}

		let polarSub = await polar().getSubscription(subscription.polar_subscription_id);

		// Map Polar status to our status enum
		let status = Subscription.mapPolarStatus(polarSub.status);

		await db.update(
			Subscription.table,
			{ id: subscription.id },
			{
				status,
				current_period_start: polarSub.currentPeriodStart?.toISOString() ?? null,
				current_period_end: polarSub.currentPeriodEnd?.toISOString() ?? null,
				updated_at: new Date().toISOString(),
			},
		);

		return (await db.findOne(Subscription.table, { where: { id: subscription.id } }))!;
	}

	/**
	 * Cancel subscription at period end.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose subscription to cancel.
	 * @returns A promise resolving to the canceled subscription row.
	 * @throws {Subscription.NotFoundError} When the tenant has no subscription record.
	 */
	static async cancel(db: Database, tenantId: string) {
		let subscription = await db.findOne(Subscription.table, {
			where: { tenant_id: tenantId },
		});
		if (!subscription) throw new Subscription.NotFoundError(tenantId);

		if (subscription.polar_subscription_id) {
			await polar().revokeSubscription(subscription.polar_subscription_id);
		}

		await db.update(
			Subscription.table,
			{ id: subscription.id },
			{
				status: "canceled",
				updated_at: new Date().toISOString(),
			},
		);

		return (await db.findOne(Subscription.table, { where: { id: subscription.id } }))!;
	}

	/**
	 * Create a checkout session URL for upgrading to a paid plan.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant initiating checkout.
	 * @param productId - The Polar product id to check out.
	 * @param successUrl - The URL Polar redirects to after a successful checkout.
	 * @returns A promise resolving to the hosted Polar checkout URL.
	 * @throws {Subscription.NotFoundError} When the tenant has no subscription record.
	 * @throws {Error} When the subscription has no linked Polar customer.
	 */
	static async createCheckoutUrl(
		db: Database,
		tenantId: string,
		productId: string,
		successUrl: string,
	): Promise<string> {
		let subscription = await db.findOne(Subscription.table, {
			where: { tenant_id: tenantId },
		});
		if (!subscription) throw new Subscription.NotFoundError(tenantId);
		if (!subscription.polar_customer_id) {
			throw new Error("No Polar customer linked to this subscription");
		}

		let checkout = await polar().createCheckoutSession(
			productId,
			subscription.polar_customer_id,
			successUrl,
			{ tenant_id: tenantId },
		);

		return checkout.url;
	}

	/**
	 * Create a customer portal session URL for managing subscription.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose billing portal to open.
	 * @returns A promise resolving to the hosted Polar customer-portal URL.
	 * @throws {Subscription.NotFoundError} When the tenant has no subscription record.
	 * @throws {Error} When the subscription has no linked Polar customer.
	 */
	static async createPortalUrl(db: Database, tenantId: string): Promise<string> {
		let subscription = await db.findOne(Subscription.table, {
			where: { tenant_id: tenantId },
		});
		if (!subscription) throw new Subscription.NotFoundError(tenantId);
		if (!subscription.polar_customer_id) {
			throw new Error("No Polar customer linked to this subscription");
		}

		let portal = await polar().createPortalSession(subscription.polar_customer_id);
		return portal.url;
	}

	/**
	 * Get human-readable status label.
	 *
	 * @param status - The subscription status value.
	 * @returns A human-readable label (e.g. "Active", "Trial", "Past Due").
	 */
	static getStatusLabel(status: string): string {
		switch (status) {
			case "active":
				return "Active";
			case "trialing":
				return "Trial";
			case "canceled":
				return "Canceled";
			case "past_due":
				return "Past Due";
			case "unpaid":
				return "Unpaid";
			case "incomplete":
				return "Incomplete";
			default:
				return status;
		}
	}

	/**
	 * Get status badge color class.
	 *
	 * @param status - The subscription status value.
	 * @returns Tailwind background/text color classes for the status badge.
	 */
	static getStatusColor(status: string): string {
		switch (status) {
			case "active":
				return "bg-green-100 text-green-800";
			case "trialing":
				return "bg-blue-100 text-blue-800";
			case "canceled":
				return "bg-gray-100 text-gray-800";
			case "past_due":
			case "unpaid":
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	}
}
