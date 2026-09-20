/**
 * `POST /billing/tenants/:tenantId/portal` — opens Polar's hosted billing
 * portal for the customer that owns this tenant (ADR-018). One customer holds
 * one portal session however many tenants they own; plan changes live in the
 * dashboard instead, since a change made in the portal names a subscription
 * and not a tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badGateway, notFound } from "@sdxc/http/response/json";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { polar } from "~/app/lib/billing";
import { openPortal } from "~/app/services/billing-portal";
import routes from "~/routes/web";

/** The path's own tenant id. */
let Params = s.object({ tenantId: s.string() });

/**
 * Opens a portal session for the tenant's owning customer.
 *
 * @returns A `303` redirect to the hosted portal, `404` when the tenant or its
 * provider customer does not exist, or `502` when the platform could not open
 * a session.
 * @example
 * router.map(routes.billing.portal, portal);
 */
export default createAction(routes.billing.portal, async (ctx) => {
	let { tenantId } = s.parse(Params, ctx.params);

	let opened = await openPortal(ctx.db, polar, { tenantId });

	if (!opened.ok) {
		if (opened.reason === "billing_error") {
			return badGateway({ error: opened.reason, message: opened.error.message });
		}

		return notFound({ error: opened.reason });
	}

	return redirect(opened.url, { status: redirect.Status.SeeOther });
});
