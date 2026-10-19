/**
 * The paid features one tenant holds right now, read from its `tenant_entitlements`
 * projection through the entitlement flag catalog, as the `billing` fact the management
 * policy's guards read. A lapsed subscription grants nothing there, so the paid write lapses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NoopProvider } from "@sdxc/flags/provider/noop";

import type { Models } from "~/app/models";

import { buildTenantFlagContext, entitlementFlags } from "~/app/services/billing/entitlement-flags";
import { EntitlementProvider } from "~/app/services/entitlement-provider";

/**
 * The entitlement namespace evaluated straight over the context a caller hands it,
 * so every `entitlement.*` answer comes from the tenant's own projection.
 */
const ENTITLEMENT_PROVIDER = new EntitlementProvider(new NoopProvider());

/**
 * Lists the catalog features `tenantId` is entitled to. A tenant no longer on the control
 * plane holds none, so every paid ability refuses for it.
 *
 * @param models - The control-plane models.
 * @param tenantId - The tenant the request is scoped to.
 * @returns The `billing` fact: every feature slug whose entitlement flag answers `true`.
 * @example
 * let billing = await tenantFeatures(ctx.models, ctx.managementCaller.tenantId);
 */
export async function tenantFeatures(
	models: Models,
	tenantId: string,
): Promise<{ features: string[] }> {
	let tenant = await models.tenants.find(tenantId);
	if (!tenant) return { features: [] };

	let entitlement = await models.tenantEntitlements.find(tenant.id);
	let context = buildTenantFlagContext(tenant, entitlement);

	let held = await Promise.all(
		Object.entries(entitlementFlags).map(async ([feature, flag]) => {
			let resolution = await ENTITLEMENT_PROVIDER.resolveBoolean(
				flag.key,
				flag.defaultValue,
				context,
			);
			return resolution.value ? feature : null;
		}),
	);

	return { features: held.filter((feature): feature is string => feature !== null) };
}
