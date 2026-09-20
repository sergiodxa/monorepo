/**
 * Asserts `PLANS` and `ADDONS` carry the caps, retention and feature slugs
 * the catalog sells, and that `buildProductMap` and `buildFeatureMap` narrow a
 * raw id map to exactly those slugs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { ADDONS, PLANS, buildFeatureMap, buildProductMap } from "./catalog";

describe("PLANS", () => {
	test("free carries none of the paid-tier features", () => {
		expect(PLANS.free.features).toEqual([]);
	});

	test("pro carries custom_domain, session_policy and unbranded_pages", () => {
		expect(PLANS.pro.features).toEqual(["custom_domain", "session_policy", "unbranded_pages"]);
	});

	test("premium carries pro's features plus branding", () => {
		expect(PLANS.premium.features).toEqual([
			"custom_domain",
			"session_policy",
			"unbranded_pages",
			"branding",
		]);
	});

	test("caps and retention match the ADR's table", () => {
		expect(PLANS.free).toMatchObject({ dauCap: 100, auditRetentionDays: 7 });
		expect(PLANS.pro).toMatchObject({ dauCap: 2500, auditRetentionDays: 30 });
		expect(PLANS.premium).toMatchObject({ dauCap: 10000, auditRetentionDays: 90 });
	});

	test("prices match the ADR's table, in whole cents", () => {
		expect(PLANS.free.price).toEqual({ amount: 0, currency: "usd" });
		expect(PLANS.pro.price).toEqual({ amount: 2900, currency: "usd" });
		expect(PLANS.premium.price).toEqual({ amount: 9900, currency: "usd" });
	});
});

describe("ADDONS", () => {
	test("carries exactly the eight add-ons the ADR names", () => {
		expect(Object.keys(ADDONS).sort()).toEqual(
			[
				"audit_streaming",
				"custom_roles",
				"device_grant",
				"machine_access",
				"organizations",
				"outbound_webhooks",
				"scim",
				"sso_connections",
			].sort(),
		);
	});

	test("every add-on's feature slug matches its own key", () => {
		for (let [slug, addon] of Object.entries(ADDONS)) expect(addon.feature).toBe(slug);
	});

	test("prices match the ADR's table, in whole cents", () => {
		expect(ADDONS.sso_connections.price).toEqual({ amount: 4900, currency: "usd" });
		expect(ADDONS.scim.price).toEqual({ amount: 2900, currency: "usd" });
		expect(ADDONS.organizations.price).toEqual({ amount: 2900, currency: "usd" });
		expect(ADDONS.custom_roles.price).toEqual({ amount: 1900, currency: "usd" });
		expect(ADDONS.outbound_webhooks.price).toEqual({ amount: 1900, currency: "usd" });
		expect(ADDONS.machine_access.price).toEqual({ amount: 2900, currency: "usd" });
		expect(ADDONS.device_grant.price).toEqual({ amount: 900, currency: "usd" });
		expect(ADDONS.audit_streaming.price).toEqual({ amount: 2900, currency: "usd" });
	});
});

describe("buildProductMap", () => {
	test("keeps only the slugs a configured id names", () => {
		expect(buildProductMap({ pro: "prod_pro", not_a_slug: "prod_x" })).toEqual({ pro: "prod_pro" });
	});

	test("answers an empty map when nothing is configured", () => {
		expect(buildProductMap({})).toEqual({});
	});

	test("covers every plan and add-on slug when every id is configured", () => {
		let slugs = [...Object.keys(PLANS), ...Object.keys(ADDONS)];
		let ids = Object.fromEntries(slugs.map((slug) => [slug, `id_${slug}`]));

		expect(Object.keys(buildProductMap(ids)).sort()).toEqual([...slugs].sort());
	});
});

describe("buildFeatureMap", () => {
	test("keeps only the feature slugs a configured id names", () => {
		expect(buildFeatureMap({ custom_domain: "ben_1", not_a_feature: "ben_2" })).toEqual({
			custom_domain: "ben_1",
		});
	});

	test("covers every plan feature and every add-on's feature when every id is configured", () => {
		let slugs = [
			"custom_domain",
			"session_policy",
			"unbranded_pages",
			"branding",
			...Object.keys(ADDONS),
		];
		let ids = Object.fromEntries(slugs.map((slug) => [slug, `ben_${slug}`]));

		expect(Object.keys(buildFeatureMap(ids)).sort()).toEqual([...new Set(slugs)].sort());
	});
});
