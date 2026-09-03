/**
 * Where inbound billing deliveries are recorded, which is what gives idempotency a key that
 * outlives the request: the platform retries a delivery under the same id, so a row already
 * marked processed is acknowledged without running its handler again.
 *
 * The row is written with the signature verdict *before* anything trusts the delivery, so a
 * forged one leaves evidence and a handler that turned out to be wrong can be answered for
 * against the exact bytes the signature covered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WebhookDelivery as BillingDelivery, WebhookStore } from "@pkg/billing";
import type { Database } from "remix/data-table";

import { getTableName } from "remix/data-table";

import { billingWebhookDeliveries } from "~/database/schema";

/**
 * The delivery log over this app's D1. The database arrives as a factory because the store is
 * built at module scope alongside the endpoint, where a binding cannot be opened yet.
 *
 * @example
 * export const deliveries = new WebhookDeliveries(createDatabase);
 */
export default class WebhookDeliveries implements WebhookStore {
	#database: () => Database;

	/**
	 * @param database - Opens the connection each call runs against.
	 */
	constructor(database: () => Database) {
		this.#database = database;
	}

	/**
	 * Reads a recorded delivery.
	 *
	 * @param id - The platform's delivery id.
	 * @returns The row, or `null` when this delivery has never arrived.
	 */
	async find(id: string): Promise<BillingDelivery | null> {
		let row = await this.#database().findOne(billingWebhookDeliveries, { where: { id } });
		if (!row) return null;

		return {
			id: row.id,
			type: row.type,
			payload: row.payload,
			valid: row.valid === 1,
			processed: row.processed === 1,
		};
	}

	/**
	 * Writes a delivery, replacing any row sharing its id, so a redelivery is judged against
	 * the bytes that arrived last rather than the first ones seen.
	 *
	 * @param delivery - The delivery and the signature verdict on it.
	 */
	async record(delivery: BillingDelivery): Promise<void> {
		let now = Date.now();

		await this.#database().exec(
			`INSERT INTO ${getTableName(billingWebhookDeliveries)}
			        (id, created_at, updated_at, type, payload, valid, processed)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (id) DO UPDATE
			    SET updated_at = excluded.updated_at,
			        type = excluded.type,
			        payload = excluded.payload,
			        valid = excluded.valid,
			        processed = excluded.processed`,
			[
				delivery.id,
				now,
				now,
				delivery.type,
				delivery.payload,
				delivery.valid ? 1 : 0,
				delivery.processed ? 1 : 0,
			],
		);
	}

	/**
	 * Marks a delivery handled, which is what a later redelivery is measured against.
	 *
	 * @param id - The platform's delivery id.
	 */
	async markProcessed(id: string): Promise<void> {
		await this.#database().exec(
			`UPDATE ${getTableName(billingWebhookDeliveries)}
			    SET processed = 1, updated_at = ?
			  WHERE id = ?`,
			[Date.now(), id],
		);
	}

	/**
	 * Drops handled deliveries older than `before`, keeping the log to the window in which a
	 * redelivery can still arrive. An unprocessed row is kept whatever its age, since it is
	 * the record of a delivery this app never acted on.
	 *
	 * @param db - Database handle, since the sweep already holds one.
	 * @param before - Epoch milliseconds; rows created before this are removed.
	 * @returns How many rows were dropped.
	 */
	static async prune(db: Database, before: number): Promise<number> {
		let result = await db.exec(
			`DELETE FROM ${getTableName(billingWebhookDeliveries)}
			  WHERE processed = 1 AND created_at < ?`,
			[before],
		);

		return result.affectedRows ?? 0;
	}
}
