/**
 * Tests for `GET /:book` — a book's landing. The things that cost money if they break are the
 * point: prices derived from the platform's cents, the parity-pricing script's polarity, the
 * page still rendering when the campaign lookup fails, and an unknown slug selling nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { MemoryDiscountSeed } from "@sdxc/billing/providers/memory";

import { describe, expect, test } from "vitest";

import { CLIENT_ENTRY_HREF } from "~/app/test/assets-manifest";
import { memoryBilling, withUnreadableDiscounts } from "~/app/test/billing";
import { fetchApp } from "~/app/test/router";
import { Discounts, Product } from "~/config/products";

/** What every campaign under test takes off the Complete package, in cents. */
const CAMPAIGN_CENTS = 3000;

/** A campaign scoped to Complete, running now, taking $30 off. */
function campaign(id: Discounts): MemoryDiscountSeed {
	return { id, amount: CAMPAIGN_CENTS, products: [Product.Complete] };
}

function load(billing: Billing) {
	return fetchApp("/react-router-oauth2", { billing });
}

describe("GET /:book", () => {
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

		expect(body).toMatch(/<s[^>]*>\$99<\/s>/);
		expect(body).toContain("$69");
		expect(body).not.toMatch(/<s[^>]*>\$49<\/s>/);
	});

	test("renders every section anchor the page's own links point at", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		for (let id of ["top", "sample", "contents", "flow", "inside", "author", "pricing", "faq"]) {
			expect(body).toContain(`id="${id}"`);
		}
	});

	test("links both checkouts, the upgrade page, and the sample form", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		expect(body).toContain('href="/api/checkout/complete"');
		expect(body).toContain('href="/api/checkout/essentials"');
		expect(body).toContain('href="/react-router-oauth2/upgrade"');
		expect(body).toContain('action="/react-router-oauth2/sample"');
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

		expect(body).not.toContain(CLIENT_ENTRY_HREF);
		expect(body).not.toContain('type="importmap"');
		expect(body).not.toContain('rel="modulepreload"');
	});

	test("quotes the lowest price a reader can pay today on the buy button", async () => {
		let billing = memoryBilling({ discounts: [campaign(Discounts.FIRST_WEEK)] });

		let body = await load(billing).then((response) => response.text());

		expect(body).toContain("Buy the book — from $49");
	});

	test("renders one h1, then h2 bands", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());
		let levels = [...body.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));

		expect(levels.filter((level) => level === 1)).toHaveLength(1);
		expect(levels[0]).toBe(1);
		for (let [index, level] of levels.entries()) {
			if (index > 0) expect(level - (levels[index - 1] ?? 1)).toBeLessThanOrEqual(1);
		}
	});

	test("answers an unknown book with the 404 page, before any billing call", async () => {
		let billing = memoryBilling();
		billing.fail("catalog.find", "unknown");

		let response = await fetchApp("/a-book-not-in-the-catalogue", { billing });

		expect(response.status).toBe(404);
	});

	test("says nothing about early access, since the book is published", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		expect(body).not.toMatch(/early access|special pricing/i);
	});

	test("introduces the author in the third person, as a book jacket does", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());

		expect(body).toContain("Sergio Xalambrí is an Argentinian web developer");
		expect(body).not.toContain("Hi, I’m Sergio");
	});

	test("lists the whole book in its contents, with the free chapter's sections badged", async () => {
		let body = await load(memoryBilling()).then((response) => response.text());
		let contents = body.slice(body.indexOf('id="contents"'), body.indexOf('id="flow"'));

		for (let title of [
			"Chapter 1 · OAuth2 in Simple Terms",
			"Chapter 2 · Tokens in OAuth2",
			"Chapter 3 · Building the Application",
			"Appendices",
			"Refresh Token",
			"The Client Application",
			"Comparison Tables",
		]) {
			expect(contents).toContain(title);
		}
		expect(contents.match(/>Free</g)).toHaveLength(7);
		expect(contents).toContain("The four roles in every flow");
	});
});
