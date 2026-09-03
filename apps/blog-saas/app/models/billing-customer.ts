/**
 * The `BillingCustomer` control-plane model: one row per account per billing
 * connection, holding the platform's own customer id, so an account can carry a
 * separate identity on each configured connection while one of them bills today.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Marks the row a charge is made against, of the identities an account holds. */
const DEFAULT_CONNECTION = 1;

/** An account's customer identity on one billing connection. */
export default class BillingCustomer {
	/** Control-plane `billing_customers` table. */
	static table = table({
		name: "billing_customers",
		primaryKey: ["subject_id", "connection"],
		timestamps: true,
		columns: {
			subject_id: c.text(),
			connection: c.text(),
			provider_customer_id: c.text(),
			is_default: c.integer(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Reads the identity an account is billed against right now, which is the one
	 * a checkout, a portal session, and a usage event all name.
	 *
	 * @param db The control-plane database.
	 * @param subjectId The account id.
	 * @returns The default identity, or `null` for an account that has never paid.
	 */
	static findDefault(db: Database, subjectId: string) {
		return db.findOne(this.table, {
			where: { subject_id: subjectId, is_default: DEFAULT_CONNECTION },
		});
	}

	/**
	 * Reads the account that holds a platform customer id, which is how a delivery
	 * naming only that id reaches our own rows.
	 *
	 * @param db The control-plane database.
	 * @param connection The connection the id was issued by.
	 * @param providerCustomerId The platform's customer id.
	 * @returns The identity, or `null` when no account holds it.
	 */
	static findByProviderId(db: Database, connection: string, providerCustomerId: string) {
		return db.findOne(this.table, {
			where: { connection, provider_customer_id: providerCustomerId },
		});
	}

	/**
	 * Records the customer id a connection issued for an account, replacing the id
	 * held for that connection so a customer re-created on the platform re-links
	 * rather than conflicting.
	 *
	 * @param db The control-plane database.
	 * @param subjectId The account id.
	 * @param connection The connection that issued the id.
	 * @param providerCustomerId The platform's customer id.
	 * @returns A promise resolving once the row is written.
	 */
	static async link(
		db: Database,
		subjectId: string,
		connection: string,
		providerCustomerId: string,
	): Promise<void> {
		let now = new Date().toISOString();
		let existing = await db.findOne(this.table, {
			where: { subject_id: subjectId, connection },
		});

		if (existing) {
			await db.update(
				this.table,
				{ subject_id: subjectId, connection },
				{ provider_customer_id: providerCustomerId, updated_at: now },
			);
			return;
		}

		await db.create(this.table, {
			subject_id: subjectId,
			connection,
			provider_customer_id: providerCustomerId,
			is_default: DEFAULT_CONNECTION,
			created_at: now,
			updated_at: now,
		});
	}
}

/** Persisted billing-customer row. */
export type BillingCustomerRow = TableRow<typeof BillingCustomer.table>;
