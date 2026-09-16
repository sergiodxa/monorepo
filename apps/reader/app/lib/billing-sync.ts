/**
 * Turning a customer on the payment platform into the tier their object enforces against.
 * Every path here re-reads the platform rather than trusting what arrived, so a replayed,
 * late or lost delivery converges on the same answer as a sweep taken a day later.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingError, EntitlementState } from "@sdxc/billing";
import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";

import type { Tier, TierSource } from "~/app/lib/entitlement";

import { CONNECTION, failureFields, polar } from "~/app/lib/billing";
import { entitledTier, TIER_STALE_MS } from "~/app/lib/entitlement";
import {
	findBillingCustomer,
	findBillingCustomerByProviderId,
	linkBillingCustomer,
	pageBillingCustomers,
	readSubscription,
	writeSubscription,
} from "~/database/registry";
import { userStore } from "~/database/user-do";

/** Readers one page of the daily reconciliation walks. */
const SWEEP_PAGE_SIZE = 100;

/** What a snapshot with no subscription on it records as the reader's status. */
const NO_SUBSCRIPTION = "none";

/** Which path asked for a snapshot, so a log line says how the tier came to be right. */
export type SyncSource = "webhook" | "sign-in" | "sweep";

/** A customer the platform answered about that no reader of this app holds. */
export class UnknownCustomerError extends Error {
	override name = "UnknownCustomerError";

	/** @param customerId - The customer id the platform answered about. */
	constructor(readonly customerId: string) {
		super(`no reader holds billing customer ${customerId}`);
	}
}

/** What one synchronization did to a reader's tier. */
export interface SyncOutcome {
	subject: string;
	/** The tier the reader was on before the snapshot landed. */
	from: Tier;
	/** The tier the reader is on now. */
	to: Tier;
	/** The platform's own status for the subscription, or `none` while they hold none. */
	status: string;
	graceUntil: number | null;
}

/** What a synchronization reports when it could not finish. */
export type SyncFailure = BillingError | UnknownCustomerError;

/**
 * Re-reads what a customer holds on the platform, writes that into the projection, and
 * hands the snapshot to the reader's object, which decides what it does to their tier.
 *
 * A failed read writes nothing and lowers nothing, so an outage at the platform can never
 * be what downgrades somebody.
 *
 * @param customerId - The customer to re-read, as the platform names them
 * @param source - Which path asked, for the record it leaves
 * @example let synced = await syncCustomer(event.order.customerId, "webhook");
 */
export async function syncCustomer(
	customerId: string,
	source: SyncSource,
): Promise<Result<SyncOutcome, SyncFailure>> {
	let log = currentLog();

	let state = await polar.entitlements.of({ id: customerId });

	if (isFailure(state)) {
		log?.warn("billing.sync.failed", {
			customerId,
			...failureFields(state.error),
		});

		return state;
	}

	let subject = await subjectOf(state.data, customerId);
	if (subject === null) {
		let error = new UnknownCustomerError(customerId);
		log?.warn("billing.sync.failed", { customerId, code: "unknown_customer", retryable: false });

		return failure(error);
	}

	await linkBillingCustomer(subject, CONNECTION, state.data.customerId ?? customerId);

	let held = state.data.subscriptions.at(0) ?? null;
	let stored = await readSubscription(subject);
	let readAt = state.data.readAt.getTime();

	/**
	 * Kept from the last snapshot that saw the subscription. Once the platform stops
	 * reporting one there is nothing left to read the reader's own intent off, and that
	 * intent is what tells a deliberate cancellation apart from a lapse.
	 */
	let cancelled = held?.cancelAtPeriodEnd ?? stored?.cancel_at_period_end ?? false;

	await writeSubscription({
		subject,
		connection: CONNECTION,
		subscriptionId: held?.subscriptionId ?? null,
		status: held?.status ?? NO_SUBSCRIPTION,
		productSlug: held?.productSlug ?? null,
		currentPeriodEnd: held?.currentPeriodEnd?.getTime() ?? null,
		cancelAtPeriodEnd: cancelled,
		checkedAt: readAt,
		providerData: JSON.stringify(state.data.providerData),
	});

	let applied = await userStore(subject).setTier({
		entitled: entitledTier(state.data.subscriptions),
		cancelled,
		readAt,
		source: "billing" satisfies TierSource,
	});

	if (!applied.ok) {
		log?.note("billing.sync.skipped", { subject, reason: applied.reason });

		return success({
			subject,
			from: applied.tier,
			to: applied.tier,
			status: held?.status ?? NO_SUBSCRIPTION,
			graceUntil: applied.graceUntil,
		});
	}

	log?.note("billing.synced", {
		subject,
		status: held?.status ?? NO_SUBSCRIPTION,
		from: applied.from,
		to: applied.to,
		source,
	});

	if (applied.graceUntil !== null && applied.from === applied.to) {
		log?.note("billing.grace.started", {
			subject,
			tier: applied.to,
			graceUntil: applied.graceUntil,
		});
	}

	if (applied.from !== applied.to && applied.graceUntil === null) {
		log?.note("billing.grace.expired", { subject, from: applied.from, to: applied.to });
	}

	return success({
		subject,
		from: applied.from,
		to: applied.to,
		status: held?.status ?? NO_SUBSCRIPTION,
		graceUntil: applied.graceUntil,
	});
}

