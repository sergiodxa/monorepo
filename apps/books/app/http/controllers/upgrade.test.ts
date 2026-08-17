/**
 * Tests for `/upgrade` — the path an existing reader takes to the Complete Package. The
 * three outcomes are the point: a reader who owns Essentials gets the upgrade discount,
 * and both "not a customer" and "customer of something else" fall back to the ordinary
 * checkout rather than dead-ending, because a lost upgrade should still be a sale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarClient } from "@pkg/polar";
import { describe, expect, test } from "vitest";

import { Discounts, Product } from "~/app/data/product";
import { FakePolarClient, makeCustomer, makeOrder } from "~/app/lib/test/polar";
import { fetchApp } from "~/app/lib/test/router";

/** The hosted checkout URL the fake answers with. */
const CHECKOUT_URL = "https://polar.test/checkout/upgrade";

/** Submits the upgrade form against a scripted billing client. */
function submit(polar: FakePolarClient, email: string) {
	return fetchApp("/upgrade", {
		method: "POST",
		body: new URLSearchParams({ email }),
		services: [[PolarClient, polar]],
	});
}

describe("GET /upgrade", () => {
	test("renders the form with its heading and submit label", async () => {
		let response = await fetchApp("/upgrade");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Upgrade to the Complete Package");
		expect(body).toContain("Get Upgrade Link");
	});
});

describe("POST /upgrade", () => {
	test("creates a discounted upgrade checkout for a reader who owns Essentials", async () => {
		let polar = new FakePolarClient({
			checkoutUrl: CHECKOUT_URL,
			customers: { "reader@example.com": makeCustomer("cus_1", "reader@example.com") },
			orders: [makeOrder(Product.Essentials)],
		});

		let response = await submit(polar, "reader@example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(CHECKOUT_URL);
		expect(polar.checkouts).toEqual([
			{
				productId: Product.Complete,
				customerId: "cus_1",
				discountId: Discounts.UPGRADE,
				allowDiscountCodes: false,
			},
		]);
		// The order lookup has to be scoped to Essentials, or any past purchase would do.
		expect(polar.orderQueries).toEqual([{ customerId: "cus_1", productId: Product.Essentials }]);
	});

	test("sends a customer with no Essentials order to the ordinary checkout", async () => {
		let polar = new FakePolarClient({
			customers: { "reader@example.com": makeCustomer("cus_1", "reader@example.com") },
			orders: [makeOrder(Product.Complete)],
		});

		let response = await submit(polar, "reader@example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"/api/checkout/complete?email=reader%40example.com",
		);
		expect(polar.checkouts).toEqual([]);
	});

	test("sends an unknown address to the ordinary checkout", async () => {
		let polar = new FakePolarClient();

		let response = await submit(polar, "stranger@example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"/api/checkout/complete?email=stranger%40example.com",
		);
		expect(polar.checkouts).toEqual([]);
	});

	test("re-renders the page with the error inline for a malformed address", async () => {
		let polar = new FakePolarClient();

		let response = await submit(polar, "not-an-email");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Invalid email address");
		// The page itself comes back, not a bare JSON error.
		expect(body).toContain("Upgrade to the Complete Package");
	});
});
