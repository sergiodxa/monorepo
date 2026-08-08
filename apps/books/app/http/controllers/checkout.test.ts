/**
 * Tests for `GET /api/checkout/:type` — the published, shareable link that turns a
 * pricing-page click into a Polar checkout. Covers both packages, the `?email=`
 * pass-through, the discount application, and the refusal to bill for an unrecognized
 * package name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { PolarClient } from "@pkg/polar";

import { Discounts, Product } from "~/app/data/product";
import { FakePolarClient, makeDiscount } from "~/app/lib/test/polar";
import { fetchApp } from "~/app/lib/test/router";

/** The hosted checkout URL the fake answers with, which is where the visitor must land. */
const CHECKOUT_URL = "https://polar.test/checkout/abc";

/** Requests a checkout against a scripted billing client. */
function start(polar: FakePolarClient, path: string) {
	return fetchApp(path, { services: [[PolarClient, polar]] });
}

/** A launch campaign that qualifies, so the Complete checkout has a discount to apply. */
function activeCampaign() {
	return makeDiscount({ id: Discounts.FIRST_WEEK, products: [Product.Complete] });
}

describe("GET /api/checkout/:type", () => {
	test("redirects to a full-price Essentials checkout with discount codes allowed", async () => {
		let polar = new FakePolarClient({ checkoutUrl: CHECKOUT_URL });

		let response = await start(polar, "/api/checkout/essentials");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(CHECKOUT_URL);
		expect(polar.checkouts).toEqual([
			{
				productId: Product.Essentials,
				customerEmail: undefined,
				allowDiscountCodes: true,
			},
		]);
	});

	test("passes ?email= through to the Essentials checkout", async () => {
		let polar = new FakePolarClient({ checkoutUrl: CHECKOUT_URL });

		await start(polar, "/api/checkout/essentials?email=reader%40example.com");

		expect(polar.checkouts[0]?.customerEmail).toBe("reader@example.com");
	});

	test("redirects to a Complete checkout with the applicable discount and no codes", async () => {
		let polar = new FakePolarClient({
			checkoutUrl: CHECKOUT_URL,
			discounts: [activeCampaign()],
		});

		let response = await start(polar, "/api/checkout/complete?email=reader%40example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(CHECKOUT_URL);
		expect(polar.checkouts).toEqual([
			{
				productId: Product.Complete,
				customerEmail: "reader@example.com",
				discountId: Discounts.FIRST_WEEK,
				allowDiscountCodes: false,
			},
		]);
	});

	test("still checks out at full price when no campaign applies", async () => {
		let polar = new FakePolarClient({ checkoutUrl: CHECKOUT_URL, discounts: [] });

		let response = await start(polar, "/api/checkout/complete");

		expect(response.status).toBe(303);
		expect(polar.checkouts[0]?.discountId).toBeUndefined();
	});

	test("404s an unrecognized package name without creating a checkout", async () => {
		let polar = new FakePolarClient({ checkoutUrl: CHECKOUT_URL, discounts: [activeCampaign()] });

		let response = await start(polar, "/api/checkout/everything");

		expect(response.status).toBe(404);
		expect(polar.checkouts).toEqual([]);
	});

	test("creates no checkout for a HEAD probe of an unrecognized package name", async () => {
		let polar = new FakePolarClient({ checkoutUrl: CHECKOUT_URL, discounts: [activeCampaign()] });

		let response = await fetchApp("/api/checkout/everything", {
			method: "HEAD",
			services: [[PolarClient, polar]],
		});

		expect(response.status).toBe(404);
		expect(polar.checkouts).toEqual([]);
	});

	test("drops a malformed ?email= rather than forwarding it to the provider", async () => {
		let polar = new FakePolarClient({ checkoutUrl: CHECKOUT_URL });

		let response = await start(polar, "/api/checkout/essentials?email=not-an-email");

		expect(response.status).toBe(303);
		expect(polar.checkouts[0]?.customerEmail).toBeUndefined();
	});
});
