/**
 * Tests `GET /billing/portal`: a linked customer is handed to Polar's portal, and a
 * missing link or platform failure returns them to Settings with a note.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, success } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import { BILLING_PARAM } from "~/app/http/controllers/billing/outcome";
import { createTestRouter, fetchRoute, VIEWER } from "~/app/test/controller";
import routes from "~/routes/web";

let findBillingCustomer = vi.fn();
let createPortal = vi.fn();

vi.doMock("~/app/models/registry", () => ({
	findBillingCustomer: (...args: unknown[]) => findBillingCustomer(...args),
}));

vi.doMock("~/app/initializers/billing", () => ({
	CONNECTION: "polar",
	failureFields: () => ({}),
	polar: {
		portal: { create: (...args: unknown[]) => createPortal(...args) },
	},
}));

let { default: portal } = await import("./portal");

/** A router with the portal controller mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): AppRouter {
	let router = createTestRouter(viewer);
	router.map(routes.billing.portal, portal);
	return router;
}

beforeEach(() => {
	findBillingCustomer.mockReset();
	createPortal.mockReset();
});

describe("GET /billing/portal", () => {
	test("returns to Settings when the reader has never bought anything", async () => {
		findBillingCustomer.mockResolvedValue(null);

		let response = await fetchRoute(createRouter(VIEWER), routes.billing.portal.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${routes.settings.href()}?${BILLING_PARAM}=failed`,
		);
		expect(createPortal).not.toHaveBeenCalled();
	});

	test("hands a linked customer to the hosted portal", async () => {
		findBillingCustomer.mockResolvedValue({
			provider_customer_id: "cus_existing",
		});
		createPortal.mockResolvedValue(success({ url: "https://polar.sh/portal/test" }));

		let response = await fetchRoute(createRouter(VIEWER), routes.billing.portal.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("https://polar.sh/portal/test");
	});

	test("returns to Settings with a note when Polar refuses the portal", async () => {
		findBillingCustomer.mockResolvedValue({
			provider_customer_id: "cus_existing",
		});
		createPortal.mockResolvedValue(failure(new Error("polar refused")));

		let response = await fetchRoute(createRouter(VIEWER), routes.billing.portal.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${routes.settings.href()}?${BILLING_PARAM}=failed`,
		);
	});
});
