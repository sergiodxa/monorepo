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

import { NotFound } from "@sdxc/data-model";
import { HostnameApiError, HostnameClient } from "@sdxc/hostname";
import { unwrap } from "@sdxc/result";

import type { Models } from "~/app/models";
import type { DomainRow } from "~/app/models/domains";

import { invalidateHostnameCache } from "~/app/lib/hostname-cache";

/** How long a domain may sit `pending` before it is marked `failed`. */
const PENDING_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Attaches a custom domain to a tenant: registers a Cloudflare for SaaS custom
 * hostname asking for a DV certificate validated over TXT, and records the domain
 * `pending` with the TXT record the customer has to publish. Whether the tenant may
 * attach one is the attach route's `custom_domain` entitlement gate.
 *
 * @param models - The control plane's models.
 * @param hostnameClient - Client for the Cloudflare zone the hostname is registered on.
 * @param tenantId - The tenant the domain is attached to.
 * @param hostname - The customer's own hostname (e.g. `auth.customer.example`).
 * @returns A promise resolving to the newly-created, `pending` domain row.
 * @throws {NotFound} When no tenant exists for the given id.
 * @example
 * let domain = await attachCustomDomain(ctx.models, hostnameClient, tenant.id, "auth.acme.com");
 */
export async function attachCustomDomain(
	models: Models,
	hostnameClient: HostnameClient,
	tenantId: string,
	hostname: string,
): Promise<DomainRow> {
	let tenant = await models.tenants.find(tenantId);
	if (!tenant) throw new NotFound("tenants", tenantId);

	let result = await hostnameClient.create(hostname, tenantId, tenant.region);
	let domain = unwrap(
		await models.domains.create({ tenant_id: tenantId, hostname, kind: "custom" }),
	);

	let record = HostnameClient.getValidationTxtRecord(result);
	if (record) {
		domain = unwrap(
			await models.domains.update(domain.id, {
				verification_name: record.name,
				verification_value: record.value,
			}),
		);
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
 * @param models - The control plane's models.
 * @param hostnameClient - Client for the Cloudflare zone the hostname was registered on.
 * @param domain - The domain row to refresh.
 * @returns A promise resolving to the domain row: updated on a status transition, or
 * the row passed in when nothing changed yet.
 * @example
 * for (let domain of await ctx.models.domains.pending().all()) {
 * 	await refreshDomainStatus(ctx.models, hostnameClient, domain);
 * }
 */
export async function refreshDomainStatus(
	models: Models,
	hostnameClient: HostnameClient,
	domain: DomainRow,
): Promise<DomainRow> {
	let result = await hostnameClient.getByName(domain.hostname);

	if (result && HostnameClient.isActive(result)) {
		let updated = unwrap(
			await models.domains.update(domain.id, {
				status: "active",
				certificate_status: result.sslStatus,
			}),
		);
		await invalidateHostnameCache(domain.hostname);
		return updated;
	}

	let pendingFor = Date.now() - domain.created_at;
	if (domain.status === "pending" && pendingFor > PENDING_TIMEOUT_MS) {
		let updated = unwrap(await models.domains.update(domain.id, { status: "failed" }));
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
 * @param models - The control plane's models.
 * @param hostnameClient - Client for the Cloudflare zone the hostname was registered on.
 * @param domain - The domain row to remove.
 * @returns A promise that resolves once the domain has been removed.
 * @example
 * await removeDomain(ctx.models, hostnameClient, domain);
 */
export async function removeDomain(
	models: Models,
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

	await models.domains.delete(domain.id);
	await invalidateHostnameCache(domain.hostname);
}
