import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import HostnameService from "~/app/services/hostname";
import { RecordNotFoundError } from "~/lib/db-errors";

export default class Hostname {
	static CloudflareApiError = HostnameService.ApiError;
	static table = createTable({
		name: "hostnames",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			tenant_id: s.string(),
			hostname: s.string(),
			is_default: s.defaulted(s.boolean(), false),
			status: s.enum_(["pending_validation", "active", "deleted"]),
			ssl_status: s.nullable(s.string()),
			validation_txt_name: s.nullable(s.string()),
			validation_txt_value: s.nullable(s.string()),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	static listByTenant(db: Database, tenantId: string) {
		return db.findMany(Hostname.table, { where: { tenant_id: tenantId } });
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
	static async createCustom(db: Database, tenantId: string, hostname: string, region?: string) {
		// Call Cloudflare API to create the custom hostname
		let cfHostname = await HostnameService.createHostname(hostname, tenantId, region);

		// Extract validation record if present
		let validationRecord = HostnameService.getValidationRecord(cfHostname);

		let now = new Date().toISOString();

		// Store in local D1 database
		await db.create(Hostname.table, {
			id: cfHostname.id, // Use Cloudflare's hostname ID
			tenant_id: tenantId,
			hostname: cfHostname.hostname,
			is_default: false,
			status: cfHostname.status === "active" ? "active" : "pending_validation",
			ssl_status: cfHostname.ssl.status,
			validation_txt_name: validationRecord?.txt_name ?? null,
			validation_txt_value: validationRecord?.txt_value ?? null,
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
		let cfHostname = await HostnameService.getHostname(id);
		let validationRecord = HostnameService.getValidationRecord(cfHostname);

		// Update local record
		await db.update(
			Hostname.table,
			{ id },
			{
				status: HostnameService.isActive(cfHostname) ? "active" : "pending_validation",
				ssl_status: cfHostname.ssl.status,
				validation_txt_name: validationRecord?.txt_name ?? null,
				validation_txt_value: validationRecord?.txt_value ?? null,
				updated_at: new Date().toISOString(),
			},
		);

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
				await HostnameService.deleteHostname(id);
			} catch (error) {
				// Ignore 404 errors (hostname already deleted from Cloudflare)
				if (!(error instanceof HostnameService.ApiError && error.statusCode === 404)) {
					throw error;
				}
			}
		}

		return await db.delete(Hostname.table, { id });
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
