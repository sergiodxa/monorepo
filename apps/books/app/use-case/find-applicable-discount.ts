import { Discounts, Product } from "~/data/product";
import polar from "~/services/polar";

export async function findApplicableDiscount() {
	const discounts = await polar.discounts.list({ limit: 12 });
	const now = new Date();

	return discounts.result.items
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
}
