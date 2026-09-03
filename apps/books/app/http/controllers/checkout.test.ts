/**
 * Tests for `GET /api/checkout/:type` — the published, shareable link that turns a
 * pricing-page click into a hosted checkout. Covers both packages, the `?email=`
 * pass-through, the discount application, and the refusal to bill for an unrecognized
 * package name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Checkout } from "@pkg/billing";
import type { MemoryBilling } from "@pkg/billing/providers/memory";

import { isFailure, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { Discounts, Product } from "~/app/data/product";
import { COMPLETE_CENTS, ESSENTIALS_CENTS, memoryBilling } from "~/app/lib/test/billing";
import { fetchApp } from "~/app/lib/test/router";

/** What a launch campaign takes off the Complete package, in cents. */
const CAMPAIGN_CENTS = 3000;

/** The id the platform issues its first checkout under, which is the only one a test opens. */
const FIRST_CHECKOUT = "chk_1";

/** A launch campaign that qualifies, so the Complete checkout has a discount to apply. */
function activeCampaign() {
	return { id: Discounts.FIRST_WEEK, amount: CAMPAIGN_CENTS, products: [Product.Complete] };
}

function start(billing: MemoryBilling, path: string) {
	return fetchApp(path, { billing });
}

/**
 * Reads back the session the redirect points at, so a test asserts on what the
 * platform recorded rather than on the arguments a call was made with.
 *
 * @param billing - The platform the checkout was opened on.
 * @param response - The redirect the controller answered with.
 * @returns The session as the platform holds it.
 */
async function openedCheckout(billing: MemoryBilling, response: Response): Promise<Checkout> {
	let location = response.headers.get("location") ?? "";
	return await unwrap(billing.checkouts.find(location.split("/").at(-1) ?? ""));
}

describe("GET /api/checkout/:type", () => {
	test("redirects to a full-price Essentials checkout", async () => {
		let billing = memoryBilling();

		let response = await start(billing, "/api/checkout/essentials");
		let checkout = await openedCheckout(billing, response);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(checkout.url);
		expect(checkout.productSlug).toBe(Product.Essentials);
		expect(checkout.discountId).toBeNull();
		expect(checkout.amount).toEqual({ amount: ESSENTIALS_CENTS, currency: "usd" });
	});

	test("passes ?email= through to the Essentials checkout", async () => {
		let billing = memoryBilling();

		let response = await start(billing, "/api/checkout/essentials?email=reader%40example.com");
		let checkout = await openedCheckout(billing, response);

		expect(checkout.providerData.email).toBe("reader@example.com");
	});

	test("redirects to a Complete checkout carrying the applicable discount", async () => {
		let billing = memoryBilling({ discounts: [activeCampaign()] });

		let response = await start(billing, "/api/checkout/complete?email=reader%40example.com");
		let checkout = await openedCheckout(billing, response);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(checkout.url);
		expect(checkout.productSlug).toBe(Product.Complete);
		expect(checkout.discountId).toBe(Discounts.FIRST_WEEK);
		expect(checkout.amount).toEqual({
			amount: COMPLETE_CENTS - CAMPAIGN_CENTS,
			currency: "usd",
		});
	});

	test("opens the Complete checkout with the code field closed", async () => {
		let billing = memoryBilling({ discounts: [activeCampaign()] });

		let response = await start(billing, "/api/checkout/complete");
		let checkout = await openedCheckout(billing, response);

		expect(checkout.providerData.allowDiscountCodes).toBe(false);
	});

	test("leaves the code field open on an Essentials checkout, which carries no campaign", async () => {
		let billing = memoryBilling();

		let response = await start(billing, "/api/checkout/essentials");
		let checkout = await openedCheckout(billing, response);

		expect(checkout.providerData.allowDiscountCodes).toBe(true);
	});

	test("still checks out at full price when no campaign applies", async () => {
		let billing = memoryBilling();

		let response = await start(billing, "/api/checkout/complete");
		let checkout = await openedCheckout(billing, response);

		expect(response.status).toBe(303);
		expect(checkout.discountId).toBeNull();
		expect(checkout.amount).toEqual({ amount: COMPLETE_CENTS, currency: "usd" });
	});

	test("404s an unrecognized package name without opening a checkout", async () => {
		let billing = memoryBilling({ discounts: [activeCampaign()] });

		let response = await start(billing, "/api/checkout/everything");

		expect(response.status).toBe(404);
		expect(isFailure(await billing.checkouts.find(FIRST_CHECKOUT))).toBe(true);
	});

	test("opens no checkout for a HEAD probe of an unrecognized package name", async () => {
		let billing = memoryBilling({ discounts: [activeCampaign()] });

		let response = await fetchApp("/api/checkout/everything", { method: "HEAD", billing });

		expect(response.status).toBe(404);
		expect(isFailure(await billing.checkouts.find(FIRST_CHECKOUT))).toBe(true);
	});

	test("drops a malformed ?email= rather than forwarding it to the platform", async () => {
		let billing = memoryBilling();

		let response = await start(billing, "/api/checkout/essentials?email=not-an-email");
		let checkout = await openedCheckout(billing, response);

		expect(response.status).toBe(303);
		expect(checkout.providerData.email).toBeNull();
	});
});
