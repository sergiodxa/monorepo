import { redirectDocument } from "react-router";
import { Product } from "~/data/product";
import polar from "~/services/polar";
import { findApplicableDiscount } from "~/use-case/find-applicable-discount";
import type { Route } from "./+types/api.checkout.$type";

export async function loader({ request, params }: Route.LoaderArgs) {
	let url = new URL(request.url);
	let customerEmail = url.searchParams.get("email");

	if (params.type === "essentials") {
		let checkout = await polar.checkouts.create({
			products: [Product.Essentials],
			allowDiscountCodes: true,
			customerEmail,
		});

		return redirectDocument(checkout.url);
	}

	let discountResult = await findApplicableDiscount();
	let discount = discountResult.status === "success" ? discountResult.data : undefined;

	let checkout = await polar.checkouts.create({
		products: [Product.Complete],
		discountId: discount?.id,
		allowDiscountCodes: false,
		customerEmail,
	});

	return redirectDocument(checkout.url);
}
