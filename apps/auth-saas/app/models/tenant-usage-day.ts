/**
 * Data model for a tenant's closed daily usage: the interface the cost ledger
 * and usage reporting both read, written once per tenant per day by
 * `closeTenantMeteringDay`. Wraps the `tenant_usage_day` D1 table — one row
 * per `(tenant_id, day)`, the figures a tenant object's own meter answered on
 * close.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** One tenant's usage row for one day, as the control plane stores it. */
export type TenantUsageDayRow = TableRow<typeof TenantUsageDay.table>;

/**
 * Active-record–style model for a tenant's daily usage rows, exposing static
 * query and mutation helpers over the `tenant_usage_day` table.
 *
 * @example
 * let row = await TenantUsageDay.findByTenantAndDay(db, tenant.id, day);
 */
export default class TenantUsageDay {
	/** The `tenant_usage_day` D1 table definition. Keyed on `(tenant_id, day)`. */
	static table = table({
		name: "tenant_usage_day",
		primaryKey: ["tenant_id", "day"],
		timestamps: true,
		columns: {
			tenant_id: c.text(),
			day: c.integer(),
			subjects: c.integer(),
			sessions: c.integer(),
			tokens: c.integer(),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Finds one tenant's usage row for one day.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param day - The day, as `metering.ts`'s `dayOf` keys it.
	 * @returns A promise resolving to the row, or null when that day was never closed.
	 */
	static findByTenantAndDay(
		db: Database,
		tenantId: string,
		day: number,
	): Promise<TenantUsageDayRow | null> {
		return db.findOne(TenantUsageDay.table, { where: { tenant_id: tenantId, day } });
	}

	/**
	 * Writes a tenant's closed-day figures, creating the row on its first write
	 * and overwriting it wholesale on every write after — the same figures a
	 * retried close answers with, so a second write for the same day lands the
	 * same row.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param data - The day and the subject, session and token counts it closed with.
	 * @returns A promise resolving to the written row.
	 */
	static async upsert(
		db: Database,
		tenantId: string,
		data: { day: number; subjects: number; sessions: number; tokens: number },
	): Promise<TenantUsageDayRow> {
		let existing = await TenantUsageDay.findByTenantAndDay(db, tenantId, data.day);

		if (existing) {
			return db.update(
				TenantUsageDay.table,
				{ tenant_id: tenantId, day: data.day },
				{ subjects: data.subjects, sessions: data.sessions, tokens: data.tokens },
				{ touch: true },
			);
		}

		return db.create(
			TenantUsageDay.table,
			{
				tenant_id: tenantId,
				day: data.day,
				subjects: data.subjects,
				sessions: data.sessions,
				tokens: data.tokens,
			},
			{ touch: true, returnRow: true },
		);
	}
}
