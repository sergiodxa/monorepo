/**
 * `GET /billing/checkout/return` — where Polar sends a buyer back once a hosted
 * checkout is done (ADR-018). Settles the checkout, attaches whatever
 * subscription it produced to its tenant, and refreshes that tenant's
 * entitlement projection — the same read the webhook performs, safe to run
 * twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badGateway, badRequest, ok } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { polar } from "~/app/lib/billing";
import { finishCheckout } from "~/app/services/billing-checkout";
import routes from "~/routes/web";

/**
 * Settles a returning checkout.
 *
 * @returns `200` with the tenant's plan once settled, `400` when the request
 * carries no `checkout_id`, or `502` when the platform could not settle it.
 * @example
 * router.map(routes.billing.checkoutReturn, checkoutReturn);
 */
export default createAction(routes.billing.checkoutReturn, async (ctx) => {
	let checkoutId = ctx.url.searchParams.get("checkout_id");
	if (!checkoutId) return badRequest({ error: "missing_checkout_id" });

	let finished = await finishCheckout(ctx.db, polar, checkoutId);

	if (!finished.ok) return badGateway({ error: "billing_error", message: finished.error.message });

	return ok({
		tenantId: finished.tenant?.id ?? null,
		planSlug: finished.tenant?.plan_slug ?? null,
	});
});
