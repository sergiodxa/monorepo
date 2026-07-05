/**
 * The `Subscription` control-plane model: one account-level Polar subscription (base
 * fee plus a pooled metered allowance), mirroring Polar's status and period so the
 * platform can decide entitlement without calling Polar on every request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Polar subscription status values. */
export type SubscriptionStatus =
	| "incomplete"
	| "active"
	| "trialing"
	| "past_due"
	| "canceled"
	| "unpaid";

/** Account-level subscription (base fee + pooled metered allowance). */
export default class Subscription {
	/** Control-plane `subscriptions` table. */
	static table = table({
		name: "subscriptions",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			account_id: c.text(),
			polar_subscription_id: c.text().nullable(),
			polar_product_id: c.text().nullable(),
			status: c.text(),
			current_period_start: c.text().nullable(),
			current_period_end: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Finds the subscription belonging to an account (at most one per account).
	 *
	 * @param db The control-plane database.
	 * @param accountId The owning account id.
	 * @returns The subscription row, or `null` if the account has none.
	 */
	static findByAccount(db: Database, accountId: string) {
		return db.findOne(this.table, { where: { account_id: accountId } });
	}

	/**
	 * Finds a subscription by its Polar subscription id.
	 *
	 * @param db The control-plane database.
	 * @param polarSubscriptionId The Polar subscription id.
	 * @returns The subscription row, or `null` if none matches.
	 */
	static findByPolarId(db: Database, polarSubscriptionId: string) {
		return db.findOne(this.table, { where: { polar_subscription_id: polarSubscriptionId } });
	}

	/**
	 * Reports whether a subscription entitles the account to create and serve blogs,
	 * i.e. it is `active` or `trialing`.
	 *
	 * @param row The subscription row to test, or `null`.
	 * @returns `true` if the subscription grants entitlement.
	 */
	static isActive(row: SubscriptionRow | null): boolean {
		return row?.status === "active" || row?.status === "trialing";
	}

	/**
	 * Upserts an account's subscription from a partial patch: updates the existing row
	 * or creates one with sensible defaults. Called by the Polar webhook to keep local
	 * state in sync with billing events.
	 *
	 * @param db The control-plane database.
	 * @param accountId The owning account id.
	 * @param patch The subscription fields to set (id/account/timestamps are managed).
	 * @returns The up-to-date subscription row.
	 * @throws If a freshly created subscription cannot be read back.
	 */
	static async upsert(
		db: Database,
		accountId: string,
		patch: Partial<Omit<SubscriptionRow, "id" | "account_id" | "created_at" | "updated_at">>,
	): Promise<SubscriptionRow> {
		let now = new Date().toISOString();
		let existing = await this.findByAccount(db, accountId);
		if (existing) {
			await db.update(this.table, { id: existing.id }, { ...patch, updated_at: now });
			return (await this.findByAccount(db, accountId)) ?? existing;
		}
		let id = crypto.randomUUID();
		await db.create(this.table, {
			id,
			account_id: accountId,
			polar_subscription_id: patch.polar_subscription_id ?? null,
			polar_product_id: patch.polar_product_id ?? null,
			status: patch.status ?? "incomplete",
			current_period_start: patch.current_period_start ?? null,
			current_period_end: patch.current_period_end ?? null,
			created_at: now,
			updated_at: now,
		});
		let created = await this.findByAccount(db, accountId);
		if (!created) throw new Error("Failed to create subscription");
		return created;
	}
}

/** Persisted subscription row. */
export type SubscriptionRow = TableRow<typeof Subscription.table>;
