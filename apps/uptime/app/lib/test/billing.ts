/**
 * Test-only billing fixtures: a platform that really bills, and the two projection states a
 * test ever needs to arrange.
 *
 * The projection is written the way production writes it — from an entitlement snapshot,
 * through `Subscription.sync` — so a test seeds the state a webhook would have left rather
 * than the columns it happens to produce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementState, SubscriptionStatus, UsageRecord } from "@pkg/billing";
import type { Database } from "remix/data-table";

import { MemoryBilling } from "@pkg/billing/providers/memory";
import { unwrap } from "@pkg/result";

import Subscription from "~/app/data/subscription";
import { MONITORING_PRODUCT, PING_METER } from "~/app/lib/billing";

/** The fields of an entitlement snapshot a test may need to vary. */
export interface EntitlementOptions {
	subscriptionId?: string;
	/** Our own name for what is held; a different slug is a product this app does not sell. */
	productSlug?: string;
	status?: SubscriptionStatus;
	/** The app-owned id the platform customer is linked to; `null` for an unlinked customer. */
	externalId?: string | null;
	/** ISO timestamp the platform answered at, which orders one write against another. */
	readAt?: string;
	/** ISO timestamp the paid period runs to. */
	currentPeriodEnd?: string;
}

/** A snapshot holding one monitoring subscription, active unless told otherwise. */
export function entitlementState(options: EntitlementOptions = {}): EntitlementState {
	let productSlug = options.productSlug ?? MONITORING_PRODUCT;

	return {
		customerId: "cus_1",
		externalId: options.externalId === undefined ? "owner-1" : options.externalId,
		products: [productSlug],
		features: {},
		meters: [],
		subscriptions: [
			{
				subscriptionId: options.subscriptionId ?? "sub_1",
				productSlug,
				status: options.status ?? "active",
				currentPeriodEnd: new Date(options.currentPeriodEnd ?? "2026-08-01T00:00:00.000Z"),
				cancelAtPeriodEnd: false,
			},
		],
		readAt: new Date(options.readAt ?? "2026-07-15T00:00:00.000Z"),
		providerData: {},
	};
}

/** A snapshot holding nothing at all, which is what a lapsed customer's read answers. */
export function emptyEntitlementState(options: EntitlementOptions = {}): EntitlementState {
	return {
		...entitlementState(options),
		products: [],
		subscriptions: [],
	};
}

/**
 * Records an active monitoring subscription for `ownerId`, the way a delivery would, so
 * entitlement gates in tests read the answer straight from this projection.
 */
export async function createActiveSubscription(db: Database, ownerId: string): Promise<void> {
	await Subscription.sync(db, ownerId, entitlementState());
}

/**
 * Records a revoked subscription for `ownerId` — a *positively known* unentitled state, which
 * is the only one an entitlement gate refuses. Distinct from seeding nothing, which leaves the
 * state unknown and therefore allowed. Written the way it really happens: the subscription is
 * held, and then a later read no longer lists it.
 */
export async function createRevokedSubscription(db: Database, ownerId: string): Promise<void> {
	await Subscription.sync(db, ownerId, entitlementState());
	await Subscription.sync(
		db,
		ownerId,
		emptyEntitlementState({ readAt: "2026-07-20T00:00:00.000Z" }),
	);
}

/**
 * A billing platform a test can drive end to end. It is the real contract rather than a
 * double, so what one call writes is what the next call reads.
 */
export function createTestBilling(): MemoryBilling {
	return new MemoryBilling({
		catalog: {
			[MONITORING_PRODUCT]: {
				amount: 900,
				currency: "usd",
				interval: "month",
				meter: PING_METER,
			},
		},
	});
}

/** Every usage event a test's platform was handed, in ingestion order. */
export async function billedEvents(billing: MemoryBilling): Promise<UsageRecord[]> {
	return (await unwrap(billing.usage.list({ limit: 1000 }))).items;
}
