/**
 * Data model for tenant billing subscriptions. Wraps the `subscriptions` D1 table and
 * the billing platform, handling customer/subscription creation, entitlement syncing,
 * cancellation, and checkout/portal URL generation, plus status label/color helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingError, CustomerRef, EntitlementState, SubscriptionStatus } from "@pkg/billing";
import type { Result } from "@pkg/result";
import type { Database, TableRow } from "remix/data-table";

import { failure, isFailure, success } from "@pkg/result";
import { column as c, table } from "remix/data-table";

import { CONNECTION, PLAN, polar } from "~/app/lib/billing";
import BillingCustomer from "~/app/models/billing-customer";

/** What the platform's own records could not supply for a billing action. */
export type SubscriptionErrorReason =
	| "no_subscription"
	| "no_billing_customer"
	| "unknown_customer"
	| "unpayable_checkout";

/** What each reason means to whoever reads the log line it produces. */
const REASON_MESSAGES: Record<SubscriptionErrorReason, string> = {
	no_subscription: "no subscription exists for tenant",
	no_billing_customer: "no billing customer is linked to tenant",
	unknown_customer: "no tenant holds billing customer",
	unpayable_checkout: "the checkout session is no longer payable for tenant",
};

/**
 * A billing action that our own records cannot complete, as distinct from one the
 * platform refused: the caller sees which record was missing and for whom.
 */
export class SubscriptionError extends Error {
	override name = "SubscriptionError";

	/**
	 * @param reason - Which record the action needed and did not find.
	 * @param subject - The tenant, or the provider customer id, the action was about.
	 */
	constructor(
		readonly reason: SubscriptionErrorReason,
		readonly subject: string,
	) {
		super(`${REASON_MESSAGES[reason]} ${subject}`);
	}
}

/** The `subscriptions` D1 table: one row per tenant, projecting what the platform reports. */
const SUBSCRIPTIONS_TABLE = table({
	name: "subscriptions",
	primaryKey: ["id"],
	timestamps: true,
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		billing_connection: c.text(),
		billing_subscription_id: c.text().nullable(),
		status: c.enum(["active", "canceled", "past_due", "unpaid", "incomplete", "trialing"]),
		current_period_start: c.text().nullable(),
		current_period_end: c.text().nullable(),
		provider_data: c.text().nullable(),
		created_at: c.text(),
		updated_at: c.text(),
	},
});

/** One tenant's subscription as the platform database holds it. */
export type SubscriptionRow = TableRow<typeof SUBSCRIPTIONS_TABLE>;

/**
 * What a billing action reports when it fails: the platform refused, or our own
 * records could not supply what the action needed.
 */
export type SubscriptionFailure = BillingError | SubscriptionError;

/**
 * The identifier a reference names, so a failure about a customer we could not
 * resolve still says which customer it was about.
 */
function refSubject(customer: CustomerRef): string {
	return "id" in customer ? customer.id : customer.externalId;
}

/**
 * Active-record–style model for tenant subscriptions, exposing static query and
 * mutation helpers over the `subscriptions` table plus the billing integration.
 * Every call reaching the platform answers a `Result` rather than throwing.
 *
 * @example
 * let subscription = await Subscription.findByTenant(db, tenantId);
 */
export default class Subscription {
	/** The `subscriptions` D1 table definition (columns, primary key, timestamps). */
	static table = SUBSCRIPTIONS_TABLE;

