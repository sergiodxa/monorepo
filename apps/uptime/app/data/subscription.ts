/**
 * Data-access model for the local projection of billing state (ADR-005). Owns writing that
 * projection from an entitlement snapshot, reading an owner's entitlement out of it, and
 * applying that entitlement to whether the owner's monitors are scheduled.
 *
 * The projection is written wholesale from one snapshot rather than patched from a delivery,
 * because deliveries arrive out of order and carry whatever shape they were sent under: a
 * snapshot says what the owner holds right now, and `billing_read_at` is what stops an older
 * read from overwriting a newer one. This table's two writers — the webhook endpoint and the
 * daily repair sweep — both take that route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementState } from "@sdxc/billing";
import type { AnyTable, Database } from "remix/data-table";

import { currentLog } from "@sdxc/logger";
import { generateUUID } from "@sdxc/uuid";
import { getTableName } from "remix/data-table";

import type { SelectSubscription } from "~/database/schema";

import { MONITORING_PRODUCT } from "~/app/lib/billing";
import { nextDueAtOnEnable } from "~/app/lib/scheduling";
import { dnsMonitors, monitors, subscriptions, tcpMonitors, teams } from "~/database/schema";

/**
 * What this app knows about an owner's entitlement. `"unknown"` means the projection has
 * never heard of this owner: a gate on doing monitoring work treats it as allowed, since a
 * lapsed customer's check costs $0.0000348, while billing copy reads it as unsubscribed.
 */
export type SubscriptionState = "active" | "inactive" | "unknown";

/** What one snapshot write did, which is what its caller reschedules from. */
export interface SubscriptionSync {
	/** Whether this snapshot was at least as fresh as what the projection already held. */
	applied: boolean;
	/** Whether the owner holds a monitoring subscription in a state that grants checks. */
	entitled: boolean;
	/**
	 * Whether the projection's answer actually moved. It separates a routine refresh from a
	 * repair, which is the difference between a sweep that found nothing and one that found a
	 * delivery had gone missing.
	 */
	changed: boolean;
}

/**
 * The statuses that grant monitoring. A trial is billing's own, granted by the platform
 * before any money moves, and is as entitling as a paid period.
 */
const ENTITLING_STATUSES: readonly string[] = ["active", "trialing"];

/**
 * Every monitor table whose scheduling follows the owner's entitlement, with the predicate
 * that table uses for "the user wants this monitor checked": all three carry `next_due_at`
 * with the same meaning (ADR-006) while spelling "enabled" their own way.
 */
const SCHEDULED_TABLES: readonly { table: AnyTable; enabled: string }[] = [
	{ table: monitors, enabled: "enabled_at IS NOT NULL" },
	{ table: tcpMonitors, enabled: "is_enabled = 1" },
	{ table: dnsMonitors, enabled: "is_enabled = 1" },
];

/** Whether a stored status is one that grants monitoring. */
export function isEntitlingStatus(status: string): boolean {
	return ENTITLING_STATUSES.includes(status);
}

export default class Subscription {
	/**
	 * Writes what the platform says this owner holds right now, keyed on
	 * `billing_subscription_id` so a re-read updates the rows it already wrote. A subscription
	 * the snapshot no longer lists is marked revoked rather than deleted, since a row saying
	 * "positively not entitled" is what {@link stateFor} distinguishes from never having heard
	 * of the owner at all.
	 *
	 * @param db - Database handle.
	 * @param ownerId - The OIDC subject the platform customer is linked to.
	 * @param state - The snapshot to write, as `entitlements.of(...)` answered it.
	 * @returns Whether the snapshot landed, and what it says about the owner's entitlement.
	 */
	static async sync(
		db: Database,
		ownerId: string,
		state: EntitlementState,
	): Promise<SubscriptionSync> {
		let readAt = state.readAt.getTime();
		let held = state.subscriptions.filter(
			(subscription) => subscription.productSlug === MONITORING_PRODUCT,
		);

		let stored = await db.findMany(subscriptions, {
			where: { external_customer_id: ownerId },
		});

		let applied = false;
		let changed = drifted(stored, held);

		for (let subscription of held) {
			let now = Date.now();

			let result = await db.exec(
				`INSERT INTO ${getTableName(subscriptions)}
				        (id, created_at, updated_at, external_customer_id, billing_subscription_id,
				         billing_product_slug, status, current_period_end, revoked_at, billing_read_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
				 ON CONFLICT (billing_subscription_id) DO UPDATE
				    SET updated_at = excluded.updated_at,
				        external_customer_id = excluded.external_customer_id,
				        billing_product_slug = excluded.billing_product_slug,
				        status = excluded.status,
				        current_period_end = excluded.current_period_end,
				        revoked_at = NULL,
				        billing_read_at = excluded.billing_read_at
				  WHERE excluded.billing_read_at >= ${getTableName(subscriptions)}.billing_read_at
				RETURNING id`,
				[
					generateUUID(),
					now,
					now,
					ownerId,
					subscription.subscriptionId,
					MONITORING_PRODUCT,
					subscription.status,
					subscription.currentPeriodEnd?.getTime() ?? null,
					readAt,
				],
			);

			if ((result.rows ?? []).length > 0) applied = true;
		}

		let revoked = await revokeMissing(
			db,
			ownerId,
			held.map((subscription) => subscription.subscriptionId),
			readAt,
		);

		return { applied: applied || revoked, changed, entitled: held.some(isSnapshotEntitling) };
	}

