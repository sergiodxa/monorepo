/**
 * Checkout controller. Starts a Polar checkout for the requested package and sends the
 * visitor straight to Polar's hosted page: Essentials at list price with discount codes
 * allowed, Complete with whichever launch campaign currently applies and no codes. The
 * URL is linked from the pricing page and shareable, which is why it stays a GET.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
import { isFailure, isSuccess } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { email } from "remix/data-schema/checks";
import { createAction } from "remix/fetch-router";

import { Product } from "~/app/data/product";
import { findApplicableDiscount } from "~/app/services/discount";
import routes from "~/routes/web";

/**
 * The two package names the URL is published with. Parsing is deliberately non-fatal: an
 * unrecognized `:type` falls through to the Complete checkout, which is what this
 * endpoint has always done for a mistyped or stale link, and sending a would-be buyer to
 * the flagship package beats showing them a 404.
 */
const TypeSchema = s.object({ type: s.enum_(["essentials", "complete"]) });

/**
 * The `?email=` pass-through, pre-filled on Polar's checkout. An address that does not
 * parse is dropped rather than forwarded: Polar would reject the checkout outright, and
 * losing a pre-filled field is better than losing the sale.
 */
const EmailSchema = s.object({ email: s.optional(s.string().pipe(email())) });

/** GET /api/checkout/:type — starts a Polar checkout and redirects the buyer to it. */
export default createAction(routes.api.checkout, async (ctx) => {
	let log = ctx.logger;
	let polar = getServiceContainer().get(PolarClient);

	let emailParsed = s.parseSafe(EmailSchema, {
		email: ctx.url.searchParams.get("email") ?? undefined,
	});
	let customerEmail = emailParsed.success ? emailParsed.value.email : undefined;
	if (!emailParsed.success) log.info("checkout_email_ignored");

	let typeParsed = s.parseSafe(TypeSchema, ctx.params);

	if (typeParsed.success && typeParsed.value.type === "essentials") {
		let checkout = await polar.createCheckout({
			productId: Product.Essentials,
			customerEmail,
			allowDiscountCodes: true,
		});

		log.info("checkout_started", {
			product: "essentials",
			email: customerEmail,
			checkoutId: checkout.id,
		});

		return redirect(checkout.url, { status: redirect.Status.SeeOther });
	}

	let discountResult = await findApplicableDiscount(polar);
	let discount = isSuccess(discountResult) ? discountResult.data : undefined;

	if (isFailure(discountResult)) {
		log.info("discount_lookup_failed", { error: discountResult.error.message });
	}

	let checkout = await polar.createCheckout({
		productId: Product.Complete,
		customerEmail,
		discountId: discount?.id,
		allowDiscountCodes: false,
	});

	log.info("checkout_started", {
		product: "complete",
		email: customerEmail,
		checkoutId: checkout.id,
		discountId: discount?.id,
	});

	return redirect(checkout.url, { status: redirect.Status.SeeOther });
});
