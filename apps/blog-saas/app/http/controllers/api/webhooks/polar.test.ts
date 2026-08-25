/**
 * Unit tests for the Polar webhook helpers: `normalizeStatus` (fails closed to
 * `past_due` for unknown statuses), `entitlesActivation` (the product-match gate),
 * and `webhookBlogStatus` (suspends blogs immediately on any non-entitling status).
 * The controller module reads `env` at import time, so `cloudflare:workers` is
 * mocked with `vi.doMock` before the dynamic import below.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createEnv } from "@pkg/cloudflare-mocks";
import { describe, expect, test, vi } from "vitest";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		POLAR_PRODUCT_ID: "prod_configured",
		POLAR_WEBHOOK_SECRET: "whsec_test",
	}),
	DurableObject: class {},
}));

let { normalizeStatus, entitlesActivation, webhookBlogStatus } = await import("./polar");

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

describe("webhookBlogStatus", () => {
	test("returns active for the configured product with an entitling status", () => {
		expect(webhookBlogStatus("prod_configured", "active", "prod_configured")).toBe("active");
		expect(webhookBlogStatus("prod_configured", "trialing", "prod_configured")).toBe("active");
	});

	test("suspends when a matching product moves to a non-entitling status on update", () => {
		for (let status of ["past_due", "unpaid", "canceled", "incomplete"] as const) {
			expect(webhookBlogStatus("prod_configured", status, "prod_configured")).toBe("suspended");
		}
	});

	test("suspends when the event references a different product, even if active", () => {
		expect(webhookBlogStatus("prod_other", "active", "prod_configured")).toBe("suspended");
	});

	test("suspends when the product id is missing", () => {
		expect(webhookBlogStatus(undefined, "active", "prod_configured")).toBe("suspended");
	});
});
