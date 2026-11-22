/**
 * Holds Hangwell's server side to what a shopper relies on: prices per format, size, frame and
 * sale; a tampered bag only loses lines; promo codes explain why they fail; checkout skips
 * shipping for print files and never takes a card; refunds return each line's exact share of a
 * discount; the variant and review frames render in the page; and a print file downloads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import { POSTER_FACETS, readShopQuery, runShopQuery, searchPosters, didYouMean } from "./catalog";
import { stepsFor } from "./checkout";
import { findPoster, listPrice, salePrice } from "./data";
import { lineRefunds } from "./orders";
import { cartCookie, checkPromo, decodeLines, priceCart, readVisitor } from "./state";

/** The poster most tests buy. */
const FERN = findPoster("fern-study")!;

/** A framed 50 × 70 print of Fern Study in oak, with a mount. */
const FRAMED = {
	poster: "fern-study",
	variant: { format: "framed" as const, size: "50x70", frame: "oak", mount: true },
	qty: 1,
};

/** The print file of Korrin Hills. */
const FILE = {
	poster: "korrin-hills",
	variant: { format: "digital" as const, size: null, frame: null, mount: false },
	qty: 1,
};

/** Posts a form to a Hangwell action path with the given cookie. */
async function post(page: string, fields: Array<[string, string]>, cookie = "") {
	return await fetchApp(`/showcase/hangwell/demo/${page}`, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: cookie === "" ? {} : { Cookie: cookie },
		redirect: "manual",
	});
}

/** The `name=value` parts of a response's `Set-Cookie` headers, joined as a request sends them. */
function cookiesOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0] ?? "")
		.join("; ");
}

/** A bag cookie as a request carries it. */
function bag(lines: Parameters<typeof cartCookie>[0]): string {
	return cartCookie(lines).split(";")[0]!;
}

describe("Hangwell's prices", () => {
	test("scale by format, size, tier, frame wood and mount", () => {
		expect(listPrice(FERN, { format: "digital", size: null, frame: null, mount: false })).toBe(
			1200,
		);
		expect(listPrice(FERN, { format: "print", size: "a4", frame: null, mount: false })).toBe(2400);
		expect(listPrice(FERN, { format: "framed", size: "50x70", frame: "oak", mount: false })).toBe(
			16100,
		);
		expect(listPrice(FERN, { format: "framed", size: "50x70", frame: "walnut", mount: true })).toBe(
			16100 + 1500 + 900,
		);
	});

	test("take a poster's sale off every format", () => {
		let poster = findPoster("two-ink-garden")!;
		let variant = { format: "print" as const, size: "a3", frame: null, mount: false };
		expect(salePrice(poster, variant)).toBe(listPrice(poster, variant) * 0.8);
	});
});

describe("Hangwell's bag", () => {
	test("drops tampered lines: unknown posters, impossible variants and silly counts", () => {
		expect(
			decodeLines(
				"fern-study~framed~50x70~oak~1~2,ghost~print~a4~~0~1,fern-study~digital~a4~~0~1,fern-study~print~a4~~0~99",
			),
		).toEqual([
			{
				poster: "fern-study",
				variant: { format: "framed", size: "50x70", frame: "oak", mount: true },
				qty: 2,
			},
		]);
	});

	test("adds a variant and grows the same variant's line", async () => {
		let fields: Array<[string, string]> = [
			["poster", "fern-study"],
			["format", "print"],
			["size", "a3"],
			["back", "p/fern-study"],
		];
		let first = await post("cart/add", fields);
		let second = await post("cart/add", fields, cookiesOf(first));
		expect(first.status).toBe(303);
		expect(readVisitor(cookiesOf(second)).lines).toEqual([
			{
				poster: "fern-study",
				variant: { format: "print", size: "a3", frame: null, mount: false },
				qty: 2,
			},
		]);
	});

	test("charges shipping only for what ships, and makes standard free from €75", () => {
		expect(priceCart([FILE], "", "standard").shipping).toBeNull();
		expect(priceCart([FRAMED], "", "standard").shipping).toBe(0);
		let small = {
			poster: "seed-heads",
			variant: { format: "print" as const, size: "a4", frame: null, mount: false },
			qty: 1,
		};
		expect(priceCart([small, FILE], "", "standard")).toMatchObject({
			shipping: 490,
			toFreeShipping: 7500 - 1900,
		});
	});

	test("reports the VAT already inside the total", () => {
		let totals = priceCart([FILE], "", "standard");
		expect(totals.total).toBe(1200);
		expect(totals.vat).toBe(1200 - Math.round(120000 / 123));
	});
});

