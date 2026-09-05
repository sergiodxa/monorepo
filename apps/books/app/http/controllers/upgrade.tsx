/**
 * Upgrade controller. Renders the upgrade form, then resolves the submitted
 * address against the billing platform: a reader who already bought Essentials
 * gets a discounted Complete checkout, and anyone else is sent to the ordinary
 * Complete checkout with their address carried along, so a mistaken upgrade
 * attempt still ends in a purchase.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { Log } from "@sdxc/logger";
import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { Location } from "@sdxc/location";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
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
 * Pages the ownership check follows before it gives up. A page shorter than the
 * limit is not the last one, so the walk ends on a null cursor; the cap keeps a
 * reader with a long purchase history from holding the form open.
 */
const MAX_ORDER_PAGES = 5;

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
 * besides an Essentials owner. The address rides along so the hosted checkout
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

/**
 * Answers whether a customer has ever paid for Essentials, which is what the
 * upgrade price is offered against. One order settles it, so the smallest page
 * that can hold a match is asked for and the walk stops at the first one.
 *
 * @param billing - The platform to read orders from.
 * @param customerId - The customer whose orders to look through.
 * @param log - The request's log, so an unreadable order list is traceable.
 * @returns Whether an Essentials order exists; `false` when the list failed.
 */
async function ownsEssentials(billing: Billing, customerId: string, log: Log): Promise<boolean> {
	let cursor: string | undefined;

	for (let page = 0; page < MAX_ORDER_PAGES; page++) {
		let orders = await billing.orders.list({
			customer: { id: customerId },
			product: Product.Essentials,
			limit: 1,
			cursor,
		});

		if (isFailure(orders)) {
			log.warn("upgrade.order_lookup_failed", {
				code: orders.error.code,
				provider_code: orders.error.providerCode,
			});

			return false;
		}

		if (orders.data.items.length > 0) return true;
		if (orders.data.cursor === null) return false;

		cursor = orders.data.cursor;
	}

	return false;
}

/** GET /upgrade — the form that resolves an existing reader's purchase. */
export const index = createAction(routes.upgrade.index, (ctx) => renderUpgrade(ctx));

/** POST /upgrade — resolves the reader's purchase and sends them to the right checkout. */
export const action = createAction(routes.upgrade.action, async (ctx) => {
	let log = ctx.log;
	let validation = await validate(ctx.formData, SubscribeSchema);

	if (isFailure(validation)) {
		log.note("upgrade.validation_failed");
		return renderUpgrade(ctx, { error: INVALID_EMAIL_MESSAGE, status: 400 });
	}

	let { email } = validation.data;
	let customer = await ctx.billing.customers.findByEmail(email);

	if (isFailure(customer)) {
		log.set({ upgrade: { eligible: false } });
		log.note("upgrade.customer_not_found", { code: customer.error.code });
		return redirect(completeCheckoutUrl(email), { status: redirect.Status.SeeOther });
	}

	if (!(await ownsEssentials(ctx.billing, customer.data.id, log))) {
		log.set({ upgrade: { eligible: false } });
		log.note("upgrade.order_not_found");
		return redirect(completeCheckoutUrl(email), { status: redirect.Status.SeeOther });
	}

	log.set({
		upgrade: { eligible: true },
		checkout: { product: Product.Complete },
		discount: { id: Discounts.UPGRADE, applied: true },
	});

	let checkout = await ctx.billing.checkouts.create({
		product: Product.Complete,
		customer: { id: customer.data.id },
		discount: Discounts.UPGRADE,
		/** The upgrade price is already a discount, so the hosted page collects no code on top. */
		allowDiscountCodes: false,
	});

	if (isFailure(checkout)) {
		log.fail(checkout.error, { billing: { provider_code: checkout.error.providerCode } });
		return redirect(completeCheckoutUrl(email), { status: redirect.Status.SeeOther });
	}

	log.set({ checkout: { id: checkout.data.id } });

	if (checkout.data.url === null) {
		log.warn("checkout.unpayable");
		return redirect(completeCheckoutUrl(email), { status: redirect.Status.SeeOther });
	}

	log.note("checkout.started");

	return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
});
