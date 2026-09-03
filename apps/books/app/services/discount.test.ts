/**
 * Tests for the discount selection rules — the logic that decides what a buyer is
 * charged. Every rejection branch gets its own case, because each one is a different way
 * an expired or misconfigured campaign could silently discount a sale, and a rule that
 * stops firing looks like a normal full-price checkout from the outside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discount } from "@sdxc/billing";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Discounts, Product } from "~/app/data/product";
import { memoryBilling, withUnreadableDiscounts } from "~/app/lib/test/billing";
import { findApplicableDiscount, selectDiscount } from "~/app/services/discount";

const HOUR = 60 * 60 * 1000;

/** What every campaign under test takes off the Complete package, in cents. */
const CAMPAIGN_CENTS = 3000;

/** The fields of a campaign a selection rule reads. */
interface DiscountFixture {
	/** The discount id, which is what the campaign allow-list matches on. */
	id: string;
	/** When the campaign opens; `null` means it always has. */
	startsAt?: Date | null;
	/** When the campaign closes; `null` means it never does. */
	endsAt?: Date | null;
	/** Redemption cap; `null` means uncapped. */
	maxRedemptions?: number | null;
	/** Redemptions used so far. */
	redemptions?: number;
	/** The package slugs the campaign is scoped to. */
	products?: string[];
}

/**
 * Builds a campaign with the fields under test and defaults for the rest.
 *
 * @param fixture - The fields the rule under test reads.
 * @returns A campaign the selection rules can be run against.
 */
function makeDiscount(fixture: DiscountFixture): Discount {
	return {
		id: fixture.id,
		code: null,
		name: "Test discount",
		kind: "fixed",
		percentage: null,
		amount: { amount: CAMPAIGN_CENTS, currency: "usd" },
		productSlugs: fixture.products ?? [],
		maxRedemptions: fixture.maxRedemptions ?? null,
		redemptions: fixture.redemptions ?? 0,
		startsAt: fixture.startsAt ?? null,
		endsAt: fixture.endsAt ?? null,
		createdAt: new Date(),
		providerData: {},
	};
}

function select(discount: Discount) {
	return selectDiscount([discount]);
}

describe("selectDiscount", () => {
	test("applies a launch-window campaign scoped to Complete", () => {
		let discount = makeDiscount({
			id: Discounts.FIRST_WEEK,
			startsAt: new Date(Date.now() - HOUR),
			endsAt: new Date(Date.now() + HOUR),
			maxRedemptions: 100,
			redemptions: 3,
			products: [Product.Complete],
		});

		expect(select(discount)).toBe(discount);
	});

	test("applies an open-ended campaign with no dates and no redemption cap", () => {
		let discount = makeDiscount({ id: Discounts.EARLY, products: [Product.Complete] });

		expect(select(discount)).toBe(discount);
	});

	test("ignores a discount that is not one of the launch-window campaigns", () => {
		let discount = makeDiscount({
			id: "11111111-1111-1111-1111-111111111111",
			products: [Product.Complete],
		});

		expect(select(discount)).toBeUndefined();
	});

	test("ignores the upgrade discount, which is handed out rather than auto-applied", () => {
		let discount = makeDiscount({ id: Discounts.UPGRADE, products: [Product.Complete] });

		expect(select(discount)).toBeUndefined();
	});

	test("ignores a campaign that has not started yet", () => {
		let discount = makeDiscount({
			id: Discounts.EARLY,
			startsAt: new Date(Date.now() + HOUR),
			products: [Product.Complete],
		});

		expect(select(discount)).toBeUndefined();
	});

	test("ignores a campaign that has already ended", () => {
		let discount = makeDiscount({
			id: Discounts.SECOND_WEEK,
			endsAt: new Date(Date.now() - HOUR),
			products: [Product.Complete],
		});

		expect(select(discount)).toBeUndefined();
	});

	test("ignores a campaign whose redemptions are exhausted", () => {
		let discount = makeDiscount({
			id: Discounts.FIRST_WEEK,
			maxRedemptions: 50,
			redemptions: 50,
			products: [Product.Complete],
		});

		expect(select(discount)).toBeUndefined();
	});

	test("ignores a campaign scoped to no products at all", () => {
		let discount = makeDiscount({ id: Discounts.EARLY, products: [] });

		expect(select(discount)).toBeUndefined();
	});

	test("ignores a campaign scoped to a package other than Complete", () => {
		let discount = makeDiscount({ id: Discounts.EARLY, products: [Product.Essentials] });

		expect(select(discount)).toBeUndefined();
	});

	test("ignores a campaign that covers Complete alongside another package", () => {
		let discount = makeDiscount({
			id: Discounts.EARLY,
			products: [Product.Complete, Product.Essentials],
		});

		expect(select(discount)).toBeUndefined();
	});

	test("picks the first applicable campaign when several qualify", () => {
		let first = makeDiscount({ id: Discounts.FIRST_WEEK, products: [Product.Complete] });
		let second = makeDiscount({ id: Discounts.SECOND_WEEK, products: [Product.Complete] });

		expect(selectDiscount([first, second])).toBe(first);
	});
});

describe("findApplicableDiscount", () => {
	test("applies the campaign the platform is running", async () => {
		let billing = memoryBilling({
			discounts: [
				{ id: Discounts.FIRST_WEEK, amount: CAMPAIGN_CENTS, products: [Product.Complete] },
			],
		});

		let result = await findApplicableDiscount(billing);

		expect(isSuccess(result) && result.data?.id).toBe(Discounts.FIRST_WEEK);
	});

	test("succeeds with no discount when the organization runs none", async () => {
		let result = await findApplicableDiscount(memoryBilling());

		expect(isSuccess(result) && result.data).toBeUndefined();
	});

	test("fails when the campaigns cannot be read", async () => {
		let result = await findApplicableDiscount(withUnreadableDiscounts(memoryBilling()));

		expect(isFailure(result)).toBe(true);
	});
});
