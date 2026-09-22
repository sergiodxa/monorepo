/**
 * Data model for daily attack-signal alerts: the "was this tenant already mailed
 * today" record the baseline-check job consults before sending, and writes once a
 * send succeeds. Wraps the `attack_signal_alerts` D1 table — a row's presence for a
 * `(tenant_id, day)` pair is the whole fact this model exists to hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** One recorded alert, as the control plane stores it. */
export type AttackSignalAlertRow = TableRow<typeof AttackSignalAlert.table>;

/**
 * Active-record–style model for daily attack-signal alerts, exposing static query
 * and mutation helpers over the `attack_signal_alerts` table.
 *
 * @example
 * let sentToday = await AttackSignalAlert.findByTenantAndDay(db, tenantId, day);
 */
export default class AttackSignalAlert {
	/** The `attack_signal_alerts` D1 table definition. Keyed on `(tenant_id, day)`. */
	static table = table({
		name: "attack_signal_alerts",
		primaryKey: ["tenant_id", "day"],
		timestamps: true,
		columns: {
			tenant_id: c.text(),
			day: c.integer(),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Finds a tenant's alert row for one day.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param day - The day, as `metering.ts`'s `dayOf` keys it.
	 * @returns A promise resolving to the row, or null when that day carries no alert yet.
	 */
	static findByTenantAndDay(
		db: Database,
		tenantId: string,
		day: number,
	): Promise<AttackSignalAlertRow | null> {
		return db.findOne(AttackSignalAlert.table, { where: { tenant_id: tenantId, day } });
	}

	/**
	 * Records that a tenant was alerted for one day, spending that day's one alert.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param day - The day, as `metering.ts`'s `dayOf` keys it.
	 * @returns A promise resolving to the written row.
	 */
	static create(db: Database, tenantId: string, day: number): Promise<AttackSignalAlertRow> {
		return db.create(
			AttackSignalAlert.table,
			{ tenant_id: tenantId, day },
			{ touch: true, returnRow: true },
		);
	}
}
