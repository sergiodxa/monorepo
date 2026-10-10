/**
 * Tenant entitlements: the local projection of what a tenant holds, written by a checkout
 * return, a webhook or the reconciliation sweep and read on the request path, so a billing
 * platform outage costs only new checkouts. One row per tenant, keyed on the tenant id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { lt } from "remix/data-table";

import { tenantEntitlements } from "~/database/schema";

/**
 * Entitlement projections. Each write is the platform's full current answer, so `upsert`
 * overwrites a tenant's row wholesale in one statement.
 *
 * @example await models.tenantEntitlements.upsert({ tenant_id, products, features, read_at });
 */
export const TenantEntitlements = createModel(tenantEntitlements, {
	scopes: {
		/** Projections last read before `before`, which the reconciliation sweep refreshes. */
		staleBefore: (query, before: number) => query.where(lt("read_at", before)),
	},
});

/** One tenant entitlement row as the control plane stores it. */
export type TenantEntitlementRow = ModelRow<typeof TenantEntitlements>;

export default TenantEntitlements;
