/**
 * Checkout controller. Opens a hosted checkout for the requested package and
 * redirects to it: list price for Essentials, the current launch campaign for
 * Complete. Because the URL is a shareable GET, `:type` is checked against the
 * published package names before any billing call, keeping every checkout tied
 * to a package the visitor actually chose.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discount } from "@sdxc/billing";

import { redirect } from "@sdxc/http/response";
import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { email } from "remix/data-schema/checks";
import { createAction } from "remix/router";

import { Product } from "~/app/data/product";
import defaultHandler from "~/app/http/controllers/default-handler";
import { findApplicableDiscount } from "~/app/services/discount";
import routes from "~/routes/web";

/**
 * The two package names the URL is published with. Values outside this set
 * reach the 404 page before any billing call, keeping every checkout tied to a
 * package the visitor actually requested.
 */
const TypeSchema = s.object({ type: s.enum_([Product.Essentials, Product.Complete]) });

/**
 * The `?email=` pass-through, pre-filled on the hosted checkout. An address
 * that fails to parse is dropped before it is sent, since the platform would
 * reject the whole checkout — a pre-filled field is worth less than the sale.
 */
const EmailSchema = s.object({ email: s.optional(s.string().pipe(email())) });

/** GET /api/checkout/:type — opens a hosted checkout and redirects the buyer to it. */
export default createAction(routes.api.checkout, async (ctx) => {
	let log = ctx.logger;

	let typeParsed = s.parseSafe(TypeSchema, ctx.params);

	if (!typeParsed.success) {
		log.info("checkout_type_unknown");
		return defaultHandler(ctx);
	}

	let product = typeParsed.value.type;

	let emailParsed = s.parseSafe(EmailSchema, {
		email: ctx.url.searchParams.get("email") ?? undefined,
	});
	let customerEmail = emailParsed.success ? emailParsed.value.email : undefined;
	if (!emailParsed.success) log.info("checkout_email_ignored");

	/** Only Complete carries a launch campaign; Essentials always sells at list price. */
	let discount: Discount | undefined;

	if (product === Product.Complete) {
		let discountResult = await findApplicableDiscount(ctx.billing);

		if (isFailure(discountResult)) {
			log.info("discount_lookup_failed", { code: discountResult.error.code });
		}

		discount = isSuccess(discountResult) ? discountResult.data : undefined;
	}

	let checkout = await ctx.billing.checkouts.create({
		product,
		email: customerEmail,
		discount: discount?.id,
		/**
		 * Complete sells behind the launch campaign, so its hosted page collects
		 * no code: a buyer typing one would take a second reduction off a price
		 * that is already reduced. Essentials sells at list price, where a code
		 * is the only discount there is.
		 */
		allowDiscountCodes: product !== Product.Complete,
	});

	if (isFailure(checkout)) {
		log.error("checkout_failed", {
			product,
			code: checkout.error.code,
			providerCode: checkout.error.providerCode,
		});

		return redirect(routes.release.href(), { status: redirect.Status.SeeOther });
	}

	if (checkout.data.url === null) {
		log.error("checkout_unpayable", { product, checkoutId: checkout.data.id });
		return redirect(routes.release.href(), { status: redirect.Status.SeeOther });
	}

	log.info("checkout_started", {
		product,
		email: customerEmail,
		checkoutId: checkout.data.id,
		discountId: discount?.id,
	});

	return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
});
