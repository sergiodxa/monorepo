/**
 * The link between a tenant and the customer record a billing connection issued for it.
 * It is a row per connection rather than a column on the subscription, so a tenant that
 * gains a second provider identity keeps both while one of them stays the one billed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * Active-record–style model over the `billing_customers` table, resolving the
 * provider customer id every billing call for a tenant is addressed with.
 *
 * @example
 * let customer = await BillingCustomer.findByTenant(db, tenantId);
 */
export default class BillingCustomer {
	/** The `billing_customers` D1 table definition (columns, composite key, timestamps). */
	static table = table({
		name: "billing_customers",
		primaryKey: ["tenant_id", "connection"],
		timestamps: true,
		columns: {
			tenant_id: c.text(),
			connection: c.text(),
			provider_customer_id: c.text(),
			is_default: c.boolean().default(true),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Reads the identity a tenant is billed through right now.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose customer link to resolve.
	 * @returns The default link, or null while the tenant is a customer of nothing.
	 */
	static findByTenant(db: Database, tenantId: string) {
		return db.findOne(BillingCustomer.table, {
			where: { tenant_id: tenantId, is_default: true },
		});
	}

	/**
	 * Reads the tenant a provider customer id belongs to, which is how a delivery
	 * naming only the platform's own id reaches our records.
	 *
	 * @param db - The platform database handle.
	 * @param connection - The credential set that issued the id.
	 * @param providerCustomerId - The customer id as the platform reports it.
	 * @returns The link, or null when no tenant holds that identity.
	 */
	static findByProviderId(db: Database, connection: string, providerCustomerId: string) {
		return db.findOne(BillingCustomer.table, {
			where: { connection, provider_customer_id: providerCustomerId },
		});
	}

	/**
	 * Records the identity a connection issued for a tenant and makes it the one
	 * the tenant is billed against.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant the identity belongs to.
	 * @param connection - The credential set that issued it.
	 * @param providerCustomerId - The customer id as the platform reports it.
	 */
	static async link(
		db: Database,
		tenantId: string,
		connection: string,
		providerCustomerId: string,
	): Promise<void> {
		let now = new Date().toISOString();

		await db.create(BillingCustomer.table, {
			tenant_id: tenantId,
			connection,
			provider_customer_id: providerCustomerId,
			is_default: true,
			created_at: now,
			updated_at: now,
		});
	}
}
