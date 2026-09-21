/**
 * Fans a callback out across every provisioned tenant's own Durable Object, paging
 * through the control plane's tenant list so a cron that needs to reach into every
 * tenant's storage does not carry its own pagination and stub-resolution logic. One
 * tenant's own failure is caught and logged rather than stopping the rest of the
 * sweep, the same isolation the daily domain refresh already gives each domain it
 * walks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type Tenant from "~/database/tenant-do";

import TenantModel from "~/app/models/tenant";

/** How many tenants one page reads from the control plane, when a caller does not choose. */
const DEFAULT_PAGE_SIZE = 100;

export interface ForEachProvisionedTenantOptions {
	/** Stops paging once aborted; a tenant already being visited still finishes. */
	signal?: AbortSignal;
	/** How many tenants one page reads from the control plane. */
	pageSize?: number;
}

export interface ForEachProvisionedTenantResult {
	/** How many tenants the callback ran for. */
	visited: number;
}

/**
 * Runs `callback` once per provisioned tenant, resolving each one's own Durable
 * Object stub by its tenant id the way every other per-tenant caller in this app
 * already does.
 *
 * @param db - The control-plane database.
 * @param tenant - The tenant Durable Object namespace binding.
 * @param callback - The work to run against one tenant's own object.
 * @param options - An abort signal to stop paging early, and how many tenants to
 * read from the control plane per page.
 * @returns How many tenants the callback ran for.
 * @example
 * await forEachProvisionedTenant(ctx.database, env.TENANT, async (stub, tenantId) => {
 * 	await stub.sweepWebhookDeliveries({});
 * });
 */
export async function forEachProvisionedTenant(
	db: Database,
	tenant: DurableObjectNamespace<Tenant>,
	callback: (stub: DurableObjectStub<Tenant>, tenantId: string) => Promise<void>,
	options: ForEachProvisionedTenantOptions = {},
): Promise<ForEachProvisionedTenantResult> {
	let pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
	let cursor: string | null = null;
	let visited = 0;

	while (true) {
		if (options.signal?.aborted) break;

		let page = await TenantModel.listProvisioned(db, { cursor, limit: pageSize });
		if (!page.ok) {
			throw new Error(
				`forEachProvisionedTenant: listProvisioned refused its own cursor (${page.reason})`,
			);
		}

		for (let row of page.tenants) {
			if (options.signal?.aborted) break;

			try {
				await callback(tenant.getByName(row.id), row.id);
				visited++;
			} catch (error) {
				console.error(`forEachProvisionedTenant: tenant ${row.id} failed`, error);
			}
		}

		if (page.cursors.next === null) break;
		cursor = page.cursors.next;
	}

	return { visited };
}
