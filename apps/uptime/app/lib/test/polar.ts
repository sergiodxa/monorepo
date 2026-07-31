/**
 * Test-only Polar fixtures. A `Subscription` as the API returns one is a deep object —
 * the product, its prices, its meters, the customer's state — while everything that reads
 * one in this app touches a handful of fields, so building one needs a cast. This module is
 * where that cast lives, once, instead of once per test file that needs a subscription.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subscription as PolarSubscription } from "@pkg/polar";
import type { Database } from "remix/data-table";

import Subscription, { SUBSCRIPTION_PRODUCT_ID } from "~/app/data/subscription";

/** The fields of a Polar subscription a test may need to vary. */
export interface PolarSubscriptionOptions {
	id?: string;
	productId?: string;
	status?: string;
	/** The app-owned id the Polar customer is linked to; `null` for an unlinked customer. */
	externalId?: string | null;
	/**
	 * ISO timestamp Polar last modified the subscription at, the upsert's version stamp.
	 * `null` for a subscription Polar has never modified since creating it.
	 */
	modifiedAt?: string | null;
	/** ISO timestamp Polar ended the subscription at, if it has. */
	endedAt?: string;
}

/** A Polar subscription to the monitoring product, active unless told otherwise. */
export function polarSubscription(options: PolarSubscriptionOptions = {}): PolarSubscription {
	let payload = {
		id: options.id ?? "sub_1",
		productId: options.productId ?? SUBSCRIPTION_PRODUCT_ID,
		status: options.status ?? "active",
		createdAt: new Date("2026-07-01T00:00:00.000Z"),
		modifiedAt:
			options.modifiedAt === null
				? null
				: new Date(options.modifiedAt ?? "2026-07-15T00:00:00.000Z"),
		currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
		endedAt: options.endedAt === undefined ? null : new Date(options.endedAt),
		customerId: "cus_1",
		customer: {
			id: "cus_1",
			externalId: options.externalId === undefined ? "owner-1" : options.externalId,
		},
	};

	return payload as unknown as PolarSubscription;
}

/**
 * Records an active monitoring subscription for `ownerId`, the way the Polar webhook would.
 * For tests of anything that gates on entitlement, since the answer comes from this
 * projection and no longer from a Polar lookup.
 */
export async function createActiveSubscription(db: Database, ownerId: string): Promise<void> {
	await Subscription.upsert(db, ownerId, polarSubscription());
}

/**
 * Records a revoked subscription for `ownerId` — a *positively known* unentitled state,
 * which is the only one an entitlement gate refuses. Distinct from seeding nothing, which
 * leaves the state unknown and therefore allowed.
 */
export async function createRevokedSubscription(db: Database, ownerId: string): Promise<void> {
	await Subscription.upsert(
		db,
		ownerId,
		polarSubscription({ status: "revoked", endedAt: "2026-07-20T00:00:00.000Z" }),
	);
}
