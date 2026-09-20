/**
 * Asserts the catalog derives one boolean flag per feature slug `PLANS` and
 * `ADDONS` can grant rather than hand-listing it a second time, that the two
 * numeric limits default to Free's own values, and that `buildTenantFlagContext`
 * denies every entitlement for a tenant whose projection has never been written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { ADDONS, PLANS } from "./catalog";
import {
	buildTenantFlagContext,
	entitlementFlagKey,
	entitlementFlags,
	entitlements,
} from "./entitlement-flags";

/** Every feature slug the catalog can grant, the same way `entitlement-flags.ts` derives it. */
function everyFeatureSlug(): string[] {
	let slugs = new Set<string>();

	for (let plan of Object.values(PLANS)) for (let feature of plan.features) slugs.add(feature);
	for (let addon of Object.values(ADDONS)) slugs.add(addon.feature);

	return [...slugs];
}

describe("entitlementFlags", () => {
	test("declares a boolean flag for every feature slug the catalog can grant", () => {
		for (let slug of everyFeatureSlug()) {
			expect(entitlementFlags[slug]).toBeDefined();
			expect(entitlementFlags[slug]?.type).toBe("boolean");
			expect(entitlementFlags[slug]?.defaultValue).toBe(false);
			expect(entitlementFlags[slug]?.key).toBe(entitlementFlagKey(slug));
		}
	});

	test("spells a feature slug's key with dashes rather than underscores", () => {
		expect(entitlementFlagKey("custom_domain")).toBe("entitlement.custom-domain");
		expect(entitlementFlagKey("sso_connections")).toBe("entitlement.sso-connections");
	});

	test("declares no flag for a slug the catalog does not carry", () => {
		expect(entitlementFlags.not_a_real_feature).toBeUndefined();
	});
});

describe("entitlements", () => {
	test("dauCap defaults to Free's cap", () => {
		expect(entitlements.dauCap.type).toBe("number");
		expect(entitlements.dauCap.key).toBe("entitlement.dau-cap");
		expect(entitlements.dauCap.defaultValue).toBe(PLANS.free.dauCap);
	});

	test("auditRetentionDays defaults to Free's retention", () => {
		expect(entitlements.auditRetentionDays.type).toBe("number");
		expect(entitlements.auditRetentionDays.key).toBe("entitlement.audit-retention-days");
		expect(entitlements.auditRetentionDays.defaultValue).toBe(PLANS.free.auditRetentionDays);
	});
});

describe("buildTenantFlagContext", () => {
	let tenant = { id: "ten_123", plan_slug: "pro", subscription_status: "active" };

	test("carries the tenant's own plan facts and entitlement row", () => {
		let context = buildTenantFlagContext(tenant, {
			features: { custom_domain: true, branding: false },
		});

		expect(context).toEqual({
			targetingKey: "ten_123",
			plan: { tier: "pro", status: "active" },
			entitlement: { custom_domain: true, branding: false },
		});
	});

	test("answers an empty entitlement map for a tenant with no projection yet, denying every grant", () => {
		let context = buildTenantFlagContext(tenant, null);

		expect(context.entitlement).toEqual({});
	});
});
