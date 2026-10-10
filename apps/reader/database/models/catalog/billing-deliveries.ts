/**
 * Every delivery the billing endpoint received, keyed on the platform's own id, so a
 * replay is recognized against a durable key and the bytes a signature covered stay
 * readable after a handler got something wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";

import { billingDeliveries } from "~/database/catalog-schema";

/** The billing endpoint's deliveries, each marked processed once its handler finished. */
export const BillingDeliveries = createModel(billingDeliveries, {
	methods: {
		/** Marks a delivery handled, which is what a later replay of it is measured against. */
		async markProcessed(id: string): Promise<void> {
			await this.query().where({ id }).update({ processed: true });
		},
	},
});

export default BillingDeliveries;
