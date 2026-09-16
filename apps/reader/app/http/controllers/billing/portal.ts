/**
 * `POST /billing/portal` — hands the reader to the hosted page where a card, an invoice
 * and a cancellation are dealt with. Updating a card is the platform's job, and this app
 * never sees one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { CONNECTION, failureFields, polar } from "~/app/lib/billing";
import { findBillingCustomer } from "~/database/registry";
import routes from "~/routes/web";

/**
 * POST /billing/portal — opens the platform's own billing page for this reader.
 *
 * A reader who has never bought anything has no page to open, so they are returned to the
 * settings panel where the offer is.
 */
export default createAction(routes.billing.portal, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();

		/** The guard has already answered an anonymous request, so this holds a reader's id. */
		if (!viewer) return redirect(routes.home.href(), { status: redirect.Status.SeeOther });

		let customer = await findBillingCustomer(viewer.id, CONNECTION);
		if (customer === null) return back();

		let portal = await polar.portal.create({
			customer: { id: customer.provider_customer_id },
			returnTo: new URL(routes.settings.href(), ctx.url).toString(),
		});

		if (isFailure(portal)) {
			ctx.log.fail(portal.error, { billing: failureFields(portal.error) });
			return back();
		}

		return redirect(portal.data.url, { status: redirect.Status.SeeOther });
	},
});

/** Where a reader with no page to open is left, which is where they pressed from. */
function back(): Response {
	return redirect(routes.settings.href(), { status: redirect.Status.SeeOther });
}
