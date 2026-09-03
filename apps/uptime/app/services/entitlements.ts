/**
 * The one way billing state reaches this app's tables: ask the platform what a customer holds
 * right now, write that, and move their monitors to match.
 *
 * Both writers of the projection go through here — the webhook endpoint, which learns *that*
 * something changed, and the daily repair sweep, which assumes a delivery was missed. Neither
 * applies a payload as a diff, because deliveries arrive out of order, get replayed, and carry
 * whatever shape the platform sent them under, while a snapshot is simply what is true now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingError, CustomerRef } from "@pkg/billing";
import type { Result } from "@pkg/result";
import type { Database } from "remix/data-table";

import { isFailure, success } from "@pkg/result";

import Subscription from "~/app/data/subscription";
import { polar } from "~/app/lib/billing";

/** What one sync did, for the caller's own log line. */
export interface EntitlementSync {
	/** The OIDC subject the snapshot's customer is linked to. */
	ownerId: string;
	/** Whether the snapshot was fresher than what the projection already held. */
	applied: boolean;
	/** Whether the projection's answer moved, which is what separates a repair from a refresh. */
	changed: boolean;
	entitled: boolean;
	/** Monitors moved onto or off the schedule by this sync. */
	monitors: number;
}

/**
 * Re-reads what a customer holds and writes it into the projection, rescheduling their
 * monitors to match.
 *
 * @param db - Database handle.
 * @param customer - Which customer, by either identifier.
 * @returns What the sync did, `null` for a platform customer linked to no subject — which
 * leaves no owner whose monitors this could apply to — or the read's failure.
 */
export async function syncEntitlements(
	db: Database,
	customer: CustomerRef,
): Promise<Result<EntitlementSync | null, BillingError>> {
	let state = await polar.entitlements.of(customer);
	if (isFailure(state)) return state;

	let ownerId = state.data.externalId;
	if (ownerId === null) return success(null);

	let synced = await Subscription.sync(db, ownerId, state.data);

	/**
	 * A snapshot older than the one already stored says nothing new, so rescheduling from it
	 * would move monitors back to a state a fresher read has already superseded.
	 */
	if (!synced.applied) {
		return success({
			ownerId,
			applied: false,
			changed: false,
			entitled: synced.entitled,
			monitors: 0,
		});
	}

	let monitors = await Subscription.applyEntitlement(db, ownerId, synced.entitled);

	return success({
		ownerId,
		applied: true,
		changed: synced.changed,
		entitled: synced.entitled,
		monitors,
	});
}
