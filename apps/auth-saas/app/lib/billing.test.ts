/**
 * Exercises `parseIdMap`'s defensive JSON parsing and confirms the module-scope
 * `polar` provider still constructs from a fully configured environment.
 * `cloudflare:workers` is mocked with the three Polar id-map secrets before the
 * module under test is imported, because that module captures `env` at load
 * time, the way `session-cookie.test.ts` mocks `SESSION_SECRET` for the same
 * reason.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { describe, expect, test, vi } from "vitest";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		POLAR_ACCESS_TOKEN: "test-access-token",
		POLAR_WEBHOOK_SECRET: "test-webhook-secret",
		POLAR_PRODUCT_IDS: JSON.stringify({ pro: "prod_pro" }),
		POLAR_FEATURE_IDS: JSON.stringify({ custom_domain: "ben_custom_domain" }),
		POLAR_METER_IDS: JSON.stringify({ "auth.dau": "meter_dau" }),
	}),
}));

let { parseIdMap, polar } = await import("./billing");

describe("parseIdMap", () => {
	test("parses a JSON object of strings", () => {
		expect(parseIdMap('{"pro":"prod_pro","premium":"prod_premium"}')).toEqual({
			pro: "prod_pro",
			premium: "prod_premium",
		});
	});

	test("answers {} for an undefined secret", () => {
		expect(parseIdMap(undefined)).toEqual({});
	});

	test("answers {} for an empty string", () => {
		expect(parseIdMap("")).toEqual({});
	});

	test("answers {} for malformed JSON rather than throwing", () => {
		expect(parseIdMap("{not valid json")).toEqual({});
	});

	test("answers {} for a JSON array or a JSON primitive", () => {
		expect(parseIdMap("[1,2,3]")).toEqual({});
		expect(parseIdMap("42")).toEqual({});
		expect(parseIdMap("null")).toEqual({});
	});

	test("drops a non-string value rather than passing it through", () => {
		expect(parseIdMap('{"pro":42,"premium":"prod_premium"}')).toEqual({ premium: "prod_premium" });
	});
});

describe("polar", () => {
	test("constructs from a fully configured environment", () => {
		expect(polar.connection).toBe("polar");
	});
});
