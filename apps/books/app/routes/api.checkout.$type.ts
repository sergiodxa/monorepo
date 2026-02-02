import { redirectDocument } from "react-router";
import { Product } from "~/data/product";
import polar from "~/services/polar";
import { findApplicableDiscount } from "~/use-case/find-applicable-discount";
import type { Route } from "./+types/api.checkout.$type";

export async function loader({ request, params }: Route.LoaderArgs) {
	let url = new URL(request.url);

	if (params.type === "essentials") {
		const checkout = await polar.checkouts.create({
			products: [Product.Essentials],
			allowDiscountCodes: true,
			customerEmail: url.searchParams.get("email"),
		});

		return redirectDocument(checkout.url);
	}

	const discount = await findApplicableDiscount();
	const checkout = await polar.checkouts.create({
		products: [Product.Complete],
		discountId: discount?.id,
		allowDiscountCodes: false,
		customerEmail: url.searchParams.get("email"),
	});

	return redirectDocument(checkout.url);
}
