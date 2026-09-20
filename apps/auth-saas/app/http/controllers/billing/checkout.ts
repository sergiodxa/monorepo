/**
 * `POST /billing/tenants/:tenantId/checkout` — opens a hosted checkout for one of
 * this tenant's plans or add-ons (ADR-018). A backend endpoint: there is no
 * dashboard app in this ADR series, so a future UI posts here and is redirected
 * to Polar's hosted page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badGateway, notFound } from "@sdxc/http/response/json";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { polar } from "~/app/lib/billing";
import { openCheckout } from "~/app/services/billing-checkout";
import routes from "~/routes/web";

/** The path's own tenant id. */
let Params = s.object({ tenantId: s.string() });

/** The buyer's contact and what they are buying; `kind` defaults to the base plan. */
let CheckoutForm = f.object({
	email: f.field(s.string().pipe(checks.minLength(1))),
	name: f.field(s.defaulted(s.string(), "")),
	product: f.field(s.string().pipe(checks.minLength(1))),
	kind: f.field(s.defaulted(s.enum_(["base", "addon"] as const), "base")),
});

/**
 * Builds the return URL Polar redirects the buyer to once the hosted checkout
 * is done. `{CHECKOUT_ID}` is Polar's own template placeholder, substituted with
 * the real checkout id at redirect time — built by string concatenation rather
 * than `URLSearchParams`, which would percent-encode the braces.
 */
function checkoutReturnUrl(requestUrl: string): string {
	let base = new URL(routes.billing.checkoutReturn.href(), requestUrl);
	return `${base.toString()}?checkout_id={CHECKOUT_ID}`;
}

/**
 * Opens a hosted checkout for a tenant's base plan or an add-on.
 *
 * @returns A `303` redirect to the hosted checkout, `404` when the tenant does
 * not exist, or `502` when the platform could not open a session.
 * @example
 * router.map(routes.billing.checkout, checkout);
 */
export default createAction(routes.billing.checkout, async (ctx) => {
	let { tenantId } = s.parse(Params, ctx.params);
	let submitted = s.parse(CheckoutForm, ctx.formData);

	let opened = await openCheckout(ctx.db, polar, {
		tenantId,
		email: submitted.email,
		name: submitted.name === "" ? undefined : submitted.name,
		product: submitted.product,
		kind: submitted.kind,
		returnTo: checkoutReturnUrl(ctx.request.url),
	});

	if (!opened.ok) {
		if (opened.reason === "tenant_not_found") return notFound({ error: "tenant_not_found" });
		return badGateway({ error: opened.reason, message: opened.error.message });
	}

	return redirect(opened.url, { status: redirect.Status.SeeOther });
});
