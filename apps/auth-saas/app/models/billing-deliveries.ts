/**
 * Billing webhook deliveries: the durable record the webhook endpoint checks before trusting
 * a delivery, so a replay is answered without running its handler again. Keyed on the
 * platform's own delivery id, since deduplication is about the delivery, not its object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { TableRow } from "remix/data-table";

import { createModel } from "@sdxc/data-model";
import { isFailure, success } from "@sdxc/result";

import { billingDeliveries } from "~/database/schema";

/** What one delivery arrived with. */
export interface DeliveryInput {
	id: string;
	type: string;
	/** The body exactly as received. */
	payload: string;
	/** Whether the signing secret proved it. */
	valid: boolean;
}

/**
 * Billing deliveries. `record` rewrites a replay over the row its first arrival left, keeping
 * when that first arrival was received.
 *
 * @example await models.billingDeliveries.record({ id, type, payload, valid: true });
 */
export const BillingDeliveries = createModel(billingDeliveries, {
	optional: ["processed"],

	methods: {
		/** Records a delivery as unprocessed, replacing any row already sharing its id. */
		async record(
			delivery: DeliveryInput,
		): Promise<Result<TableRow<typeof billingDeliveries>, Error>> {
			let fields = {
				type: delivery.type,
				payload: delivery.payload,
				valid: delivery.valid,
				processed: false,
			};
			if ((await this.find(delivery.id)) !== null) return this.update(delivery.id, fields);
			return this.create({ id: delivery.id, ...fields, received_at: Date.now() });
		},

		/** Marks a delivery handled; an id never recorded is left alone and still succeeds. */
		async markProcessed(id: string): Promise<Result<void, Error>> {
			if ((await this.find(id)) === null) return success(undefined);
			let updated = await this.update(id, { processed: true });
			if (isFailure(updated)) return updated;
			return success(undefined);
		},
	},
});

/** One billing delivery row as the control plane stores it. */
export type BillingDeliveryRow = ModelRow<typeof BillingDeliveries>;

export default BillingDeliveries;
