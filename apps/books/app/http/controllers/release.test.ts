/**
 * Tests for `GET /release` — the sales page. The three things that cost money if they break
 * are the point: prices derived from the platform's cents, the parity-pricing script's
 * polarity, and the page still rendering when the campaign lookup fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@pkg/billing";
import type { MemoryDiscountSeed } from "@pkg/billing/providers/memory";

import { describe, expect, test } from "vitest";

import { Discounts, Product } from "~/app/data/product";
import { memoryBilling, withUnreadableDiscounts } from "~/app/lib/test/billing";
import { fetchApp } from "~/app/lib/test/router";

/** What every campaign under test takes off the Complete package, in cents. */
const CAMPAIGN_CENTS = 3000;

/** A campaign scoped to Complete, running now, taking $30 off. */
function campaign(id: Discounts): MemoryDiscountSeed {
	return { id, amount: CAMPAIGN_CENTS, products: [Product.Complete] };
}

function load(billing: Billing) {
	return fetchApp("/release", { billing });
}

describe("GET /release", () => {
	test("renders both prices as dollars, not as the cents the platform reports", async () => {
		let response = await load(memoryBilling());
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("$99");
		expect(body).toContain("$49");
		expect(body).not.toContain("$9,900");
		expect(body).not.toContain("$4,900");
	});

	test("strikes the list price through and shows the campaign price for the discounted package", async () => {
		let billing = memoryBilling({ discounts: [campaign(Discounts.FIRST_WEEK)] });

		let body = await load(billing).then((response) => response.text());

		expect(body).toContain("<s>$99</s>");
		expect(body).toContain("$69");
		expect(body).not.toContain("<s>$49</s>");
	});

	test("renders every section anchor the page's own links point at", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		for (let id of ["hero", "description", "sample", "pricing", "author", "faq"]) {
			expect(body).toContain(`id="${id}"`);
		}
	});

	test("links both checkouts, the upgrade page, and the sample form", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		expect(body).toContain('href="/api/checkout/complete"');
		expect(body).toContain('href="/api/checkout/essentials"');
		expect(body).toContain('href="/upgrade"');
		expect(body).toContain('action="/sample"');
	});

	test("loads the parity-pricing script when no early-access campaign is running", async () => {
		let billing = memoryBilling({ discounts: [campaign(Discounts.SECOND_WEEK)] });

		let body = await load(billing).then((response) => response.text());

		expect(body).toContain("cdn.paritydeals.com");
	});

	test("withholds the parity-pricing script while the early-access campaign is running", async () => {
		let billing = memoryBilling({ discounts: [campaign(Discounts.EARLY)] });

		let body = await load(billing).then((response) => response.text());

		expect(body).not.toContain("cdn.paritydeals.com");
	});

	test("still renders when the campaign lookup fails", async () => {
		let response = await load(withUnreadableDiscounts(memoryBilling()));
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("$99");
		expect(body).toContain("$49");
		expect(body).not.toContain("<s>$99</s>");
	});

	test("answers 503 rather than quoting a price it could not read", async () => {
		let response = await load(memoryBilling({ catalog: {} }));

		expect(response.status).toBe(503);
	});

	test("describes the book once, with an offer per package", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		expect(body).toContain('"@type":"Book"');
		expect(body).toContain('"price":"99"');
		expect(body).toContain('"price":"49"');
		expect(body.match(/"@type":"Book"/g)).toHaveLength(1);
	});

	test("loads no first-party JavaScript", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		expect(body).not.toContain("clientEntry");
	});
});
