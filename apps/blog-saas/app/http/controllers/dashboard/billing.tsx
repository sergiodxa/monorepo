/**
 * The `/dashboard/billing` controller: shows the account's subscription status and,
 * on submit, sends the owner to the right hosted page — the billing portal once they
 * are a customer, otherwise a checkout that starts the subscription.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { supports } from "@sdxc/billing";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAccountId } from "~/app/http/middleware/session";
import { PRO_PRODUCT } from "~/app/lib/billing";
import Account from "~/app/models/account";
import BillingCustomer from "~/app/models/billing-customer";
import Subscription from "~/app/models/subscription";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/**
 * Billing controller for `/dashboard/billing`: `index` renders subscription status
 * and the portal/checkout button; `action` redirects to the hosted page, falling back
 * to the billing page when the platform cannot open one.
 *
 * @returns The billing page (`index`), or a redirect to the hosted page or
 *   `/auth/login` (`action`).
 */
export default createController(routes.dashboard.billing, {
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let accountId = getAccountId();
			if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

			let [customer, subscription] = await Promise.all([
				BillingCustomer.findDefault(db, accountId),
				Subscription.findByAccount(db, accountId),
			]);

			return ctx.render(
				<Page title="Billing">
					<p>
						<a href="/dashboard">← Dashboard</a>
					</p>
					<h1>Billing</h1>
					<p>
						Current status: <strong>{subscription?.status ?? "none"}</strong>
					</p>
					<p mix={[s.muted]}>
						A base monthly fee includes a generous page-view allowance pooled across all your blogs;
						overage is metered.
					</p>
					<form method="post" action="/dashboard/billing" data-rmx-document="">
						{customer ? (
							<button mix={[s.button]} type="submit" name="intent" value="portal">
								Manage billing
							</button>
						) : (
							<button mix={[s.button]} type="submit" name="intent" value="checkout">
								Start subscription
							</button>
						)}
					</form>
				</Page>,
			);
		}),

		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let accountId = getAccountId();
			if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

			let origin = new URL(ctx.request.url).origin;
			let customer = await BillingCustomer.findDefault(db, accountId);

			if (customer && supports(ctx.billing, "portal")) {
				let session = await ctx.billing.portal.create({
					customer: { id: customer.provider_customer_id },
					returnTo: `${origin}/dashboard/billing`,
				});

				if (isFailure(session)) {
					ctx.logger.error("billing.portal_failed", {
						code: session.error.code,
						providerCode: session.error.providerCode,
					});

					return redirect("/dashboard/billing", { status: redirect.Status.SeeOther });
				}

				return redirect(session.data.url, { status: redirect.Status.SeeOther });
			}

			let account = await Account.findById(db, accountId);

			let checkout = await ctx.billing.checkouts.create({
				product: PRO_PRODUCT,
				customer: { externalId: accountId },
				email: account?.email,
				returnTo: `${origin}/dashboard`,
			});

			if (isFailure(checkout)) {
				ctx.logger.error("billing.checkout_failed", {
					code: checkout.error.code,
					providerCode: checkout.error.providerCode,
				});

				return redirect("/dashboard/billing", { status: redirect.Status.SeeOther });
			}

			if (checkout.data.url === null) {
				return redirect("/dashboard/billing", { status: redirect.Status.SeeOther });
			}

			return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
		}),
	},
});