describe("Hangwell's promo codes", () => {
	test("say why a code can't be used", () => {
		expect(checkPromo("nope", [FILE])).toMatchObject({
			ok: false,
			message: expect.stringContaining("NOPE"),
		});
		expect(checkPromo("summer25", [FILE])).toMatchObject({
			ok: false,
			message: expect.stringContaining("ended"),
		});
		expect(checkPromo("FRAMED15", [FILE])).toMatchObject({
			ok: false,
			message: expect.stringContaining("framed"),
		});
		expect(checkPromo("welcome10", [FILE])).toMatchObject({ ok: true });
	});

	test("spread a discount over its lines so the shares add up to it exactly", () => {
		let print = {
			poster: "slow-mornings",
			variant: { format: "print" as const, size: "a3", frame: null, mount: false },
			qty: 3,
		};
		let totals = priceCart([FRAMED, print, FILE], "WELCOME10", "standard");
		expect(totals.lineDiscounts.reduce((sum, share) => sum + share, 0)).toBe(totals.discount);
		expect(priceCart([FRAMED, FILE], "FRAMED15", "standard").lineDiscounts[1]).toBe(0);
	});

	test("answer a bad code with the bag and the reason, keeping what was typed", async () => {
		let response = await post(
			"cart/promo",
			[
				["code", "SUMMER25"],
				["back", "cart"],
			],
			bag([FRAMED]),
		);
		let body = await response.text();
		expect(response.status).toBe(400);
		expect(body).toContain("SUMMER25 ended on 31 August.");
		expect(body).toContain('value="SUMMER25"');
	});
});

describe("Hangwell's checkout", () => {
	test("skips the address and shipping for a bag of print files", () => {
		expect(stepsFor([FILE])).toEqual(["information", "payment", "review"]);
		expect(stepsFor([FILE, FRAMED])).toEqual(["information", "shipping", "payment", "review"]);
	});

	test("keeps every typed field when the details step fails", async () => {
		let response = await post(
			"checkout/information",
			[
				["email", "maya@"],
				["name", "Maya Okafor"],
				["line1", "Rua 1"],
				["city", ""],
				["postcode", "4050-174"],
				["country", "PT"],
			],
			bag([FRAMED]),
		);
		let body = await response.text();
		expect(response.status).toBe(400);
		expect(body).toContain('value="Maya Okafor"');
		expect(body).toContain("Enter an email like");
		expect(body).toContain("Enter a city.");
	});

	test("never shows a card number field on any step", async () => {
		let cookie = bag([FRAMED]);
		for (let step of ["checkout", "checkout/shipping", "checkout/payment", "checkout/review"]) {
			let body = await (
				await fetchApp(`/showcase/hangwell/demo/${step}`, { headers: { Cookie: cookie } })
			).text();
			expect(body).not.toMatch(/autocomplete="cc-|name="card/);
		}
	});

	test("places an order from a filled draft and empties the bag", async () => {
		let cookie = bag([FRAMED, FILE]);
		let details = await post(
			"checkout/information",
			[
				["email", "maya@example.com"],
				["name", "Maya"],
				["line1", "Rua 1"],
				["city", "Porto"],
				["postcode", "4050-174"],
				["country", "PT"],
			],
			cookie,
		);
		expect(details.headers.get("Location")).toContain("checkout/shipping");
		let withDraft = `${cookie}; ${cookiesOf(details)}`;
		let placed = await post("checkout/place", [], withDraft);
		expect(placed.headers.get("Location")).toMatch(
			/\/showcase\/hangwell\/demo\/orders\/[0-9a-f-]{36}/,
		);
		let visitor = readVisitor(cookiesOf(placed));
		expect(visitor.lines).toEqual([]);
		expect(visitor.orders[0]?.lines).toHaveLength(2);
	});
});

