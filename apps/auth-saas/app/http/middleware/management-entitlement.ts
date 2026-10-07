/**
 * Gates a management route on one paid feature its tenant holds right now, read from
 * the tenant's `tenant_entitlements` projection through the entitlement flag catalog.
 * A lapsed subscription grants nothing there, so the paid write lapses with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementSnapshot } from "@sdxc/billing/middleware";
import type { Middleware, RequestContext } from "remix/router";

import billing, { requireEntitlement } from "@sdxc/billing/middleware";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { NoopProvider } from "@sdxc/flags/provider/noop";

import { EntitlementProvider } from "~/app/lib/entitlement-provider";
import Tenant from "~/app/models/tenant";
import TenantEntitlement from "~/app/models/tenant-entitlement";
import { buildTenantFlagContext, entitlementFlags } from "~/app/services/billing/entitlement-flags";

/**
 * The entitlement namespace evaluated straight over the context a caller hands it,
 * so every `entitlement.*` answer comes from the tenant's own projection.
 */
const ENTITLEMENT_PROVIDER = new EntitlementProvider(new NoopProvider());

/** Satisfies `billing()`'s required provider; the gate reads entitlements and calls no billing operation. */
const NOOP_BILLING_PROVIDER = new MemoryBilling();

/**
 * Resolves whether the caller's tenant holds `feature`, as the snapshot
 * `requireEntitlement` checks. A slug the catalog never sells is never held.
 *
 * @param ctx - The request context `managementAuth` has already resolved a caller onto.
 * @param feature - The catalog feature slug the route is sold as.
 * @returns The snapshot, or `null` for a tenant no longer on the control plane.
 */
async function resolveFeature(
	ctx: RequestContext,
	feature: string,
): Promise<EntitlementSnapshot | null> {
	let tenant = await Tenant.findById(ctx.db, ctx.managementCaller.tenantId);
	if (!tenant) return null;

	let entitlement = await TenantEntitlement.findByTenant(ctx.db, tenant.id);

	let flag = entitlementFlags[feature];
	let entitled = false;
	if (flag) {
		let context = buildTenantFlagContext(tenant, entitlement);
		let resolution = await ENTITLEMENT_PROVIDER.resolveBoolean(
			flag.key,
			flag.defaultValue,
			context,
		);
		entitled = resolution.value;
	}

	return { products: entitlement?.products ?? [], features: { [feature]: entitled } };
}

/**
 * Builds the gate, mounted after `managementAuth` so the caller's tenant is resolved.
 *
 * @param feature - The catalog feature slug the route is sold as.
 * @param onDenied - The refusal answered to a tenant that does not hold it.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * middleware: [...mountedMiddleware(options, "write"), ...managementEntitlement("custom_domain", customDomainNotAllowed)]
 */
export function managementEntitlement(feature: string, onDenied: () => Response): Middleware[] {
	return [
		billing({
			provider: NOOP_BILLING_PROVIDER,
			entitlements: (ctx) => resolveFeature(ctx, feature),
		}) as Middleware,
		requireEntitlement(feature, { onDenied }) as Middleware,
	];
}
