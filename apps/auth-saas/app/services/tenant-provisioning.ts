/**
 * Ties tenant creation to ADR-003/004/005 in one operation: writes the `tenants` row,
 * writes the `kind: "platform"` domain row its issuer names, and provisions the
 * tenant's Durable Object under that issuer — the platform subdomain a tenant answers
 * to for the rest of its life.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { env } from "cloudflare:workers";

import type { Region, TenantRow } from "~/app/models/tenant";

import Domain from "~/app/models/domain";
import Tenant from "~/app/models/tenant";

/** What creating a tenant needs: its owning customer, display name, and placement. */
export interface ProvisionTenantInput {
	customerId: string;
	name: string;
	region?: Region;
}

/**
 * Creates a tenant end-to-end: generates its slug, builds the issuer that slug forms
 * under the platform domain, writes the `tenants` row and its always-active platform
 * domain row, then provisions the tenant's Durable Object with that same issuer — the
 * choice ADR-005 makes once and never changes.
 *
 * @param db - Database connection.
 * @param input - The tenant's owning customer, display name, and optional region.
 * @returns A promise resolving to the newly-created tenant row.
 * @example
 * let tenant = await provisionTenant(db, { customerId: customer.id, name: "Acme, Inc." });
 */
export async function provisionTenant(
	db: Database,
	input: ProvisionTenantInput,
): Promise<TenantRow> {
	let slug = Tenant.generateSlug(input.name);
	let hostname = `${slug}.${env.PLATFORM_DOMAIN}`;
	let issuer = `https://${hostname}`;

	let tenant = await Tenant.create(db, {
		customerId: input.customerId,
		name: input.name,
		slug,
		issuer,
		region: input.region,
	});

	await Domain.create(db, { tenantId: tenant.id, hostname, kind: "platform", status: "active" });

	await env.TENANT.getByName(tenant.id).provision({ tenantId: tenant.id, issuer });

	return tenant;
}
