/**
 * Data model for tenant custom hostnames. Wraps the `hostnames` D1 table and the
 * Cloudflare for SaaS API so tenants can attach default (`slug.platform`) and custom
 * domains, tracking validation/SSL status and keeping the KV resolution cache in sync.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { HostnameApiError, HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";
import { column as c, table } from "remix/data-table";

import type { HostMetadata } from "~/app/lib/host-metadata";

import { RecordNotFoundError } from "~/app/lib/db-errors";
import { invalidateHostnameCache } from "~/app/lib/hostname-cache";

/**
 * Cloudflare for SaaS client tagged with the `tenant_id` metadata key, so custom
 * hostnames created here carry the tenant metadata the worker entry reads to route
 * custom domains.
 */
let client = new HostnameClient({
	apiToken: env.CF_API_TOKEN,
	zoneId: env.CF_ZONE_ID,
	platformDomain: env.PLATFORM_DOMAIN,
	metadataKey: "tenant_id",
});

/**
 * Active-record–style model for tenant hostnames, exposing static query and mutation
 * helpers over the `hostnames` table plus Cloudflare for SaaS integration.
 *
 * @example
 * let hostnames = await Hostname.listByTenant(db, tenantId);
 */
export default class Hostname {
	/** Re-exported Cloudflare hostname API error type for callers to catch. */
	static CloudflareApiError = HostnameApiError;
	/** The `hostnames` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "hostnames",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			hostname: c.text(),
			is_default: c.boolean().default(false),
			status: c.enum(["pending_validation", "active", "deleted"]),
			ssl_status: c.text().nullable(),
			validation_txt_name: c.text().nullable(),
			validation_txt_value: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists every hostname belonging to a tenant.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose hostnames to list.
	 * @returns A promise resolving to the tenant's hostname rows.
	 */
	static listByTenant(db: Database, tenantId: string) {
		return db.findMany(Hostname.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Drops the KV resolution cache for every hostname of a tenant. Called when a
	 * tenant is suspended or deleted so its hostnames stop resolving from cache.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The tenant whose cached hostname resolutions to evict.
	 * @returns A promise that resolves once all cache entries are invalidated.
	 */
	static async invalidateTenantCache(db: Database, tenantId: string) {
		let hostnames = await Hostname.listByTenant(db, tenantId);
		await Promise.all(hostnames.map((hostname) => invalidateHostnameCache(hostname.hostname)));
	}

	/**
	 * Finds a hostname by its primary-key id.
	 *
	 * @param db - The platform database handle.
	 * @param id - The hostname id.
	 * @returns A promise resolving to the hostname row, or null when not found.
	 */
	static show(db: Database, id: string) {
		return db.findOne(Hostname.table, { where: { id } });
	}

	/**
	 * Finds a hostname row by its hostname string.
	 *
	 * @param db - The platform database handle.
	 * @param hostname - The fully-qualified hostname to look up.
	 * @returns A promise resolving to the hostname row, or null when not found.
	 */
	static findByHostname(db: Database, hostname: string) {
		return db.findOne(Hostname.table, { where: { hostname } });
	}

	/**
	 * Creates the tenant's default `slug.platformDomain` hostname (already active, no
	 * Cloudflare custom-hostname registration required).
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The owning tenant id.
	 * @param slug - The tenant slug used as the subdomain label.
	 * @param platformDomain - The base platform domain the subdomain hangs off.
	 * @returns A promise resolving to the newly-created default hostname row.
	 * @example
	 * let host = await Hostname.createDefault(db, tenant.id, tenant.slug, env.PLATFORM_DOMAIN);
	 */
	static async createDefault(db: Database, tenantId: string, slug: string, platformDomain: string) {
		let id = crypto.randomUUID();
		let now = new Date().toISOString();
		let hostname = `${slug}.${platformDomain}`;

		await db.create(Hostname.table, {
			id,
			tenant_id: tenantId,
			hostname,
			is_default: true,
			status: "active",
			ssl_status: null,
			validation_txt_name: null,
			validation_txt_value: null,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	/**
	 * Create a custom hostname via Cloudflare for SaaS API.
	 * This calls the real Cloudflare API and stores the result locally, keyed
	 * by Cloudflare's own hostname id so the two records stay correlated.
	 *
	 * @param db - The platform database handle.
	 * @param tenantId - The owning tenant id (attached as Cloudflare metadata).
	 * @param hostname - The custom hostname to register.
	 * @param region - Optional Cloudflare region hint for the hostname metadata.
	 * @returns A promise resolving to the stored hostname row (with validation details).
	 * @throws {HostnameApiError} When the Cloudflare API rejects the request.
	 */
	static async createCustom(
		db: Database,
		tenantId: string,
		hostname: string,
		region?: HostMetadata["region"],
	) {
		let cfHostname = await client.create(hostname, tenantId, region);

		let validationRecord = HostnameClient.getValidationTxtRecord(cfHostname);

		let now = new Date().toISOString();

		await db.create(Hostname.table, {
			id: cfHostname.id,
			tenant_id: tenantId,
			hostname: cfHostname.hostname,
			is_default: false,
			status: cfHostname.status === "active" ? "active" : "pending_validation",
			ssl_status: cfHostname.sslStatus,
			validation_txt_name: validationRecord?.name ?? null,
			validation_txt_value: validationRecord?.value ?? null,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(Hostname.table, { where: { id: cfHostname.id } }))!;
	}

	/**
	 * Refreshes a hostname's status from Cloudflare into the local record and
	 * invalidates the cached resolution since the status may have flipped.
	 * Default hostnames are skipped since Cloudflare never registers them.
	 *
	 * @param db - The platform database handle.
	 * @param id - The hostname id to refresh.
	 * @returns A promise resolving to the updated (or unchanged default) hostname row.
	 * @throws {RecordNotFoundError} When no hostname exists for the given id.
	 */
	static async refresh(db: Database, id: string) {
		let hostname = await db.findOne(Hostname.table, { where: { id } });
		if (!hostname) throw new RecordNotFoundError(Hostname.table, { id });

		if (hostname.is_default) return hostname;

		let cfHostname = await client.status(id);
		let validationRecord = HostnameClient.getValidationTxtRecord(cfHostname);

		await db.update(
			Hostname.table,
			{ id },
			{
				status: HostnameClient.isActive(cfHostname) ? "active" : "pending_validation",
				ssl_status: cfHostname.sslStatus,
				validation_txt_name: validationRecord?.name ?? null,
				validation_txt_value: validationRecord?.value ?? null,
				updated_at: new Date().toISOString(),
			},
		);

		await invalidateHostnameCache(hostname.hostname);
		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	/**
	 * Activates a hostname after Cloudflare reports it as active, invalidating
	 * the cached resolution so the next request re-reads the active mapping
	 * from D1.
	 *
	 * @param db - The platform database handle.
	 * @param id - The hostname id to activate.
	 * @returns A promise resolving to the activated hostname row.
	 * @throws {RecordNotFoundError} When no hostname exists for the given id.
	 */
	static async activate(db: Database, id: string) {
		let hostname = await db.findOne(Hostname.table, { where: { id } });
		if (!hostname) throw new RecordNotFoundError(Hostname.table, { id });

		await db.update(
			Hostname.table,
			{ id },
			{
				status: "active",
				validation_txt_name: null,
				validation_txt_value: null,
				updated_at: new Date().toISOString(),
			},
		);

		await invalidateHostnameCache(hostname.hostname);
		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	/**
	 * Deletes a hostname from Cloudflare (when custom) and the local record,
	 * tolerating a 404 since Cloudflare may already show it gone, then evicts
	 * the cached resolution so it stops routing to its former tenant.
	 *
	 * @param db - The platform database handle.
	 * @param id - The hostname id to delete.
	 * @returns A promise resolving to the D1 delete result.
	 * @throws {RecordNotFoundError} When no hostname exists for the given id.
	 * @throws {HostnameApiError} When Cloudflare deletion fails for a non-404 reason.
	 */
	static async destroy(db: Database, id: string) {
		let hostname = await db.findOne(Hostname.table, { where: { id } });
		if (!hostname) throw new RecordNotFoundError(Hostname.table, { id });

		if (!hostname.is_default) {
			try {
				await client.delete(id);
			} catch (error) {
				if (!(error instanceof HostnameApiError && error.statusCode === 404)) {
					throw error;
				}
			}
		}

		let result = await db.delete(Hostname.table, { id });
		await invalidateHostnameCache(hostname.hostname);
		return result;
	}

	/**
	 * Get human-readable status message for a hostname.
	 *
	 * @param hostname - An object carrying the hostname `status` and `ssl_status`.
	 * @returns A human-readable status label (e.g. "Active", "Pending DNS validation").
	 */
	static getStatusMessage(hostname: { status: string; ssl_status: string | null }): string {
		if (hostname.status === "active") return "Active";
		if (hostname.ssl_status === "pending_validation") return "Pending DNS validation";
		if (hostname.ssl_status === "pending_issuance") return "SSL certificate being issued";
		if (hostname.ssl_status === "pending_deployment") return "SSL certificate being deployed";
		return `Status: ${hostname.status}`;
	}
}