/**
 * Re-reads a reader's tier when the stored one has gone unconfirmed for a day, which is
 * what a sign-in does about a delivery that never arrived.
 *
 * A reader who has never reached a checkout costs one local comparison and no call at
 * all, since there is nothing the platform could say about them.
 *
 * @param subject - The reader's OIDC subject
 * @param checkedAt - Epoch milliseconds a snapshot last confirmed their tier
 * @param now - Epoch milliseconds staleness is measured from
 * @returns What the re-read did, or `null` when nothing needed re-reading
 */
export async function reconcileSubject(
	subject: string,
	checkedAt: number,
	now: number = Date.now(),
): Promise<Result<SyncOutcome, SyncFailure> | null> {
	if (now - checkedAt < TIER_STALE_MS) return null;

	let customer = await findBillingCustomer(subject, CONNECTION);
	if (customer === null) return null;

	return await syncCustomer(customer.provider_customer_id, "sign-in");
}

/** What one walk of the readers who have ever paid got through. */
export interface ReconcileResult {
	customers: number;
	changed: number;
	failed: number;
	durationMs: number;
}

/**
 * Walks every reader holding a customer record and re-reads what the platform says about
 * them, which is what recovers a delivery nobody ever received.
 *
 * It is bounded by how many readers have reached a checkout rather than by how many
 * readers exist, so it stays affordable at any size the free tier reaches.
 *
 * @param pageSize - Readers one page holds
 * @example let swept = await reconcileBilling();
 */
export async function reconcileBilling(
	pageSize: number = SWEEP_PAGE_SIZE,
): Promise<ReconcileResult> {
	let started = Date.now();
	let result: ReconcileResult = { customers: 0, changed: 0, failed: 0, durationMs: 0 };
	let after: string | null = null;

	for (;;) {
		let page = await pageBillingCustomers(CONNECTION, pageSize, after);
		if (page.length === 0) break;

		for (let customer of page) {
			result.customers += 1;

			let synced = await syncCustomer(customer.provider_customer_id, "sweep");

			if (isFailure(synced)) result.failed += 1;
			else if (synced.data.from !== synced.data.to) result.changed += 1;
		}

		let last = page.at(-1);
		if (last === undefined || page.length < pageSize) break;
		after = last.subject;
	}

	result.durationMs = Date.now() - started;
	currentLog()?.note("billing.reconciled", { ...result });

	return result;
}

/**
 * Which reader a snapshot is about, preferring the subject the customer was created with
 * and falling back to the stored link for a customer some support action created without
 * one.
 */
async function subjectOf(state: EntitlementState, customerId: string): Promise<string | null> {
	if (state.externalId !== null) return state.externalId;

	let link = await findBillingCustomerByProviderId(CONNECTION, state.customerId ?? customerId);

	return link?.subject ?? null;
}
