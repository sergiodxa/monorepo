/**
 * Data model for tenants: an isolated OIDC/OAuth2 provider addressed by its own
 * Durable Object, its own hostname, and its own subscription. Wraps the `tenants` D1
 * table plus slug generation; ownership and team access live in the `memberships`
 * table, and hostnames live in `domains`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/** Cloudflare region codes a tenant's Durable Object can be placed in. */
export type Region = "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";

/** Mints a `ten_` TypeID for a new tenant row. */
const tenantId = typeid("ten");

/** One tenant row as the control plane stores it. */
export type TenantRow = TableRow<typeof Tenant.table>;

/**
 * Active-record–style model for tenants, exposing static query and mutation helpers
 * over the `tenants` table plus slug generation.
 *
 * @example
 * let tenant = await Tenant.findBySlug(db, "acme");
 */
export default class Tenant {
	/** The `tenants` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "tenants",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			customer_id: c.text(),
			name: c.text(),
			slug: c.text(),
			issuer: c.text(),
			region: c
				.enum(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const)
				.default("wnam"),
			status: c.enum(["active", "suspended", "deleted"] as const).default("active"),
			plan: c.enum(["free", "pro", "premium"] as const).default("free"),
			subscription_status: c.text().default("active"),
			billing_subscription_id: c.text().nullable(),
			current_period_end: c.integer().nullable(),
			deleted_at: c.integer().nullable(),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Finds a tenant by its primary-key id.
	 *
	 * @param db - Database connection.
	 * @param id - The tenant id.
	 * @returns A promise resolving to the tenant row, or null when not found.
	 */
	static findById(db: Database, id: string): Promise<TenantRow | null> {
		return db.findOne(Tenant.table, { where: { id } });
	}

	/**
	 * Finds a tenant by its unique slug.
	 *
	 * @param db - Database connection.
	 * @param slug - The tenant slug to look up.
	 * @returns A promise resolving to the tenant row, or null when not found.
	 */
	static findBySlug(db: Database, slug: string): Promise<TenantRow | null> {
		return db.findOne(Tenant.table, { where: { slug } });
	}

	/**
	 * Finds a tenant by its unique OIDC issuer.
	 *
	 * @param db - Database connection.
	 * @param issuer - The issuer URL a request or token names.
	 * @returns A promise resolving to the tenant row, or null when not found.
	 */
	static findByIssuer(db: Database, issuer: string): Promise<TenantRow | null> {
		return db.findOne(Tenant.table, { where: { issuer } });
	}

	/**
	 * Lists every tenant a customer owns.
	 *
	 * @param db - Database connection.
	 * @param customerId - The billing customer id.
	 * @returns A promise resolving to the customer's tenant rows.
	 */
	static listByCustomer(db: Database, customerId: string): Promise<TenantRow[]> {
		return db.findMany(Tenant.table, { where: { customer_id: customerId } });
	}

	/**
	 * Creates a new active tenant on the free plan. Provisioning its Durable Object
	 * (applying the object's schema registry and recording the issuer) is a separate
	 * step against the tenant's own storage.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant's owning customer, name, slug, issuer, and region.
	 * @returns A promise resolving to the newly-created tenant row.
	 */
	static create(
		db: Database,
		data: { customerId: string; name: string; slug: string; issuer: string; region?: Region },
	): Promise<TenantRow> {
		return db.create(
			Tenant.table,
			{
				id: tenantId(generateUUID()).toString(),
				customer_id: data.customerId,
				name: data.name,
				slug: data.slug,
				issuer: data.issuer,
				region: data.region ?? "wnam",
				status: "active",
				plan: "free",
				subscription_status: "active",
				billing_subscription_id: null,
				current_period_end: null,
				deleted_at: null,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Generates a URL-safe, unique-ish slug from a tenant name by lowercasing,
	 * replacing non-alphanumerics with hyphens, trimming, and appending random chars.
	 *
	 * @param name - The tenant display name to derive a slug from.
	 * @returns A slug of the form `some-name-ab12`.
	 * @example
	 * let slug = Tenant.generateSlug("Acme, Inc."); // e.g. "acme-inc-4f9a"
	 */
	static generateSlug(name: string): string {
		let base = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 20);

		let random = crypto.randomUUID().slice(0, 4);
		return `${base}-${random}`;
	}
}
