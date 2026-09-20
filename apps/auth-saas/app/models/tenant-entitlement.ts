/**
 * Data model for tenant entitlements: the local projection of what a tenant holds,
 * written by a checkout return, a webhook, or the reconciliation sweep, and read by
 * `requireEntitlement()` and `/authorize` so a billing platform outage costs only
 * new checkouts. Wraps the `tenant_entitlements` D1 table — one row per tenant, kept
 * off the request path from the provider.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColumnBuilder, Database, TableRow } from "remix/data-table";

import { column as c, lt, table } from "remix/data-table";

/** One tenant entitlement row as the control plane stores it. */
export type TenantEntitlementRow = TableRow<typeof TenantEntitlement.table>;

/**
 * Active-record–style model for tenant entitlement projections, exposing static
 * query and mutation helpers over the `tenant_entitlements` table.
 *
 * @example
 * let entitlement = await TenantEntitlement.findByTenant(db, tenant.id);
 */
export default class TenantEntitlement {
	/** The `tenant_entitlements` D1 table definition. Keyed on `tenant_id` itself,
	 * since a row is a cache of what a tenant currently holds rather than an
	 * independent record with an id of its own. */
	static table = table({
		name: "tenant_entitlements",
		primaryKey: ["tenant_id"],
		timestamps: true,
		columns: {
			tenant_id: c.text(),
			products: c.json() as ColumnBuilder<string[]>,
			features: c.json() as ColumnBuilder<Record<string, boolean>>,
			read_at: c.integer(),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Finds a tenant's current entitlement projection.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @returns A promise resolving to the entitlement row, or null when nothing has
	 * been projected for this tenant yet.
	 */
	static findByTenant(db: Database, tenantId: string): Promise<TenantEntitlementRow | null> {
		return db.findOne(TenantEntitlement.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Lists every projection last read before the given time, which is what the
	 * reconciliation sweep walks to refresh a projection a missed delivery left stale.
	 *
	 * @param db - Database connection.
	 * @param before - The cutoff; a row read at or after it is not stale.
	 * @returns A promise resolving to the stale entitlement rows.
	 */
	static listStale(db: Database, before: number): Promise<TenantEntitlementRow[]> {
		return db.findMany(TenantEntitlement.table, { where: lt("read_at", before) });
	}

	/**
	 * Writes a tenant's entitlement projection, creating the row on its first
	 * write and overwriting it wholesale on every write after, since the platform
	 * read this call writes is always taken as the full current state rather than
	 * a diff against what was there.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param data - The products and features the tenant now holds, and when the
	 * platform answered.
	 * @returns A promise resolving to the written entitlement row.
	 */
	static async upsert(
		db: Database,
		tenantId: string,
		data: { products: string[]; features: Record<string, boolean>; readAt: number },
	): Promise<TenantEntitlementRow> {
		let existing = await TenantEntitlement.findByTenant(db, tenantId);

		if (existing) {
			return db.update(
				TenantEntitlement.table,
				{ tenant_id: tenantId },
				{ products: data.products, features: data.features, read_at: data.readAt },
				{ touch: true },
			);
		}

		return db.create(
			TenantEntitlement.table,
			{
				tenant_id: tenantId,
				products: data.products,
				features: data.features,
				read_at: data.readAt,
			},
			{ touch: true, returnRow: true },
		);
	}
}
