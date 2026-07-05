import type { Database } from "remix/data-table";

import { HostnameApiError, HostnameClient } from "@pkg/hostname";
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

export default class Hostname {
	static CloudflareApiError = HostnameApiError;
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

	static listByTenant(db: Database, tenantId: string) {
		return db.findMany(Hostname.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Drops the KV resolution cache for every hostname of a tenant. Called when a
	 * tenant is suspended or deleted so its hostnames stop resolving from cache.
	 */
	static async invalidateTenantCache(db: Database, tenantId: string) {
		let hostnames = await Hostname.listByTenant(db, tenantId);
		await Promise.all(hostnames.map((hostname) => invalidateHostnameCache(hostname.hostname)));
	}

	static show(db: Database, id: string) {
		return db.findOne(Hostname.table, { where: { id } });
	}

	static findByHostname(db: Database, hostname: string) {
		return db.findOne(Hostname.table, { where: { hostname } });
	}

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
	 * This calls the real Cloudflare API and stores the result locally.
	 */
	static async createCustom(
		db: Database,
		tenantId: string,
		hostname: string,
		region?: HostMetadata["region"],
	) {
		// Call Cloudflare API to create the custom hostname
		let cfHostname = await client.create(hostname, tenantId, region);

		// Extract validation record if present
		let validationRecord = HostnameClient.getValidationTxtRecord(cfHostname);

		let now = new Date().toISOString();

		// Store in local D1 database
		await db.create(Hostname.table, {
			id: cfHostname.id, // Use Cloudflare's hostname ID
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
	 * Refresh hostname status from Cloudflare API.
	 * Updates local D1 record with latest status from Cloudflare.
	 */
	static async refresh(db: Database, id: string) {
		let hostname = await db.findOne(Hostname.table, { where: { id } });
		if (!hostname) throw new RecordNotFoundError(Hostname.table, { id });

		// Default hostnames don't need refresh (they're not in Cloudflare)
		if (hostname.is_default) return hostname;

		// Fetch latest status from Cloudflare
		let cfHostname = await client.status(id);
		let validationRecord = HostnameClient.getValidationTxtRecord(cfHostname);

		// Update local record
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

		// Status may have flipped (e.g. active -> pending), so drop any cached mapping.
		await invalidateHostnameCache(hostname.hostname);
		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	/**
	 * Activate a hostname (update local status to active).
	 * Called after Cloudflare reports the hostname is active.
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

		// Force the next request to re-read the now-active mapping from D1.
		await invalidateHostnameCache(hostname.hostname);
		return (await db.findOne(Hostname.table, { where: { id } }))!;
	}

	/**
	 * Delete a hostname from both Cloudflare and local D1.
	 */
	static async destroy(db: Database, id: string) {
		let hostname = await db.findOne(Hostname.table, { where: { id } });
		if (!hostname) throw new RecordNotFoundError(Hostname.table, { id });

		// Delete from Cloudflare if it's a custom hostname
		if (!hostname.is_default) {
			try {
				await client.delete(id);
			} catch (error) {
				// Ignore 404 errors (hostname already deleted from Cloudflare)
				if (!(error instanceof HostnameApiError && error.statusCode === 404)) {
					throw error;
				}
			}
		}

		let result = await db.delete(Hostname.table, { id });
		// Stop routing the deleted hostname to its former tenant.
		await invalidateHostnameCache(hostname.hostname);
		return result;
	}

	/**
	 * Get human-readable status message for a hostname.
	 */
	static getStatusMessage(hostname: { status: string; ssl_status: string | null }): string {
		if (hostname.status === "active") return "Active";
		if (hostname.ssl_status === "pending_validation") return "Pending DNS validation";
		if (hostname.ssl_status === "pending_issuance") return "SSL certificate being issued";
		if (hostname.ssl_status === "pending_deployment") return "SSL certificate being deployed";
		return `Status: ${hostname.status}`;
	}
}
