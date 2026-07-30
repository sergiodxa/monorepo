/**
 * Tests for the discount selection rules — the logic that decides what a buyer is
 * charged. Every rejection branch gets its own case, because each one is a different way
 * an expired or misconfigured campaign could silently discount a sale, and a rule that
 * stops firing looks like a normal full-price checkout from the outside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import { Discounts, Product } from "~/app/data/product";
import { FakePolarClient, makeDiscount } from "~/app/lib/test/polar";
import { findApplicableDiscount } from "~/app/services/discount";

/** An hour, as milliseconds, for building dates either side of "now". */
const HOUR = 60 * 60 * 1000;

/** Runs the rules against a single scripted discount and returns the chosen one. */
async function select(discount: ReturnType<typeof makeDiscount>) {
	let result = await findApplicableDiscount(new FakePolarClient({ discounts: [discount] }));
	if (!isSuccess(result)) throw new Error("expected the lookup to succeed");
	return result.data;
}

describe("findApplicableDiscount", () => {
	test("applies a launch-window campaign scoped to Complete", async () => {
		let discount = makeDiscount({
			id: Discounts.FIRST_WEEK,
			startsAt: new Date(Date.now() - HOUR),
			endsAt: new Date(Date.now() + HOUR),
			maxRedemptions: 100,
			redemptionsCount: 3,
			products: [Product.Complete],
		});

		expect(await select(discount)).toBe(discount);
	});

	test("applies an open-ended campaign with no dates and no redemption cap", async () => {
		let discount = makeDiscount({ id: Discounts.EARLY, products: [Product.Complete] });

		expect(await select(discount)).toBe(discount);
	});

	test("ignores a discount that is not one of the launch-window campaigns", async () => {
		let discount = makeDiscount({
			id: "11111111-1111-1111-1111-111111111111",
			products: [Product.Complete],
		});

		expect(await select(discount)).toBeUndefined();
	});

	test("ignores the upgrade discount, which is handed out rather than auto-applied", async () => {
		let discount = makeDiscount({ id: Discounts.UPGRADE, products: [Product.Complete] });

		expect(await select(discount)).toBeUndefined();
	});

	test("ignores a campaign that has not started yet", async () => {
		let discount = makeDiscount({
			id: Discounts.EARLY,
			startsAt: new Date(Date.now() + HOUR),
			products: [Product.Complete],
		});

		expect(await select(discount)).toBeUndefined();
	});

	test("ignores a campaign that has already ended", async () => {
		let discount = makeDiscount({
			id: Discounts.SECOND_WEEK,
			endsAt: new Date(Date.now() - HOUR),
			products: [Product.Complete],
		});

		expect(await select(discount)).toBeUndefined();
	});

	test("ignores a campaign whose redemptions are exhausted", async () => {
		let discount = makeDiscount({
			id: Discounts.FIRST_WEEK,
			maxRedemptions: 50,
			redemptionsCount: 50,
			products: [Product.Complete],
		});

		expect(await select(discount)).toBeUndefined();
	});

	test("ignores a campaign scoped to no products at all", async () => {
		let discount = makeDiscount({ id: Discounts.EARLY, products: [] });

		expect(await select(discount)).toBeUndefined();
	});

	test("ignores a campaign scoped to a product other than Complete", async () => {
		let discount = makeDiscount({ id: Discounts.EARLY, products: [Product.Essentials] });

		expect(await select(discount)).toBeUndefined();
	});

	test("ignores a campaign that covers Complete alongside another product", async () => {
		let discount = makeDiscount({
			id: Discounts.EARLY,
			products: [Product.Complete, Product.Essentials],
		});

		expect(await select(discount)).toBeUndefined();
	});

	test("picks the first applicable campaign when several qualify", async () => {
		let first = makeDiscount({ id: Discounts.FIRST_WEEK, products: [Product.Complete] });
		let second = makeDiscount({ id: Discounts.SECOND_WEEK, products: [Product.Complete] });
		let polar = new FakePolarClient({ discounts: [first, second] });

		let result = await findApplicableDiscount(polar);

		expect(isSuccess(result) && result.data).toBe(first);
	});

	test("succeeds with no discount when the organization has none", async () => {
		let result = await findApplicableDiscount(new FakePolarClient({ discounts: [] }));

		expect(isSuccess(result) && result.data).toBeUndefined();
	});

	test("fails when Polar cannot be read", async () => {
		let polar = new FakePolarClient({ throws: new Error("polar is down") });

		let result = await findApplicableDiscount(polar);

		expect(isFailure(result)).toBe(true);
	});
});
