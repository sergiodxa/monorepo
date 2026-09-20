/**
 * Data model for tenant add-ons: a tenant's subscriptions beyond its base plan, each
 * its own Polar subscription with its own status and period. Wraps the
 * `tenant_addons` D1 table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUIDv7 } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/** Mints an `addon_` TypeID for a new tenant add-on row. */
const addonId = typeid("addon");

/** One tenant add-on row as the control plane stores it. */
export type TenantAddonRow = TableRow<typeof TenantAddon.table>;

/**
 * Active-record–style model for tenant add-ons, exposing static query and
 * mutation helpers over the `tenant_addons` table.
 *
 * @example
 * let addon = await TenantAddon.findBySubscriptionId(db, subscriptionId);
 */
export default class TenantAddon {
	/** The `tenant_addons` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "tenant_addons",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			product_slug: c.text(),
			subscription_id: c.text(),
			status: c.text(),
			current_period_end: c.integer().nullable(),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Lists every add-on a tenant currently holds.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @returns A promise resolving to the tenant's add-on rows.
	 */
	static listByTenant(db: Database, tenantId: string): Promise<TenantAddonRow[]> {
		return db.findMany(TenantAddon.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Finds the tenant add-on a subscription id was recorded against.
	 *
	 * @param db - Database connection.
	 * @param subscriptionId - The provider's own subscription id.
	 * @returns A promise resolving to the add-on row, or null when no add-on holds it.
	 */
	static findBySubscriptionId(
		db: Database,
		subscriptionId: string,
	): Promise<TenantAddonRow | null> {
		return db.findOne(TenantAddon.table, { where: { subscription_id: subscriptionId } });
	}

	/**
	 * Records a new add-on subscription for a tenant, once a checkout or a
	 * subscription event has resolved which tenant it belongs to.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant, the product it bought, the subscription id, its
	 * status, and the current period end.
	 * @returns A promise resolving to the newly-created add-on row.
	 */
	static create(
		db: Database,
		data: {
			tenantId: string;
			productSlug: string;
			subscriptionId: string;
			status: string;
			currentPeriodEnd: number | null;
		},
	): Promise<TenantAddonRow> {
		return db.create(
			TenantAddon.table,
			{
				id: addonId(generateUUIDv7()).toString(),
				tenant_id: data.tenantId,
				product_slug: data.productSlug,
				subscription_id: data.subscriptionId,
				status: data.status,
				current_period_end: data.currentPeriodEnd,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Writes the status and period a subscription event reported for an add-on
	 * already on file.
	 *
	 * @param db - Database connection.
	 * @param id - The add-on row's id.
	 * @param data - The status and current period end to record.
	 * @returns A promise resolving to the updated add-on row.
	 * @throws When no add-on exists for the given id.
	 */
	static update(
		db: Database,
		id: string,
		data: { status: string; currentPeriodEnd: number | null },
	): Promise<TenantAddonRow> {
		return db.update(
			TenantAddon.table,
			{ id },
			{ status: data.status, current_period_end: data.currentPeriodEnd },
			{ touch: true },
		);
	}
}
