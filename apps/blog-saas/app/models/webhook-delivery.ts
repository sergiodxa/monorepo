/**
 * The `WebhookDelivery` control-plane model: one row per billing delivery, holding
 * the body exactly as received alongside the signature verdict and whether a handler
 * finished, so a replay is cheap to detect and a wrong handler stays visible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { WebhookDelivery as Delivery } from "@pkg/billing";
import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Truth as SQLite stores it, since the control plane has no boolean column type. */
const TRUE = 1;

/** Falsehood as SQLite stores it. */
const FALSE = 0;

/** One recorded billing webhook delivery. */
export default class WebhookDelivery {
	/** Control-plane `webhook_deliveries` table. */
	static table = table({
		name: "webhook_deliveries",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			type: c.text(),
			payload: c.text(),
			valid: c.integer(),
			processed: c.integer(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Reads a recorded delivery by the id the platform gave it.
	 *
	 * @param db The control-plane database.
	 * @param id The platform's delivery id.
	 * @returns The delivery, or `null` when this one has never arrived.
	 */
	static async find(db: Database, id: string): Promise<Delivery | null> {
		let row = await db.findOne(this.table, { where: { id } });
		if (!row) return null;

		return {
			id: row.id,
			type: row.type,
			payload: row.payload,
			valid: row.valid === TRUE,
			processed: row.processed === TRUE,
		};
	}

	/**
	 * Writes a delivery, replacing any row sharing its id, so a redelivery of a
	 * body that was never handled is stored as it arrived the second time.
	 *
	 * @param db The control-plane database.
	 * @param delivery The delivery and the signature verdict on it.
	 * @returns A promise resolving once the row is written.
	 */
	static async record(db: Database, delivery: Delivery): Promise<void> {
		let now = new Date().toISOString();
		let existing = await db.findOne(this.table, { where: { id: delivery.id } });

		let fields = {
			type: delivery.type,
			payload: delivery.payload,
			valid: delivery.valid ? TRUE : FALSE,
			processed: delivery.processed ? TRUE : FALSE,
			updated_at: now,
		};

		if (existing) {
			await db.update(this.table, { id: delivery.id }, fields);
			return;
		}

		await db.create(this.table, { id: delivery.id, ...fields, created_at: now });
	}

	/**
	 * Marks a delivery handled, which is what a later replay is measured against.
	 *
	 * @param db The control-plane database.
	 * @param id The platform's delivery id.
	 * @returns A promise resolving once the row is marked.
	 */
	static async markProcessed(db: Database, id: string): Promise<void> {
		let existing = await db.findOne(this.table, { where: { id } });
		if (!existing) return;

		await db.update(this.table, { id }, { processed: TRUE, updated_at: new Date().toISOString() });
	}
}
