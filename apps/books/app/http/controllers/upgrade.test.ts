/**
 * Tests for `/upgrade` — the path an existing reader takes to the Complete Package. The
 * three outcomes are the point: a reader who owns Essentials gets the upgrade discount,
 * and both a stranger and a customer of something else land on the ordinary checkout,
 * turning every lost upgrade into a sale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MemoryBilling } from "@sdxc/billing/providers/memory";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Discounts, Product } from "~/app/data/product";
import { memoryBilling, purchase } from "~/app/lib/test/billing";
import { fetchApp } from "~/app/lib/test/router";

/** The address every reader under test submits. */
const READER = "reader@example.com";

/** The ordinary checkout an unqualified reader is sent to, address carried along. */
const ORDINARY_CHECKOUT = "/api/checkout/complete?email=reader%40example.com";

/** A platform that also holds the hand-out campaign the upgrade price comes from. */
function withUpgradeDiscount(): MemoryBilling {
	return memoryBilling({
		discounts: [{ id: Discounts.UPGRADE, amount: 5000, products: [Product.Complete] }],
	});
}

/** Submits the upgrade form against a platform. */
function submit(billing: MemoryBilling, email: string) {
	return fetchApp("/upgrade", {
		method: "POST",
		body: new URLSearchParams({ email }),
		billing,
	});
}

describe("GET /upgrade", () => {
	test("renders the form with its heading and submit label", async () => {
		let response = await fetchApp("/upgrade", { billing: memoryBilling() });
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Upgrade to the Complete Package");
		expect(body).toContain("Get Upgrade Link");
	});
});

describe("POST /upgrade", () => {
	test("opens a discounted upgrade checkout for a reader who owns Essentials", async () => {
		let billing = withUpgradeDiscount();
		let order = await purchase(billing, Product.Essentials, READER);

		let response = await submit(billing, READER);
		let location = response.headers.get("location") ?? "";
		let checkout = await unwrap(billing.checkouts.find(location.split("/").at(-1) ?? ""));

		expect(response.status).toBe(303);
		expect(location).toBe(checkout.url);
		expect(checkout.productSlug).toBe(Product.Complete);
		expect(checkout.customerId).toBe(order.customerId);
		expect(checkout.discountId).toBe(Discounts.UPGRADE);
		expect(checkout.providerData.allowDiscountCodes).toBe(false);
	});

	test("sends a customer with no Essentials order to the ordinary checkout", async () => {
		let billing = withUpgradeDiscount();
		await purchase(billing, Product.Complete, READER);

		let response = await submit(billing, READER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(ORDINARY_CHECKOUT);
	});

	test("sends an unknown address to the ordinary checkout", async () => {
		let response = await submit(withUpgradeDiscount(), "stranger@example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"/api/checkout/complete?email=stranger%40example.com",
		);
	});

	test("re-renders the page with the error inline for a malformed address", async () => {
		let response = await submit(memoryBilling(), "not-an-email");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Invalid email address");
		expect(body).toContain("Upgrade to the Complete Package");
	});
});