	/**
	 * Subscription statuses that entitle a tenant to serve traffic: `active` and
	 * `trialing` grant full access, `past_due` keeps access with a warning. Kept
	 * in sync with the subscription middleware so both gates agree on suspension.
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
	 * Maps a platform subscription status onto our own enum, where a revoked
	 * subscription and a canceled one are the same lapsed state locally.
	 *
	 * @param status - The status the billing platform reports.
	 * @returns The equivalent local subscription status.
	 */
	static mapBillingStatus(
		status: SubscriptionStatus,
	): "active" | "canceled" | "past_due" | "unpaid" | "incomplete" | "trialing" {
		return status === "revoked" ? "canceled" : status;
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
	 * Creates a tenant's customer on the billing platform and the trialing
	 * subscription row that mirrors it. The customer carries the tenant id as its
	 * external id, so the link stays recoverable from the platform alone.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant to create the subscription for.
	 * @param ownerEmail - The owner email the customer record is created with.
	 * @param tenantName - The tenant display name for the customer record.
	 * @returns The newly-created (trialing) subscription row, or the platform's failure.
	 */
	static async create(
		db: Database,
		tenantId: string,
		ownerEmail: string,
		tenantName: string,
	): Promise<Result<SubscriptionRow, SubscriptionFailure>> {
		let customer = await polar.customers.create({
			email: ownerEmail,
			name: tenantName,
			externalId: tenantId,
			metadata: { tenant_id: tenantId },
		});

		if (isFailure(customer)) return customer;

		let id = crypto.randomUUID();
		let now = new Date().toISOString();

		await BillingCustomer.link(db, tenantId, polar.connection, customer.data.id);

		await db.create(Subscription.table, {
			id,
			tenant_id: tenantId,
			billing_connection: polar.connection,
			billing_subscription_id: null,
			status: "trialing",
			current_period_start: now,
			current_period_end: null,
			provider_data: null,
			created_at: now,
			updated_at: now,
		});

		return success((await db.findOne(Subscription.table, { where: { id } }))!);
	}

	/**
	 * Re-reads what a customer holds on the platform and writes that snapshot into
	 * the tenant's row. A delivery says something changed and this says what is
	 * true now, so replays and out-of-order deliveries converge on the same state.
	 *
	 * @param db - The platform database handle.
	 * @param customer - The customer to re-read, by either identifier.
	 * @returns The subscription row as stored after the sync, or the failure that stopped it.
	 */
	static async syncFromBilling(
		db: Database,
		customer: CustomerRef,
	): Promise<Result<SubscriptionRow, SubscriptionFailure>> {
		let state = await polar.entitlements.of(customer);
		if (isFailure(state)) return state;

		let tenantId = await Subscription.#tenantOf(db, state.data, customer);
		if (isFailure(tenantId)) return tenantId;

		let subscription = await db.findOne(Subscription.table, {
			where: { tenant_id: tenantId.data },
		});
		if (!subscription) {
			return failure(new SubscriptionError("no_subscription", tenantId.data));
		}

		let held = state.data.subscriptions.at(0);

		if (held === undefined) {
			await db.update(
				Subscription.table,
				{ id: subscription.id },
				{ status: "canceled", updated_at: new Date().toISOString() },
			);

			return success((await db.findOne(Subscription.table, { where: { id: subscription.id } }))!);
		}

		let detail = await polar.subscriptions.find(held.subscriptionId);
		if (isFailure(detail)) return detail;

		await db.update(
			Subscription.table,
			{ id: subscription.id },
			{
				billing_connection: polar.connection,
				billing_subscription_id: detail.data.id,
				status: Subscription.mapBillingStatus(detail.data.status),
				current_period_start: detail.data.currentPeriodStart?.toISOString() ?? null,
				current_period_end: detail.data.currentPeriodEnd?.toISOString() ?? null,
				provider_data: JSON.stringify(detail.data.providerData),
				updated_at: new Date().toISOString(),
			},
		);

		return success((await db.findOne(Subscription.table, { where: { id: subscription.id } }))!);
	}

	/**
	 * Stops a tenant's subscription on the platform and marks the row canceled, so
	 * the entitlement gate closes on the tenant's next request rather than at the
	 * end of the paid period.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose subscription to cancel.
	 * @returns The canceled subscription row, or the failure that stopped it.
	 */
	static async cancel(
		db: Database,
		tenantId: string,
	): Promise<Result<SubscriptionRow, SubscriptionFailure>> {
		let subscription = await db.findOne(Subscription.table, {
			where: { tenant_id: tenantId },
		});
		if (!subscription) return failure(new SubscriptionError("no_subscription", tenantId));

		if (subscription.billing_subscription_id) {
			let canceled = await polar.subscriptions.cancel(subscription.billing_subscription_id);
			if (isFailure(canceled)) return canceled;
		}

		await db.update(
			Subscription.table,
			{ id: subscription.id },
			{ status: "canceled", updated_at: new Date().toISOString() },
		);

		return success((await db.findOne(Subscription.table, { where: { id: subscription.id } }))!);
	}

	/**
	 * Opens a hosted checkout for the tenant's plan. The idempotency key is derived
	 * from the tenant, so a resubmitted form reaches the session already open
	 * instead of opening a second one.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant initiating checkout.
	 * @param successUrl - Where the platform returns the customer after paying.
	 * @returns The hosted checkout URL, or the failure that stopped it.
	 */
	static async createCheckoutUrl(
		db: Database,
		tenantId: string,
		successUrl: string,
	): Promise<Result<string, SubscriptionFailure>> {
		let customer = await BillingCustomer.findByTenant(db, tenantId);
		if (!customer) return failure(new SubscriptionError("no_billing_customer", tenantId));

		let checkout = await polar.checkouts.create({
			product: PLAN,
			customer: { id: customer.provider_customer_id },
			returnTo: successUrl,
			metadata: { tenant_id: tenantId },
			idempotencyKey: `checkout_${tenantId}_${PLAN}`,
		});

		if (isFailure(checkout)) return checkout;
		if (checkout.data.url === null) {
			return failure(new SubscriptionError("unpayable_checkout", tenantId));
		}

		return success(checkout.data.url);
	}

	/**
	 * Opens the hosted page where a tenant manages payment methods, invoices and
	 * its plan, which is what keeps proration the platform's problem.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose billing portal to open.
	 * @returns The hosted portal URL, or the failure that stopped it.
	 */
	static async createPortalUrl(
		db: Database,
		tenantId: string,
	): Promise<Result<string, SubscriptionFailure>> {
		let customer = await BillingCustomer.findByTenant(db, tenantId);
		if (!customer) return failure(new SubscriptionError("no_billing_customer", tenantId));

		let portal = await polar.portal.create({ customer: { id: customer.provider_customer_id } });
		if (isFailure(portal)) return portal;

		return success(portal.data.url);
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

	/**
	 * Resolves which tenant a snapshot is about, preferring the external id the
	 * customer was created with and falling back to the stored link for a customer
	 * created before that id was set.
	 */
	static async #tenantOf(
		db: Database,
		state: EntitlementState,
		customer: CustomerRef,
	): Promise<Result<string, SubscriptionError>> {
		if (state.externalId !== null) return success(state.externalId);

		let providerCustomerId = state.customerId ?? ("id" in customer ? customer.id : null);
		if (providerCustomerId === null) {
			return failure(new SubscriptionError("unknown_customer", refSubject(customer)));
		}

		let link = await BillingCustomer.findByProviderId(db, CONNECTION, providerCustomerId);
		if (!link) return failure(new SubscriptionError("unknown_customer", providerCustomerId));

		return success(link.tenant_id);
	}
}
