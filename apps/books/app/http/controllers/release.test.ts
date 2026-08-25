/**
 * Tests for `GET /release` — the sales page. The three things that cost money if they break
 * are the point: prices derived from Polar's cents, the parity-pricing script's polarity, and
 * the page still rendering when the campaign lookup fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarClient } from "@pkg/polar";
import { describe, expect, test } from "vitest";

import { Discounts, Product } from "~/app/data/product";
import { FakePolarClient, makeDiscount, makeProduct } from "~/app/lib/test/polar";
import { fetchApp } from "~/app/lib/test/router";

/** The two live prices, in cents, as Polar reports them. */
const COMPLETE_CENTS = 9900;
const ESSENTIALS_CENTS = 4900;

/** Both products priced, so every test starts from a page that can quote a price. */
function products() {
	return {
		[Product.Complete]: makeProduct(COMPLETE_CENTS),
		[Product.Essentials]: makeProduct(ESSENTIALS_CENTS),
	};
}

/** A campaign scoped to Complete, running now, taking $30 off. */
function campaign(id: Discounts) {
	return makeDiscount({
		id,
		amount: 3000,
		startsAt: new Date("2000-01-01"),
		endsAt: null,
		products: [Product.Complete],
	});
}

function load(polar: FakePolarClient) {
	return fetchApp("/release", { services: [[PolarClient, polar]] });
}

describe("GET /release", () => {
	test("renders both prices as dollars, not as the cents Polar reports", async () => {
		let response = await load(new FakePolarClient({ products: products() }));
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("$99");
		expect(body).toContain("$49");
		expect(body).not.toContain("$9,900");
		expect(body).not.toContain("$4,900");
	});

	test("strikes the list price through and shows the campaign price for the discounted package", async () => {
		let polar = new FakePolarClient({
			products: products(),
			discounts: [campaign(Discounts.FIRST_WEEK)],
		});

		let body = await load(polar).then((response) => response.text());

		expect(body).toContain("<s>$99</s>");
		expect(body).toContain("$69");
		expect(body).not.toContain("<s>$49</s>");
	});

	test("renders every section anchor the page's own links point at", async () => {
		let body = await load(new FakePolarClient({ products: products() })).then((response) =>
			response.text(),
		);

		for (let id of ["hero", "description", "sample", "pricing", "author", "faq"]) {
			expect(body).toContain(`id="${id}"`);
		}
	});

	test("links both checkouts, the upgrade page, and the sample form", async () => {
		let body = await load(new FakePolarClient({ products: products() })).then((response) =>
			response.text(),
		);

		expect(body).toContain('href="/api/checkout/complete"');
		expect(body).toContain('href="/api/checkout/essentials"');
		expect(body).toContain('href="/upgrade"');
		expect(body).toContain('action="/sample"');
	});

	test("loads the parity-pricing script when no early-access campaign is running", async () => {
		let polar = new FakePolarClient({
			products: products(),
			discounts: [campaign(Discounts.SECOND_WEEK)],
		});

		let body = await load(polar).then((response) => response.text());

		expect(body).toContain("cdn.paritydeals.com");
	});

	test("withholds the parity-pricing script while the early-access campaign is running", async () => {
		let polar = new FakePolarClient({
			products: products(),
			discounts: [campaign(Discounts.EARLY)],
		});

		let body = await load(polar).then((response) => response.text());

		expect(body).not.toContain("cdn.paritydeals.com");
	});

	test("still renders when the campaign lookup fails", async () => {
		let polar = new FakePolarClient({
			products: products(),
			discountsThrow: new Error("Polar is down"),
		});

		let response = await load(polar);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("$99");
		expect(body).toContain("$49");
		expect(body).not.toContain("<s>$99</s>");
	});

	test("describes the book once, with an offer per package", async () => {
		let body = await load(new FakePolarClient({ products: products() })).then((response) =>
			response.text(),
		);

		expect(body).toContain('"@type":"Book"');
		expect(body).toContain('"price":"99"');
		expect(body).toContain('"price":"49"');
		expect(body.match(/"@type":"Book"/g)).toHaveLength(1);
	});

	test("loads no first-party JavaScript", async () => {
		let body = await load(new FakePolarClient({ products: products() })).then((response) =>
			response.text(),
		);

		expect(body).not.toContain("clientEntry");
	});
});
