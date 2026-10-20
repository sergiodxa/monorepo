/**
 * The entitlement flag catalog: one boolean handle per feature slug `PLANS` or
 * `ADDONS` can grant, plus the two numeric limits a plan carries, derived from the
 * catalog rather than hand-listed a second time here — so a feature slug added to
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext, Flag } from "@sdxc/flags";

import { defineFlags, flag } from "@sdxc/flags/catalog";

import type { TenantEntitlementRow } from "~/app/models/tenant-entitlements";
import type { TenantRow } from "~/app/models/tenants";

import { ADDONS, PLANS } from "./catalog";

/** Every feature slug a held plan or add-on can grant, deduplicated. */
function featureSlugs(): readonly string[] {
	let slugs = new Set<string>();

	for (let plan of Object.values(PLANS)) for (let feature of plan.features) slugs.add(feature);
	for (let addon of Object.values(ADDONS)) slugs.add(addon.feature);

	return [...slugs];
}

/** Turns a catalog feature slug (underscores) into the flag key it is served under (dashes). */
export function entitlementFlagKey(slug: string): string {
	return `entitlement.${slug.replace(/_/g, "-")}`;
}

/**
 * One denying boolean handle per feature slug the catalog can grant, keyed
 * by that same slug — so a slug added to a plan or an add-on gets a flag
 * here with no second edit.
 *
 * @example let customDomain = await ctx.flags.get(entitlementFlags.custom_domain);
 */
export const entitlementFlags: Readonly<Record<string, Flag<boolean>>> = Object.fromEntries(
	featureSlugs().map((slug) => [slug, flag.boolean(entitlementFlagKey(slug), false)]),
);

/**
 * The two numeric limits a plan carries, both defaulting to Free's own
 * value, so a call site reaches for a name rather than a raw key.
 *
 * @example let dauCap = await ctx.flags.get(entitlements.dauCap);
 */
export const entitlements = defineFlags({
	dauCap: flag.number(entitlementFlagKey("dau-cap"), PLANS.free.dauCap),
	auditRetentionDays: flag.number(
		entitlementFlagKey("audit-retention-days"),
		PLANS.free.auditRetentionDays,
	),
});

/**
 * Builds the context `EntitlementProvider` reads for one tenant: its plan facts,
 * and the entitlement projection resolved beside it.
 *
 * @param tenant - The tenant a request has already resolved.
 * @param entitlement - The tenant's entitlement projection, or null when none has been written yet.
 * @returns The context every entitlement flag on this tenant resolves against.
 */
export function buildTenantFlagContext(
	tenant: Pick<TenantRow, "id" | "plan_slug" | "subscription_status">,
	entitlement: Pick<TenantEntitlementRow, "features"> | null,
): EvaluationContext {
	return {
		targetingKey: tenant.id,
		plan: { tier: tenant.plan_slug, status: tenant.subscription_status },
		entitlement: entitlement?.features ?? {},
	};
}
