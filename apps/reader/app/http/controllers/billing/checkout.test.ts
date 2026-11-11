/**
 * Tests `GET /billing/checkout/:plan`: a working session hands the reader to Polar, and a
 * platform failure returns them to Settings with a note rather than a silent bounce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BillingError } from "@sdxc/billing";
import { failure, success } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import { BILLING_PARAM } from "~/app/http/controllers/billing/outcome";
import { createTestRouter, fetchRoute, VIEWER } from "~/app/test/controller";
import routes from "~/routes/web";

let findBillingCustomer = vi.fn();
let linkBillingCustomer = vi.fn();
let findCustomer = vi.fn();
let createCustomer = vi.fn();
let findByEmail = vi.fn();
let updateCustomer = vi.fn();
let createCheckout = vi.fn();

vi.doMock("~/app/models/registry", () => ({
	findBillingCustomer: (...args: unknown[]) => findBillingCustomer(...args),
	linkBillingCustomer: (...args: unknown[]) => linkBillingCustomer(...args),
}));

vi.doMock("~/app/initializers/billing", () => ({
	CONNECTION: "polar",
	failureFields: () => ({}),
	polar: {
		customers: {
			find: (...args: unknown[]) => findCustomer(...args),
			create: (...args: unknown[]) => createCustomer(...args),
			findByEmail: (...args: unknown[]) => findByEmail(...args),
			update: (...args: unknown[]) => updateCustomer(...args),
		},
		checkouts: { create: (...args: unknown[]) => createCheckout(...args) },
	},
}));

let { default: checkout } = await import("./checkout");

/** A router with the checkout controller mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): AppRouter {
	let router = createTestRouter(viewer);
	router.map(routes.billing.checkout, checkout);
	return router;
}

beforeEach(() => {
	findBillingCustomer.mockReset();
	linkBillingCustomer.mockReset();
	findCustomer.mockReset();
	createCustomer.mockReset();
	findByEmail.mockReset();
	updateCustomer.mockReset();
	createCheckout.mockReset();
});

describe("GET /billing/checkout/:plan", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await fetchRoute(
			createRouter(null),
			routes.billing.checkout.href({ plan: "paid" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(createCheckout).not.toHaveBeenCalled();
	});

	test("hands a reader to the hosted checkout when Polar opens one", async () => {
		findBillingCustomer.mockResolvedValue({
			provider_customer_id: "cus_existing",
		});
		createCheckout.mockResolvedValue(
			success({ id: "chk_1", url: "https://polar.sh/checkout/polar_c_test" }),
		);

		let response = await fetchRoute(
			createRouter(VIEWER),
			routes.billing.checkout.href({ plan: "paid" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("https://polar.sh/checkout/polar_c_test");
		expect(createCheckout).toHaveBeenCalledOnce();
	});

	/**
	 * A reader the platform already knows under their subject must open checkout even when
	 * the catalog never recorded the link — creating again is a conflict that used to look
	 * like a dead button.
	 */
	test("adopts a Polar customer already keyed on the reader's subject", async () => {
		findBillingCustomer.mockResolvedValue(null);
		findCustomer.mockResolvedValue(success({ id: "cus_polar" }));
		createCheckout.mockResolvedValue(
			success({ id: "chk_1", url: "https://polar.sh/checkout/polar_c_adopted" }),
		);

		let response = await fetchRoute(
			createRouter(VIEWER),
			routes.billing.checkout.href({ plan: "premium" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("https://polar.sh/checkout/polar_c_adopted");
		expect(linkBillingCustomer).toHaveBeenCalledWith(VIEWER.id, "polar", "cus_polar");
		expect(createCustomer).not.toHaveBeenCalled();
		expect(createCheckout).toHaveBeenCalledWith(
			expect.objectContaining({ customer: { id: "cus_polar" } }),
		);
	});

	test("returns to Settings with a note when Polar refuses the checkout", async () => {
		findBillingCustomer.mockResolvedValue({
			provider_customer_id: "cus_existing",
		});
		createCheckout.mockResolvedValue(failure(new Error("polar refused")));

		let response = await fetchRoute(
			createRouter(VIEWER),
			routes.billing.checkout.href({ plan: "premium" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${routes.settings.href()}?${BILLING_PARAM}=failed`,
		);
	});

	test("returns to Settings with a note when no customer can be created", async () => {
		findBillingCustomer.mockResolvedValue(null);
		findCustomer.mockResolvedValue(
			failure(new BillingError("missing", { code: "not_found", connection: "polar" })),
		);
		createCustomer.mockResolvedValue(
			failure(new BillingError("token missing", { code: "unauthenticated", connection: "polar" })),
		);

		let response = await fetchRoute(
			createRouter(VIEWER),
			routes.billing.checkout.href({ plan: "paid" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${routes.settings.href()}?${BILLING_PARAM}=failed`,
		);
		expect(createCheckout).not.toHaveBeenCalled();
	});
});
