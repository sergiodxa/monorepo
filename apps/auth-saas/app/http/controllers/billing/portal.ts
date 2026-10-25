/**
 * `POST /billing/tenants/:tenantId/portal` — opens Polar's hosted billing portal
 * for the customer that owns this tenant, for the tenant's owner alone:
 * the portal holds the customer's payment method and the invoices of every tenant
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { redirect } from "@sdxc/http/response";
import { badGateway, notFound } from "@sdxc/http/response/json";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { dashboardAccess } from "~/app/http/middleware/dashboard-access";
import { polar } from "~/app/initializers/billing";
import abilities from "~/app/policies/abilities";
import { openPortal } from "~/app/services/billing-portal";
import routes from "~/routes/web";

/** The path's own tenant id. */
let Params = s.object({ tenantId: s.string() });

/**
 * Opens a portal session for the tenant's owning customer.
 *
 * @returns A `303` redirect to the hosted portal, `401` with no dashboard session, `403` for anyone but the tenant's owner, `404` when its provider customer does not exist, or `502` when the platform could not open a session.
 * @example
 * router.map(routes.billing.portal, portal);
 */
export default createAction(routes.billing.portal, {
	middleware: [dashboardAccess(), requireAbility(abilities.billing.manage)],
	handler: async (ctx) => {
		let { tenantId } = s.parse(Params, ctx.params);

		let opened = await openPortal(ctx.models, polar, { tenantId });

		if (!opened.ok) {
			if (opened.reason === "billing_error") {
				return badGateway({ error: opened.reason, message: opened.error.message });
			}

			return notFound({ error: opened.reason });
		}

		return redirect(opened.url, { status: redirect.Status.SeeOther });
	},
});
