/**
 * Discount selection use case. Asks Polar for the organization's discounts and decides
 * which — if any — currently applies to the Complete package, filtering by campaign
 * allow-list, date window, redemption limit, and product scope. It decides what a
 * customer is charged, so the rules are exhaustive and covered by tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discount, PolarClient } from "@pkg/polar";
import type { Result } from "@pkg/result";

import { logger } from "@pkg/logger";
import { failure, success } from "@pkg/result";

import { Discounts, Product } from "~/app/data/product";

/** How many discounts to ask Polar for; the organization has far fewer than this. */
const PAGE_SIZE = 12;

/**
 * Finds the discount that currently applies to the Complete package, checking only
 * the three launch-window campaigns against date window, redemption cap, and product
 * scope — since each guard blocks a different way a stale campaign could quietly apply.
 *
 * @param polar - The Polar client to read discounts through.
 * @returns `success` with the applicable discount, or `undefined` when none applies;
 * `failure` only when Polar could not be read.
 */
export async function findApplicableDiscount(
	polar: PolarClient,
): Promise<Result<Discount | undefined, Error>> {
	try {
		let discounts = await polar.listDiscounts(PAGE_SIZE);
		let now = new Date();

		logger.info("discount_list_fetched", { count: discounts.length });

		let discount = discounts
			.filter(
				(item) =>
					item.id === Discounts.EARLY ||
					item.id === Discounts.FIRST_WEEK ||
					item.id === Discounts.SECOND_WEEK,
			)
			.find((item) => {
				if (item.startsAt && item.startsAt > now) return false;
				if (item.endsAt && item.endsAt < now) return false;

				if (item.maxRedemptions && item.redemptionsCount >= item.maxRedemptions) {
					return false;
				}

				if (item.products.length === 0) return false;

				if (item.products.some((product) => product.id !== Product.Complete)) {
					return false;
				}

				return true;
			});

		if (discount) {
			logger.info("discount_applied", { discountId: discount.id, name: discount.name });
		} else {
			logger.info("discount_not_applicable");
		}

		return success(discount);
	} catch (error) {
		logger.error("discount_fetch_error", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof Error) return failure(error);
		return failure(new Error("Failed to find applicable discount"));
	}
}
