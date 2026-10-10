/**
 * The billing identity a tenant belongs to. A customer holds the join to the provider's own
 * customer record, `provider_customer_id` under whichever `provider_connection` issued it,
 * while the plan, period and subscription state live on each tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

import { customers } from "~/database/schema";

/** Mints a `cus_` TypeID for a new customer row. */
const customerId = typeid("cus");

/**
 * Customers, created on Polar's connection and outside the platform's own account unless
 * `internal` marks the one account billing exempts.
 *
 * @example let customer = await models.customers.create({ name: "Acme, Inc." });
 */
export const Customers = createModel(customers, {
	optional: ["id", "provider_connection", "internal"],

	methods: {
		/**
		 * The customer a provider's own customer id names under the connection that issued it,
		 * which is how a webhook resolves the customer a delivery is about.
		 */
		findByProviderCustomerId(connection: string, providerCustomerId: string) {
			return this.findBy({
				provider_connection: connection,
				provider_customer_id: providerCustomerId,
			});
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? customerId(generateUUID()).toString(),
				provider_connection: values.provider_connection ?? "polar",
				internal: values.internal ?? false,
			};
		},
	},
});

/** One customer row as the control plane stores it. */
export type CustomerRow = ModelRow<typeof Customers>;

export default Customers;
