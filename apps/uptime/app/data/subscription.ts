/**
 * Data-access model for the local projection of Polar subscription state (ADR-005).
 * Owns the three things that projection is for: writing it from a Polar subscription
 * payload, reading an owner's entitlement out of it, and applying that entitlement to
 * whether the owner's monitors are scheduled at all.
 *
 * Polar is never read here. `PolarClient` appears only in the types of the payloads this
 * module is handed, which come from the webhook and from the daily reconciliation sweep —
 * the two writers of this table.
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
 * What this app knows about an owner's entitlement.
 *
 * `"unknown"` is not a third flavour of "no": it means the projection has never learned
 * anything about this owner (no row at all, so neither a webhook nor a reconciliation run
 * has ever mentioned them), and the two behaviours that used to share one `false` need to
 * split on it. A gate that decides whether to *do monitoring work* treats it as allowed —
 * running a check for a lapsed customer costs $0.0000348, while refusing every paying
 * customer's checks costs the product's reason to exist. A gate that decides what to
 * *tell the user about their billing* treats it as not-active, since offering a
 * subscription to someone who might already have one is the recoverable mistake.
 */
export type SubscriptionState = "active" | "inactive" | "unknown";

/**
 * The fields of a Polar subscription this projection stores. A `Pick` rather than the
 * whole `Subscription`, which also carries the product, its prices, its meters and the
 * customer: naming the seven fields that reach a column keeps the mapping's inputs
 * visible, and a full `Subscription` from either writer satisfies it as-is.
 */
export type SubscriptionPayload = Pick<
	PolarSubscription,
	"id" | "productId" | "status" | "currentPeriodEnd" | "endedAt" | "createdAt" | "modifiedAt"
>;

/**
 * Every monitor table whose scheduling follows the owner's entitlement, with the
 * predicate that table uses for "the user wants this monitor checked".
 *
 * All three carry `next_due_at` with the same meaning (ADR-006) but spell "enabled" their
 * own way, so that predicate is the only per-table difference and stays right here rather
 * than becoming three near-copies of the same UPDATE. `cron_job_monitors` is absent on
 * purpose: nothing is scheduled for one, the caller pings it.
 */
const SCHEDULED_TABLES: readonly { table: AnyTable; enabled: string }[] = [
	{ table: monitors, enabled: "enabled_at IS NOT NULL" },
	{ table: tcpMonitors, enabled: "is_enabled = 1" },
	{ table: dnsMonitors, enabled: "is_enabled = 1" },
];

export default class Subscription {
	/**
	 * Records a Polar subscription, keyed on `polar_subscription_id` so a redelivered event
	 * updates the row it already wrote.
	 *
	 * Returns whether the row now reflects this payload. `false` means the stored row was
	 * written from a *newer* payload — Polar retries and its events can arrive out of order,
	 * so an older payload arriving second must not roll the projection backwards. The caller
	 * uses that to skip the rescheduling this payload would otherwise imply.
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

		// The guarded DO UPDATE returns no row when it declines to write, which is the only
		// signal SQLite gives that this payload lost to a newer one.
		return (result.rows ?? []).length > 0;
	}

	/** Every row in the projection, for the reconciliation sweep to diff against Polar. */
	static async listAll(db: Database) {
		return await db.findMany(subscriptions);
	}

	/**
	 * What the projection says about an owner's entitlement.
	 *
	 * One indexed read on `subscriptions_customer_status_idx` over the handful of rows one
	 * customer can have. No product filter is needed: subscriptions to other products are
	 * never recorded, because the webhook and the reconciliation sweep both ignore them, so
	 * every row here is one that grants monitoring when its status is active.
	 *
	 * Logs the unknown case — a row is expected for anyone billing has ever touched, so a
	 * miss is either a customer who has never subscribed or a webhook that never arrived,
	 * and the second one is worth seeing in the logs before reconciliation repairs it.
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
	 * Schedules or unschedules every monitor the owner's teams hold, and returns how many
	 * rows moved.
	 *
	 * This is what makes the every-minute scheduler free of subscription work (ADR-005 §3):
	 * `next_due_at IS NULL` already means "not scheduled", so entitlement is enforced once
	 * per billing event at write time instead of 43,200 × K times a month at read time, and
	 * the claim query needs no join and no extra rows read.
	 *
	 * Only `next_due_at` moves — each table's own enabled column is the user's intent and
	 * has to survive a lapse, so that re-activating restores exactly the monitors they had
	 * running.
	 *
	 * Each direction touches only the rows whose effective schedule actually changes: an
	 * already-scheduled monitor keeps the due time it has, and an already-unscheduled one is
	 * left alone. That is what makes this safe to run on every subscription event Polar sends
	 * — `subscription.updated` fires for changes that have nothing to do with entitlement,
	 * and re-anchoring every monitor's cadence to that would restart the interval of a
	 * monitor mid-flight for no reason.
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
