/**
 * Checkout controller. Starts a Polar checkout for the requested package and
 * redirects to Polar's hosted checkout: list price for Essentials, the
 * current launch campaign for Complete. Because the URL is a shareable GET,
 * `:type` is checked against the published package names before any billing
 * call, keeping every checkout tied to a package the visitor actually chose.
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
import { createAction } from "remix/router";

import { Product } from "~/app/data/product";
import defaultHandler from "~/app/http/controllers/default-handler";
import { findApplicableDiscount } from "~/app/services/discount";
import routes from "~/routes/web";

/**
 * The two package names the URL is published with. Values outside this set
 * reach the 404 page before the billing client, keeping every checkout tied
 * to a package the visitor actually requested.
 */
const TypeSchema = s.object({ type: s.enum_(["essentials", "complete"]) });

/**
 * The `?email=` pass-through, pre-filled on Polar's checkout. An address
 * that fails to parse is dropped before reaching Polar, since Polar would
 * reject the whole checkout — a pre-filled field is worth less than the sale.
 */
const EmailSchema = s.object({ email: s.optional(s.string().pipe(email())) });

/** GET /api/checkout/:type — starts a Polar checkout and redirects the buyer to it. */
export default createAction(routes.api.checkout, async (ctx) => {
	let log = ctx.logger;

	let typeParsed = s.parseSafe(TypeSchema, ctx.params);

	if (!typeParsed.success) {
		log.info("checkout_type_unknown");
		return defaultHandler(ctx);
	}

	let polar = getServiceContainer().get(PolarClient);

	let emailParsed = s.parseSafe(EmailSchema, {
		email: ctx.url.searchParams.get("email") ?? undefined,
	});
	let customerEmail = emailParsed.success ? emailParsed.value.email : undefined;
	if (!emailParsed.success) log.info("checkout_email_ignored");

	if (typeParsed.value.type === "essentials") {
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
