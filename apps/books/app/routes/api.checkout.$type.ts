import { isFailure, isSuccess } from "@pkg/result";
import { redirectDocument } from "react-router";

import { Product } from "~/data/product";
import { logger } from "~/middleware/logger";
import polar from "~/services/polar";
import { findApplicableDiscount } from "~/use-case/find-applicable-discount";

import type { Route } from "./+types/api.checkout.$type";

export async function loader({ request, params }: Route.LoaderArgs) {
	let log = logger().loader("routes/api.checkout.$type");
	let url = new URL(request.url);
	let customerEmail = url.searchParams.get("email");

	if (params.type === "essentials") {
		let checkout = await polar.checkouts.create({
			products: [Product.Essentials],
			allowDiscountCodes: true,
			customerEmail,
		});

		log.info("checkout_started", {
			product: "essentials",
			email: customerEmail,
			checkoutId: checkout.id,
		});

		return redirectDocument(checkout.url);
	}

	let discountResult = await findApplicableDiscount();
	let discount = isSuccess(discountResult) ? discountResult.data : undefined;

	if (isFailure(discountResult)) {
		log.info("discount_lookup_failed", { error: discountResult.error.message });
	}

	let checkout = await polar.checkouts.create({
		products: [Product.Complete],
		discountId: discount?.id,
		allowDiscountCodes: false,
		customerEmail,
	});

	log.info("checkout_started", {
		product: "complete",
		email: customerEmail,
		checkoutId: checkout.id,
		discountId: discount?.id,
	});

	return redirectDocument(checkout.url);
}
