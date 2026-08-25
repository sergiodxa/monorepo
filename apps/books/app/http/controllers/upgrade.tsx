/**
 * Upgrade controller. Renders the upgrade form, then resolves the submitted address
 * against Polar: a reader who already bought Essentials gets a discounted Complete
 * checkout, and anyone else is sent to the ordinary Complete checkout with their address
 * carried along, so a mistaken upgrade attempt still ends in a purchase.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@pkg/http/response";
import { Location } from "@pkg/location";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { createAction } from "remix/router";

import { Discounts, Product } from "~/app/data/product";
import { INVALID_EMAIL_MESSAGE, SubscribeSchema } from "~/app/http/validators/subscribe";
import { readAttribution } from "~/app/lib/attribution";
import { seo } from "~/app/lib/seo";
import DocumentLayout from "~/resources/layouts/document";
import UpgradeView from "~/resources/views/upgrade";
import routes from "~/routes/web";

/** The page's own title and description, aimed at the upgrade offer. */
const TITLE = "Upgrade to the Complete Package";
const DESCRIPTION =
	"Move from The Book to the Complete Package: every chapter, the sample application, and the Discord community.";

/**
 * @param ctx - The request context, for its URL and renderer.
 * @param options - `error` shows a validation failure under the email field, and `status`
 * lets the form endpoint answer 400 while still returning the page.
 * @returns The rendered HTML response.
 */
function renderUpgrade(ctx: RequestContext, options: { error?: string; status?: number } = {}) {
	return ctx.render(
		<DocumentLayout title={TITLE} description={DESCRIPTION} canonical={seo.canonical(ctx.url)}>
			<UpgradeView
				action={routes.upgrade.action.href()}
				attribution={readAttribution(ctx.url.searchParams)}
				error={options.error}
			/>
		</DocumentLayout>,
		options.status ? { status: options.status } : undefined,
	);
}

/**
 * Builds the full-price Complete checkout URL for an address, used for anyone
 * besides an Essentials owner. The address rides along so Polar's checkout
 * arrives pre-filled for the visitor.
 *
 * @param email - The address the reader submitted.
 * @returns The relative checkout URL to redirect to.
 */
function completeCheckoutUrl(email: string): string {
	return String(
		new Location({
			pathname: routes.api.checkout.href({ type: "complete" }),
			search: new URLSearchParams({ email }),
		}),
	);
}

/** GET /upgrade — the form that resolves an existing reader's purchase. */
export const index = createAction(routes.upgrade.index, (ctx) => renderUpgrade(ctx));

/** POST /upgrade — resolves the reader's purchase and sends them to the right checkout. */
export const action = createAction(routes.upgrade.action, async (ctx) => {
	let log = ctx.logger;
	let validation = await validate(ctx.formData, SubscribeSchema);

	if (isFailure(validation)) {
		log.info("upgrade_validation_failed", { issue: INVALID_EMAIL_MESSAGE });
		return renderUpgrade(ctx, { error: INVALID_EMAIL_MESSAGE, status: 400 });
	}

	let { email } = validation.data;
	let polar = getServiceContainer().get(PolarClient);
	let customer = await polar.findCustomerByEmail(email);

	if (!customer) {
		log.info("upgrade_customer_not_found", { email });
		return redirect(completeCheckoutUrl(email), { status: redirect.Status.SeeOther });
	}

	let orders = await polar.listOrders({
		customerId: customer.id,
		productId: Product.Essentials,
	});

	if (orders.length === 0) {
		log.info("upgrade_order_not_found", { email });
		return redirect(completeCheckoutUrl(email), { status: redirect.Status.SeeOther });
	}

	let checkout = await polar.createCheckout({
		productId: Product.Complete,
		customerId: customer.id,
		discountId: Discounts.UPGRADE,
		allowDiscountCodes: false,
	});

	log.info("checkout_started", {
		product: "complete",
		email,
		checkoutId: checkout.id,
		discountId: Discounts.UPGRADE,
	});

	return redirect(checkout.url, { status: redirect.Status.SeeOther });
});
