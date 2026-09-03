/**
 * The entitlement sync: re-reads what a customer holds on the billing platform and
 * writes that snapshot into the control plane, then fans the verdict out to the
 * account's blogs, so a request decides entitlement from our own tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {
	Billing,
	EntitlementState,
	EntitlementSubscription,
	SubscriptionStatus as PlatformStatus,
} from "@pkg/billing";
import type { Database } from "remix/data-table";

import { isFailure } from "@pkg/result";

import type { SubscriptionStatus } from "~/app/models/subscription";

import { PRO_PRODUCT } from "~/app/lib/billing";
import Account from "~/app/models/account";
import BillingCustomer from "~/app/models/billing-customer";
import Subscription from "~/app/models/subscription";

/** Applies an entitlement verdict to every blog an account owns. */
export interface BlogFanOut {
	/**
	 * Puts an account's blogs into the status its entitlement calls for.
	 *
	 * @param accountId The owning account.
	 * @param status Whether the blogs serve or are suspended.
	 */
	setAccountBlogsStatus(accountId: string, status: "active" | "suspended"): Promise<void>;
}

/**
 * Maps a platform status onto the one the control plane stores. A revoked
 * subscription is stored as canceled, since both mean access has ended and the
 * dashboard shows one word for it.
 *
 * @param status The status the platform reported.
 * @returns The status to project.
 * @example
 * projectStatus("revoked"); // "canceled"
 */
export function projectStatus(status: PlatformStatus): SubscriptionStatus {
	return status === "revoked" ? "canceled" : status;
}

/**
 * Picks the subscription that carries entitlement, which is the one selling the
 * platform product; a subscription for anything else grants nothing here.
 *
 * @param state The snapshot the platform answered with.
 * @returns The entitling subscription, or `null` when the customer holds none.
 */
export function entitlingSubscription(state: EntitlementState): EntitlementSubscription | null {
	return state.subscriptions.find((row) => row.productSlug === PRO_PRODUCT) ?? null;
}

/**
 * Decides the status an account's blogs are fanned out to: serving while the
 * subscription is paid or in trial, suspended for every other state, so a
 * downgrade takes the blogs offline as soon as the platform reports it.
 *
 * @param subscription The entitling subscription, or `null` when there is none.
 * @returns `"active"` when entitled, otherwise `"suspended"`.
 * @example
 * blogStatusFor(null); // "suspended"
 */
export function blogStatusFor(
	subscription: EntitlementSubscription | null,
): "active" | "suspended" {
	if (subscription === null) return "suspended";
	return subscription.status === "active" || subscription.status === "trialing"
		? "active"
		: "suspended";
}

/**
 * Re-reads a customer's entitlements and writes them into the control plane: the
 * customer link, the subscription projection, and the blog fan-out. A delivery is
 * only a hint that something moved, so the snapshot decides what is stored.
 *
 * @param billing The platform the customer was reported by.
 * @param db The control-plane database.
 * @param blogs The fan-out the entitlement verdict is applied through.
 * @param customerId The platform's customer id, as the delivery named it.
 * @returns A promise resolving once the projection is written.
 * @throws The billing failure, when the platform cannot answer the snapshot.
 */
export async function syncEntitlements(
	billing: Billing,
	db: Database,
	blogs: BlogFanOut,
	customerId: string | null,
): Promise<void> {
	if (customerId === null) return;

	let read = await billing.entitlements.of({ id: customerId });
	if (isFailure(read)) throw read.error;

	let state = read.data;
	let accountId = state.externalId;
	if (accountId === null) return;

	let account = await Account.findById(db, accountId);
	if (!account) return;

	await BillingCustomer.link(db, accountId, billing.connection, customerId);

	let subscription = entitlingSubscription(state);

	await Subscription.upsert(db, accountId, {
		billing_subscription_id: subscription?.subscriptionId ?? null,
		billing_product_slug: subscription?.productSlug ?? null,
		status: subscription ? projectStatus(subscription.status) : "canceled",
		current_period_end: subscription?.currentPeriodEnd?.toISOString() ?? null,
	});

	await blogs.setAccountBlogsStatus(accountId, blogStatusFor(subscription));
}
