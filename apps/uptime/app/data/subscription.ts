/**
 * Data-access model for the local projection of Polar subscription state (ADR-005). Owns
 * writing that projection from a Polar subscription payload, reading an owner's entitlement
 * out of it, and applying that entitlement to whether the owner's monitors are scheduled.
 *
 * `PolarSubscription` types only the payloads this module is handed, which come from the
 * webhook and from the daily reconciliation sweep — this table's two writers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subscription as PolarSubscription } from "@pkg/polar";
import type { AnyTable, Database } from "remix/data-table";

import { logger } from "@pkg/logger";
import { isActiveSubscriptionStatus } from "@pkg/polar";
import { generateUUID } from "@pkg/uuid";
import { getTableName } from "remix/data-table";

import { nextDueAtOnEnable } from "~/app/lib/scheduling";
import { dnsMonitors, monitors, subscriptions, tcpMonitors, teams } from "~/database/schema";

/** The Polar product id a paying team's owner must hold an active subscription to. */
export const SUBSCRIPTION_PRODUCT_ID = "94161883-14eb-42e2-bb26-b4647199cda1";

/**
 * What this app knows about an owner's entitlement. `"unknown"` means the projection has
 * never heard of this owner: a gate on doing monitoring work treats it as allowed, since a
 * lapsed customer's check costs $0.0000348, while billing copy reads it as unsubscribed.
 */
export type SubscriptionState = "active" | "inactive" | "unknown";

/**
 * The fields of a Polar subscription this projection stores. Naming the seven that reach a
 * column keeps the mapping's inputs visible, and a full `Subscription` from either writer
 * satisfies it as-is.
 */
export type SubscriptionPayload = Pick<
	PolarSubscription,
	"id" | "productId" | "status" | "currentPeriodEnd" | "endedAt" | "createdAt" | "modifiedAt"
>;

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

export default class Subscription {
	/**
	 * Records a Polar subscription, keyed on `polar_subscription_id` so a redelivered event
	 * updates the row it already wrote. Returns whether the row now reflects this payload:
	 * `false` means a newer payload already landed, so the caller skips its rescheduling.
	 */
	static async upsert(
		db: Database,
		ownerId: string,
		subscription: SubscriptionPayload,
	): Promise<boolean> {
		let now = Date.now();
		let modifiedAt = (subscription.modifiedAt ?? subscription.createdAt).getTime();

		let result = await db.exec(
			`INSERT INTO ${getTableName(subscriptions)}
			        (id, created_at, updated_at, external_customer_id, polar_subscription_id,
			         polar_product_id, status, current_period_end, revoked_at, polar_modified_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (polar_subscription_id) DO UPDATE
			    SET updated_at = excluded.updated_at,
			        external_customer_id = excluded.external_customer_id,
			        polar_product_id = excluded.polar_product_id,
			        status = excluded.status,
			        current_period_end = excluded.current_period_end,
			        revoked_at = excluded.revoked_at,
			        polar_modified_at = excluded.polar_modified_at
			  WHERE excluded.polar_modified_at >= ${getTableName(subscriptions)}.polar_modified_at
			RETURNING id`,
			[
				generateUUID(),
				now,
				now,
				ownerId,
				subscription.id,
				subscription.productId,
				subscription.status,
				subscription.currentPeriodEnd.getTime(),
				subscription.endedAt?.getTime() ?? null,
				modifiedAt,
			],
		);

		return (result.rows ?? []).length > 0;
	}

	/** Every row in the projection, for the reconciliation sweep to diff against Polar. */
	static async listAll(db: Database) {
		return await db.findMany(subscriptions);
	}

	/**
	 * What the projection says about an owner's entitlement, from one indexed read. Every row
	 * here grants monitoring when its status is active, since only subscriptions to this
	 * product are ever recorded. Logs the unknown case, where a webhook may have gone missing.
	 */
	static async stateFor(db: Database, ownerId: string): Promise<SubscriptionState> {
		let rows = await db.findMany(subscriptions, { where: { external_customer_id: ownerId } });

		if (rows.length === 0) {
			logger.info("subscription.state_unknown", { ownerId });
			return "unknown";
		}

		return rows.some((row) => isActiveSubscriptionStatus(row.status)) ? "active" : "inactive";
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
