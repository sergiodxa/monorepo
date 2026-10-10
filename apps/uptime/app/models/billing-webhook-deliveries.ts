/**
 * The log of inbound billing deliveries, which gives idempotency a key that outlives the
 * request: a redelivery of a row already marked processed is acknowledged without running its
 * handler again. A row is written with its signature verdict before anything trusts it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WebhookDelivery, WebhookStore } from "@sdxc/billing";
import type { BoundModel, ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { getTableName, lt } from "remix/data-table";

import { billingWebhookDeliveries } from "~/database/schema";

export const BillingWebhookDeliveries = createModel(billingWebhookDeliveries, {
	methods: {
		/** A recorded delivery in the shape the webhook endpoint reads, or `null` for a new one. */
		async findDelivery(id: string): Promise<WebhookDelivery | null> {
			let row = await this.find(id);
			if (!row) return null;

			return {
				id: row.id,
				type: row.type,
				payload: row.payload,
				valid: row.valid === 1,
				processed: row.processed === 1,
			};
		},

		/**
		 * Writes a delivery in one statement, replacing any row sharing its id, so a redelivery
		 * is judged against the bytes that arrived last.
		 */
		async record(delivery: WebhookDelivery): Promise<void> {
			let now = Date.now();

			await this.db.exec(
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
		},

		/** Marks a delivery handled, which is what a later redelivery is measured against. */
		async markProcessed(id: string): Promise<void> {
			await this.query().where({ id }).update({ processed: 1 });
		},

		/**
		 * Drops handled deliveries created before `before` (epoch milliseconds), keeping the log
		 * to the window in which a redelivery can still arrive. An unprocessed row is kept
		 * whatever its age, as the record of a delivery this app never acted on.
		 *
		 * @returns How many rows were dropped.
		 */
		async prune(before: number): Promise<number> {
			let result = await this.query()
				.where({ processed: 1 })
				.where(lt("created_at", before))
				.delete();
			return result.affectedRows;
		},
	},
});

/** A recorded delivery's row, as reads return it. */
export type BillingWebhookDelivery = ModelRow<typeof BillingWebhookDeliveries>;

/**
 * The delivery log as the store a billing webhook endpoint takes. The model arrives as a
 * function because the endpoint is built at module scope, before any request has bound one.
 *
 * @param deliveries - Answers the model bound to the database the current call runs on.
 * @example const STORE = webhookStore(() => getContext().models.billingWebhookDeliveries);
 */
export function webhookStore(
	deliveries: () => BoundModel<typeof BillingWebhookDeliveries>,
): WebhookStore {
	return {
		find: (id) => deliveries().findDelivery(id),
		record: (delivery) => deliveries().record(delivery),
		markProcessed: (id) => deliveries().markProcessed(id),
	};
}

export default BillingWebhookDeliveries;