	/** Every row in the projection, for the repair sweep to re-read each owner from. */
	static async listAll(db: Database) {
		return await db.findMany(subscriptions);
	}

	/**
	 * What the projection says about an owner's entitlement, from one indexed read. Every row
	 * here grants monitoring when its status is entitling, since only subscriptions to the
	 * monitoring product are ever recorded. Logs the unknown case, where a delivery may have
	 * gone missing.
	 */
	static async stateFor(db: Database, ownerId: string): Promise<SubscriptionState> {
		let rows = await db.findMany(subscriptions, { where: { external_customer_id: ownerId } });

		if (rows.length === 0) {
			currentLog()?.note("subscription.state_unknown", { ownerId });
			return "unknown";
		}

		return rows.some((row) => isEntitlingStatus(row.status)) ? "active" : "inactive";
	}

	/**
	 * Whether the owner is *known* to hold an active subscription. Unknown answers `false`,
	 * so this is the reading for anything shown to a user about their own billing; a gate on
	 * whether monitoring work may run wants {@link stateFor} and its fail-open case instead.
	 */
	static async isActive(db: Database, ownerId: string): Promise<boolean> {
		return (await Subscription.stateFor(db, ownerId)) === "active";
	}

	/**
	 * Schedules or unschedules every monitor the owner's teams hold, returning the rows moved.
	 * Enforcing entitlement at write time keeps the every-minute claim join-free (ADR-005 §3);
	 * moving only rows whose schedule changes preserves the user's enabled intent and cadence.
	 */
	static async applyEntitlement(db: Database, ownerId: string, entitled: boolean): Promise<number> {
		let nextDueAt = nextDueAtOnEnable(entitled);
		let moved = 0;

		for (let { table, enabled } of SCHEDULED_TABLES) {
			let result = await db.exec(
				`UPDATE ${getTableName(table)}
				    SET next_due_at = ?, updated_at = ?
				  WHERE team_id IN (SELECT id FROM ${getTableName(teams)} WHERE owner_id = ?)
				    AND ${entitled ? `next_due_at IS NULL AND ${enabled}` : "next_due_at IS NOT NULL"}`,
				[nextDueAt, Date.now(), ownerId],
			);

			moved += result.affectedRows ?? 0;
		}

		return moved;
	}
}

/**
 * Marks every one of the owner's rows the snapshot stopped listing as revoked. A snapshot
 * carries only what is still held, so a subscription's absence from it is how this app learns
 * one ended — and `revoked_at` records when we learned, which is the only date it supports.
 *
 * @returns Whether any row was moved, so a caller knows the projection changed.
 */
async function revokeMissing(
	db: Database,
	ownerId: string,
	keep: string[],
	readAt: number,
): Promise<boolean> {
	let placeholders = keep.map(() => "?").join(", ");

	let result = await db.exec(
		`UPDATE ${getTableName(subscriptions)}
		    SET status = 'revoked', revoked_at = ?, billing_read_at = ?, updated_at = ?
		  WHERE external_customer_id = ?
		    AND billing_read_at <= ?
		    AND status <> 'revoked'
		    ${keep.length === 0 ? "" : `AND billing_subscription_id NOT IN (${placeholders})`}`,
		[readAt, readAt, Date.now(), ownerId, readAt, ...keep],
	);

	return (result.affectedRows ?? 0) > 0;
}

/**
 * Whether the snapshot says something the stored rows do not: a subscription the projection
 * has never seen, one whose status or paid period moved, or one the projection still counts as
 * live that the platform no longer lists.
 */
function drifted(
	stored: readonly SelectSubscription[],
	held: readonly EntitlementState["subscriptions"][number][],
): boolean {
	let rows = new Map(stored.map((row) => [row.billing_subscription_id, row]));

	for (let subscription of held) {
		let row = rows.get(subscription.subscriptionId);
		if (!row) return true;
		if (row.status !== subscription.status) return true;
		if (row.current_period_end !== (subscription.currentPeriodEnd?.getTime() ?? null)) return true;
	}

	let live = new Set(held.map((subscription) => subscription.subscriptionId));

	return stored.some((row) => row.status !== "revoked" && !live.has(row.billing_subscription_id));
}

/** Whether one snapshot subscription is in a state that grants monitoring. */
function isSnapshotEntitling(subscription: EntitlementState["subscriptions"][number]): boolean {
	return isEntitlingStatus(subscription.status);
}
