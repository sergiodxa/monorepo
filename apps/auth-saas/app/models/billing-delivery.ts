/**
 * Data model for billing deliveries: the durable record `BillingWebhook` checks
 * before trusting a delivery, so a replay is answered without running its handler
 * again. Wraps the `billing_deliveries` D1 table — keyed on the platform's own
 * delivery id, since deduplication is keyed on the delivery rather than the object
 * it names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** One billing delivery row as the control plane stores it. */
export type BillingDeliveryRow = TableRow<typeof BillingDelivery.table>;

/**
 * Active-record–style model for billing deliveries, exposing static query and
 * mutation helpers over the `billing_deliveries` table.
 *
 * @example
 * let delivery = await BillingDelivery.findById(db, deliveryId);
 */
export default class BillingDelivery {
	/** The `billing_deliveries` D1 table definition, keyed on the platform's own delivery id. */
	static table = table({
		name: "billing_deliveries",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			type: c.text(),
			payload: c.text(),
			valid: c.boolean(),
			processed: c.boolean().default(false),
			received_at: c.integer(),
		},
	});

	/**
	 * Finds a recorded delivery.
	 *
	 * @param db - Database connection.
	 * @param id - The platform's delivery id.
	 * @returns A promise resolving to the delivery row, or null when this delivery
	 * has never arrived.
	 */
	static findById(db: Database, id: string): Promise<BillingDeliveryRow | null> {
		return db.findOne(BillingDelivery.table, { where: { id } });
	}

	/**
	 * Records a delivery, replacing any row already sharing its id — a replay
	 * carries the same id and is written over the row its first arrival left.
	 *
	 * @param db - Database connection.
	 * @param data - The delivery id, the object type it named, its body exactly as
	 * received, and whether the signing secret proved it.
	 * @returns A promise resolving to the written delivery row.
	 */
	static async record(
		db: Database,
		data: { id: string; type: string; payload: string; valid: boolean },
	): Promise<BillingDeliveryRow> {
		let existing = await BillingDelivery.findById(db, data.id);

		if (existing) {
			return db.update(
				BillingDelivery.table,
				{ id: data.id },
				{ type: data.type, payload: data.payload, valid: data.valid, processed: false },
			);
		}

		return db.create(
			BillingDelivery.table,
			{
				id: data.id,
				type: data.type,
				payload: data.payload,
				valid: data.valid,
				processed: false,
				received_at: Date.now(),
			},
			{ returnRow: true },
		);
	}

	/**
	 * Marks a delivery handled, ignoring an id that was never recorded.
	 *
	 * @param db - Database connection.
	 * @param id - The platform's delivery id.
	 * @returns A promise that resolves once the row is marked, or immediately when
	 * no such delivery was recorded.
	 */
	static async markProcessed(db: Database, id: string): Promise<void> {
		let existing = await BillingDelivery.findById(db, id);
		if (!existing) return;

		await db.update(BillingDelivery.table, { id }, { processed: true });
	}
}
