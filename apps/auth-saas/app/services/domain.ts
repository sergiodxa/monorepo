/**
 * Domain lifecycle operations for tenant custom domains (ADR-005): attaching one
 * through Cloudflare for SaaS, refreshing its verification/certificate status, and
 * removing it. Each function is given the `HostnameClient` it calls, rather than
 * building one from the environment, so a caller controls which Cloudflare
 * credentials and zone the operation runs against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { HostnameApiError, HostnameClient } from "@sdxc/hostname";

import type { DomainRow } from "~/app/models/domain";

import { RecordNotFoundError } from "~/app/lib/db-errors";
import { invalidateHostnameCache } from "~/app/lib/hostname-cache";
import Domain from "~/app/models/domain";
import Tenant from "~/app/models/tenant";

/** How long a domain may sit `pending` before it is marked `failed`. */
const PENDING_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

/** Thrown when a tenant on a plan without custom-domain access tries to attach one. */
export class CustomDomainNotAllowedError extends Error {
	override name = "CustomDomainNotAllowedError";

	/**
	 * @param tenantId - The tenant that attempted to attach a custom domain.
	 */
	constructor(public readonly tenantId: string) {
		super(`Tenant ${tenantId} is on the free plan and cannot attach a custom domain`);
	}
}

/**
 * Attaches a custom domain to a tenant: registers a Cloudflare for SaaS custom
 * hostname asking for a DV certificate validated over TXT, and records the domain
 * `pending` with the TXT record the customer has to publish. Gated on the tenant
 * being above the free plan, per ADR-005 — attaching a custom domain is Pro and above.
 *
 * @param db - Database connection.
 * @param hostnameClient - Client for the Cloudflare zone the hostname is registered on.
 * @param tenantId - The tenant the domain is attached to.
 * @param hostname - The customer's own hostname (e.g. `auth.customer.example`).
 * @returns A promise resolving to the newly-created, `pending` domain row.
 * @throws {CustomDomainNotAllowedError} When the tenant is on the free plan.
 * @example
 * let domain = await attachCustomDomain(db, hostnameClient, tenant.id, "auth.acme.com");
 */
export async function attachCustomDomain(
	db: Database,
	hostnameClient: HostnameClient,
	tenantId: string,
	hostname: string,
): Promise<DomainRow> {
	let tenant = await Tenant.findById(db, tenantId);
	if (!tenant) throw new RecordNotFoundError(Tenant.table, { id: tenantId });
	if (tenant.plan_slug === "free") throw new CustomDomainNotAllowedError(tenantId);

	let result = await hostnameClient.create(hostname, tenantId, tenant.region);
	let domain = await Domain.create(db, { tenantId, hostname, kind: "custom" });

	let record = HostnameClient.getValidationTxtRecord(result);
	if (record) {
		domain = await Domain.update(db, domain.id, {
			verificationName: record.name,
			verificationValue: record.value,
		});
	}

	return domain;
}

/**
 * Refreshes a domain's verification/certificate status against Cloudflare, the way
 * the dashboard does when the page opens and the daily cron does for every pending
 * domain. Looks the hostname up by name rather than by a stored Cloudflare id, since
 * the `domains` row keeps none (ADR-003) — the hostname itself is what both sides key
 * on. Promotes to `active` once Cloudflare reports the hostname and its certificate
 * are both active, and fails a domain still pending after seven days so the customer
 * can attach it again. Invalidates the hostname cache on either transition.
 *
 * @param db - Database connection.
 * @param hostnameClient - Client for the Cloudflare zone the hostname was registered on.
 * @param domain - The domain row to refresh.
 * @returns A promise resolving to the domain row: updated on a status transition, or
 * the row passed in when nothing changed yet.
 * @example
 * for (let domain of await Domain.listPending(db)) {
 * 	await refreshDomainStatus(db, hostnameClient, domain);
 * }
 */
export async function refreshDomainStatus(
	db: Database,
	hostnameClient: HostnameClient,
	domain: DomainRow,
): Promise<DomainRow> {
	let result = await hostnameClient.getByName(domain.hostname);

	if (result && HostnameClient.isActive(result)) {
		let updated = await Domain.update(db, domain.id, {
			status: "active",
			certificateStatus: result.sslStatus,
		});
		await invalidateHostnameCache(domain.hostname);
		return updated;
	}

	let pendingFor = Date.now() - domain.created_at;
	if (domain.status === "pending" && pendingFor > PENDING_TIMEOUT_MS) {
		let updated = await Domain.update(db, domain.id, { status: "failed" });
		await invalidateHostnameCache(domain.hostname);
		return updated;
	}

	return domain;
}

/**
 * Removes a domain: deletes its Cloudflare custom hostname (treating a 404 — the
 * hostname already being gone — the same as success), deletes the `domains` row, and
 * invalidates the hostname cache so the next request re-reads D1.
 *
 * @param db - Database connection.
 * @param hostnameClient - Client for the Cloudflare zone the hostname was registered on.
 * @param domain - The domain row to remove.
 * @returns A promise that resolves once the domain has been removed.
 * @example
 * await removeDomain(db, hostnameClient, domain);
 */
export async function removeDomain(
	db: Database,
	hostnameClient: HostnameClient,
	domain: DomainRow,
): Promise<void> {
	let result = await hostnameClient.getByName(domain.hostname);
	if (result) {
		try {
			await hostnameClient.delete(result.id);
		} catch (error) {
			if (!(error instanceof HostnameApiError) || error.statusCode !== 404) throw error;
		}
	}

	await Domain.delete(db, domain.id);
	await invalidateHostnameCache(domain.hostname);
}
