/**
 * Data model for customers: the billing identity a tenant belongs to. A customer holds
 * the payment method and the join to the provider's own customer record —
 * `provider_customer_id`, under whichever `provider_connection` issued it — while the
 * plan, period, and subscription state live on the tenant itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUIDv7 } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/** Mints a `cus_` TypeID for a new customer row. */
const customerId = typeid("cus");

/** One customer row as the control plane stores it. */
export type CustomerRow = TableRow<typeof Customer.table>;

/**
 * Active-record–style model for customers, exposing static query and mutation
 * helpers over the `customers` table.
 *
 * @example
 * let customer = await Customer.create(db, { name: "Acme, Inc." });
 */
export default class Customer {
	/** The `customers` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "customers",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			name: c.text(),
			provider_connection: c.text().default("polar"),
			provider_customer_id: c.text().nullable(),
			internal: c.boolean().default(false),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Finds a customer by its primary-key id.
	 *
	 * @param db - Database connection.
	 * @param id - The customer id.
	 * @returns A promise resolving to the customer row, or null when not found.
	 */
	static findById(db: Database, id: string): Promise<CustomerRow | null> {
		return db.findOne(Customer.table, { where: { id } });
	}

	/**
	 * Creates a customer. `internal` marks the platform's own billing account, so
	 * billing exemption is decided in one row.
	 *
	 * @param db - Database connection.
	 * @param data - The customer's display name and optional internal flag.
	 * @returns A promise resolving to the newly-created customer row.
	 * @example
	 * let customer = await Customer.create(db, { name: "Acme, Inc.", internal: false });
	 */
	static create(db: Database, data: { name: string; internal?: boolean }): Promise<CustomerRow> {
		return db.create(
			Customer.table,
			{
				id: customerId(generateUUIDv7()).toString(),
				name: data.name,
				provider_connection: "polar",
				provider_customer_id: null,
				internal: data.internal ?? false,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Finds the customer joined to a provider's own customer id, under the
	 * connection that issued it — the read a webhook uses to resolve which of our
	 * customers a delivery's `customerId` names.
	 *
	 * @param db - Database connection.
	 * @param connection - The billing connection the id was issued under.
	 * @param providerCustomerId - The provider's own customer id.
	 * @returns A promise resolving to the customer row, or null when unjoined.
	 */
	static findByProviderCustomerId(
		db: Database,
		connection: string,
		providerCustomerId: string,
	): Promise<CustomerRow | null> {
		return db.findOne(Customer.table, {
			where: { provider_connection: connection, provider_customer_id: providerCustomerId },
		});
	}

	/**
	 * Records the provider's own customer id a control-plane customer is now
	 * joined to, once a checkout has created or adopted one.
	 *
	 * @param db - Database connection.
	 * @param id - The customer id.
	 * @param data - The provider's customer id and the connection that issued it.
	 * @returns A promise resolving to the updated customer row.
	 * @throws When no customer exists for the given id.
	 */
	static joinProviderCustomer(
		db: Database,
		id: string,
		data: { connection: string; providerCustomerId: string },
	): Promise<CustomerRow> {
		return db.update(
			Customer.table,
			{ id },
			{ provider_connection: data.connection, provider_customer_id: data.providerCustomerId },
			{ touch: true },
		);
	}
}
