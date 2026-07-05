/**
 * Unit tests for the Polar webhook helpers: `normalizeStatus` (which fails closed to
 * `past_due` for unknown Polar statuses) and `entitlesActivation` (the product-match
 * gate that only lets the configured product activate an account's blogs).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, mock, test } from "bun:test";

// The controller module reads `env` at import time; provide a minimal stub so the
// module loads under `bun test` without touching the Workers runtime.
mock.module("cloudflare:workers", () => ({
	env: { POLAR_PRODUCT_ID: "prod_configured", POLAR_WEBHOOK_SECRET: "whsec_test" },
	DurableObject: class {},
}));

let { normalizeStatus, entitlesActivation } = await import("./polar");

describe("normalizeStatus", () => {
	test("passes known Polar statuses through unchanged", () => {
		for (let status of ["active", "trialing", "past_due", "canceled", "unpaid"] as const) {
			expect(normalizeStatus(status)).toBe(status);
		}
	});

	test("fails closed to past_due for an unknown status", () => {
		expect(normalizeStatus("something_new")).toBe("past_due");
	});

	test("fails closed to past_due for an undefined status", () => {
		expect(normalizeStatus(undefined)).toBe("past_due");
	});

	test("does not treat the Polar-only 'incomplete' string as entitling", () => {
		// `incomplete` is not in the mapped set, so it fails closed to past_due.
		expect(normalizeStatus("incomplete")).toBe("past_due");
	});
});

describe("entitlesActivation", () => {
	test("activates when the product matches and the status is active", () => {
		expect(entitlesActivation("prod_configured", "active", "prod_configured")).toBe(true);
	});

	test("activates when the product matches and the status is trialing", () => {
		expect(entitlesActivation("prod_configured", "trialing", "prod_configured")).toBe(true);
	});

	test("never activates when the product does not match, even if active", () => {
		expect(entitlesActivation("prod_other", "active", "prod_configured")).toBe(false);
	});

	test("never activates when the product id is missing", () => {
		expect(entitlesActivation(undefined, "active", "prod_configured")).toBe(false);
	});

	test("does not activate a matching product with a non-entitling status", () => {
		for (let status of ["past_due", "canceled", "unpaid", "incomplete"] as const) {
			expect(entitlesActivation("prod_configured", status, "prod_configured")).toBe(false);
		}
	});
});
