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
import { generateUUIDv7 } from "@sdxc/uuid";
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
			/**
			 * A free-text slug rather than an enum: ADR-019 names the real tiers this
			 * plan catalog sells, so the column carries whatever it defines without a
			 * schema change.
			 */
			plan_slug: c.text().default("free"),
			subscription_status: c.text().default("active"),
			subscription_id: c.text().nullable(),
			current_period_end: c.integer().nullable(),
			cancel_at_period_end: c.boolean().default(false),
			grace_until: c.integer().nullable(),
			lapsed_at: c.integer().nullable(),
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
				id: tenantId(generateUUIDv7()).toString(),
				customer_id: data.customerId,
				name: data.name,
				slug: data.slug,
				issuer: data.issuer,
				region: data.region ?? "wnam",
				status: "active",
				plan_slug: "free",
				subscription_status: "active",
				subscription_id: null,
				current_period_end: null,
				cancel_at_period_end: false,
				grace_until: null,
				lapsed_at: null,
				deleted_at: null,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Finds the tenant a subscription id was recorded as the base plan of.
	 *
	 * @param db - Database connection.
	 * @param subscriptionId - The provider's own subscription id.
	 * @returns A promise resolving to the tenant row, or null when no tenant holds
	 * it as a base subscription.
	 */
	static findBySubscriptionId(db: Database, subscriptionId: string): Promise<TenantRow | null> {
		return db.findOne(Tenant.table, { where: { subscription_id: subscriptionId } });
	}

	/**
	 * Writes the billing/lapse fields a checkout, a webhook, or a reconciliation
	 * sweep decided; omitted fields keep their stored value.
	 *
	 * @param db - Database connection.
	 * @param id - The tenant id.
	 * @param data - The fields to change.
	 * @returns A promise resolving to the updated tenant row.
	 * @throws When no tenant exists for the given id.
	 */
	static update(
		db: Database,
		id: string,
		data: Partial<{
			planSlug: string;
			subscriptionId: string | null;
			subscriptionStatus: string;
			currentPeriodEnd: number | null;
			cancelAtPeriodEnd: boolean;
			graceUntil: number | null;
			lapsedAt: number | null;
		}>,
	): Promise<TenantRow> {
		return db.update(
			Tenant.table,
			{ id },
			{
				...(data.planSlug !== undefined && { plan_slug: data.planSlug }),
				...(data.subscriptionId !== undefined && { subscription_id: data.subscriptionId }),
				...(data.subscriptionStatus !== undefined && {
					subscription_status: data.subscriptionStatus,
				}),
				...(data.currentPeriodEnd !== undefined && { current_period_end: data.currentPeriodEnd }),
				...(data.cancelAtPeriodEnd !== undefined && {
					cancel_at_period_end: data.cancelAtPeriodEnd,
				}),
				...(data.graceUntil !== undefined && { grace_until: data.graceUntil }),
				...(data.lapsedAt !== undefined && { lapsed_at: data.lapsedAt }),
			},
			{ touch: true },
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

/**
 * Whether a tenant's lapse (ADR-018) must refuse a paid-capability write. Token
 * issuance and a custom domain already serving as an issuer keep working through a
 * lapse regardless — this is only for the write side of a paid capability, per
 * ADR-018's "Payment failure and cancellation" table.
 *
 * Nothing in this codebase calls this yet, because none of the paid capabilities it
 * gates exist here yet: custom-domain configuration beyond attachment, branding
 * edits, session policy changes, SSO connection setup, and API key minting are each
 * a later ADR's own write path, and each is expected to check this before it commits.
 *
 * @param tenant - The tenant row a paid-capability write is being attempted against.
 * @returns Whether the tenant has lapsed and the write must refuse.
 * @example
 * if (isTenantWriteRestricted(tenant)) throw new TenantLapsedError(tenant.id);
 */
export function isTenantWriteRestricted(tenant: Pick<TenantRow, "lapsed_at">): boolean {
	return tenant.lapsed_at !== null;
}