describe("Hangwell's orders", () => {
	test("refund each line less its exact share of the order's discount", () => {
		let order = readVisitor(null).orders.find((entry) => entry.number === "HW-40312")!;
		let totals = priceCart(order.lines, order.promo, order.draft.shipping);
		let refunds = lineRefunds(order);
		expect(refunds.reduce((sum, value) => sum + value, 0)).toBe(totals.subtotal - totals.discount);
	});

	test("serve a bought print file as a download, and nothing else", async () => {
		let order = "0190a1b2-0000-7000-8000-000000000102";
		let file = await fetchApp(`/showcase/hangwell/demo/files/orders/${order}/korrin-hills.svg`);
		expect(file.status).toBe(200);
		expect(file.headers.get("Content-Disposition")).toContain("attachment");
		expect(await file.text()).toContain("Hangwell demo · Korrin Hills");
		expect(
			(await fetchApp(`/showcase/hangwell/demo/files/orders/${order}/fern-study.svg`)).status,
		).toBe(404);
	});
});

describe("Hangwell's catalogue", () => {
	test("counts each colour with the other filters applied but not its own", () => {
		let query = readShopQuery(null, new URLSearchParams("style=travel&color=ochre"));
		let { counts, posters } = runShopQuery(query);
		expect(
			posters.every((poster) => poster.style === "travel" && poster.paints.includes("ochre")),
		).toBe(true);
		let teal = counts.color.find((option) => option.value === "teal")!;
		expect(teal.count).toBe(
			runShopQuery(readShopQuery(null, new URLSearchParams("style=travel&color=teal"))).total,
		);
	});

	test("drops a stale filter from a link and still opens the collection", () => {
		let query = readShopQuery(null, new URLSearchParams("artist=nobody&color=ochre"));
		expect(query.issues).toEqual(["artist"]);
		expect(query.filters.color).toEqual(["ochre"]);
		expect(POSTER_FACETS.serialize(query.filters).toString()).toBe("color=ochre");
	});

	test("finds posters by any word and suggests a fix for a typo", () => {
		expect(searchPosters("moon").map((poster) => poster.id)).toContain("half-moons");
		expect(didYouMean("botanicl")).toBe("botanical");
	});
});

describe("Hangwell's product page", () => {
	test("renders the variant's buy box and the reviews inside the page", async () => {
		let body = await (
			await fetchApp("/showcase/hangwell/demo/p/port-anselm?format=print&size=a3")
		).text();
		expect(body).toContain("Add to bag");
		expect(body).toContain("Unframed print");
		expect(body).toContain("Write a review");
	});

	test("offers Notify me instead of Add to bag for a sold-out framed size", async () => {
		let { POSTERS, framedStock } = await import("./data");
		let sold = POSTERS.flatMap((poster) =>
			["a4", "a3", "50x70", "70x100"].map((size) => ({ poster, size })),
		).find(({ poster, size }) => framedStock(poster, size) === 0)!;
		let body = await (
			await fetchApp(
				`/showcase/hangwell/demo/p/${sold.poster.id}?format=framed&size=${sold.size}&frame=oak`,
			)
		).text();
		expect(body).toContain("Notify me");
		expect(body).not.toContain("Add to bag ·");
	});
});
