import type { Result } from "@pkg/result";
import { success, failure } from "@pkg/result";
import { Discounts, Product } from "~/data/product";
import polar from "~/services/polar";

type DiscountItem = Awaited<ReturnType<typeof polar.discounts.list>>["result"]["items"][number];

export async function findApplicableDiscount(): Promise<Result<DiscountItem | undefined, Error>> {
	try {
		let discounts = await polar.discounts.list({ limit: 12 });
		let now = new Date();

		let discount = discounts.result.items
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

		return success(discount);
	} catch (error) {
		if (error instanceof Error) {
			return failure(error);
		}
		return failure(new Error("Failed to find applicable discount"));
	}
}
