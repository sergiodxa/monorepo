/**
 * Data model for tenant domains: the hostnames that reach a tenant's Durable Object,
 * whether the platform's own default subdomain or a customer's own DNS. Wraps the
 * `domains` D1 table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUIDv7 } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/** Whether a domain is the platform-issued default or a customer's own DNS. */
export type DomainKind = "platform" | "custom";

/** A domain's DNS-verification/activation state. */
export type DomainStatus = "pending" | "active" | "failed";

/** Mints a `dom_` TypeID for a new domain row. */
const domainId = typeid("dom");

/** One domain row as the control plane stores it. */
export type DomainRow = TableRow<typeof Domain.table>;

/**
 * Active-record–style model for tenant domains, exposing static query and mutation
 * helpers over the `domains` table.
 *
 * @example
 * let domain = await Domain.findByHostname(db, "acme.auth.sergiodxa.com");
 */
export default class Domain {
	/** The `domains` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "domains",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			hostname: c.text(),
			kind: c.enum(["platform", "custom"] as const),
			status: c.enum(["pending", "active", "failed"] as const).default("pending"),
			certificate_status: c.text().nullable(),
			verification_name: c.text().nullable(),
			verification_value: c.text().nullable(),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Lists every domain of a tenant.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @returns A promise resolving to the tenant's domain rows.
	 */
	static listByTenant(db: Database, tenantId: string): Promise<DomainRow[]> {
		return db.findMany(Domain.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Finds the domain a hostname resolves to.
	 *
	 * @param db - Database connection.
	 * @param hostname - The fully-qualified hostname a request arrived on.
	 * @returns A promise resolving to the domain row, or null when unregistered.
	 */
	static findByHostname(db: Database, hostname: string): Promise<DomainRow | null> {
		return db.findOne(Domain.table, { where: { hostname } });
	}

	/**
	 * Lists every domain still awaiting DNS verification or certificate issuance.
	 *
	 * @param db - Database connection.
	 * @returns A promise resolving to the pending domain rows.
	 */
	static listPending(db: Database): Promise<DomainRow[]> {
		return db.findMany(Domain.table, { where: { status: "pending" } });
	}

	/**
	 * Registers a domain for a tenant. A platform domain is created active — the
	 * wildcard route and its certificate already cover it, so there is no verification
	 * to wait for — while a custom domain defaults to `pending` until it verifies.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant, hostname, kind (platform default or customer-owned),
	 * and optional initial status (defaults to `pending`).
	 * @returns A promise resolving to the newly-created domain row.
	 */
	static create(
		db: Database,
		data: { tenantId: string; hostname: string; kind: DomainKind; status?: DomainStatus },
	): Promise<DomainRow> {
		return db.create(
			Domain.table,
			{
				id: domainId(generateUUIDv7()).toString(),
				tenant_id: data.tenantId,
				hostname: data.hostname,
				kind: data.kind,
				status: data.status ?? "pending",
				certificate_status: null,
				verification_name: null,
				verification_value: null,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Updates a domain's verification/activation state.
	 *
	 * @param db - Database connection.
	 * @param id - The domain id.
	 * @param data - The fields to change.
	 * @returns A promise resolving to the updated domain row.
	 * @throws When no domain exists for the given id.
	 */
	static update(
		db: Database,
		id: string,
		data: Partial<{
			status: DomainStatus;
			certificateStatus: string | null;
			verificationName: string | null;
			verificationValue: string | null;
		}>,
	): Promise<DomainRow> {
		return db.update(
			Domain.table,
			{ id },
			{
				...(data.status !== undefined && { status: data.status }),
				...(data.certificateStatus !== undefined && { certificate_status: data.certificateStatus }),
				...(data.verificationName !== undefined && { verification_name: data.verificationName }),
				...(data.verificationValue !== undefined && {
					verification_value: data.verificationValue,
				}),
			},
			{ touch: true },
		);
	}

	/**
	 * Removes a domain.
	 *
	 * @param db - Database connection.
	 * @param id - The domain id.
	 * @returns A promise resolving to whether a row was deleted.
	 */
	static delete(db: Database, id: string): Promise<boolean> {
		return db.delete(Domain.table, { id });
	}
}
