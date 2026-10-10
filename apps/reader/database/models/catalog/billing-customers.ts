/**
 * The customer record each billing connection issued a reader, one row per pair. A row
 * exists only for a reader who reached a checkout, which is what bounds the daily
 * reconciliation by how many readers have ever paid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { gt } from "remix/data-table";

import type { SelectBillingCustomer } from "~/database/catalog-schema";

import { billingCustomers } from "~/database/catalog-schema";

/** The readers behind each connection's customer ids, read by subject or by the platform's id. */
export const BillingCustomers = createModel(billingCustomers, {
	scopes: {
		/** The customers one credential set issued. */
		inConnection: (query, connection: string) => query.where({ connection }),
	},

	methods: {
		/** The customer `connection` issued the reader, or `null` before their first checkout. */
		forSubject(subject: string, connection: string): Promise<SelectBillingCustomer | null> {
			return this.findBy({ subject, connection });
		},

		/** The reader behind a customer id the platform reported, for a record lacking a subject. */
		forProviderId(
			connection: string,
			providerCustomerId: string,
		): Promise<SelectBillingCustomer | null> {
			return this.findBy({ connection, provider_customer_id: providerCustomerId });
		},

		/**
		 * One page of a connection's customers in subject order, resuming after the subject the
		 * previous page ended on, or from the first one when `after` is `null`.
		 */
		page(
			connection: string,
			limit: number,
			after: string | null,
		): Promise<SelectBillingCustomer[]> {
			let customers = this.inConnection(connection);
			if (after !== null) customers = customers.where(gt("subject", after));
			return customers.orderBy("subject", "asc").limit(limit).all();
		},
	},
});

export default BillingCustomers;
