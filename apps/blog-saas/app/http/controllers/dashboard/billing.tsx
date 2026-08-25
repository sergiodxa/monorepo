/**
 * The `/dashboard/billing` controller: shows the account's subscription status and,
 * on submit, sends the owner to the right Polar surface — the customer portal if they
 * already have a Polar customer, otherwise a checkout session to start a subscription.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { redirect } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAccountId } from "~/app/http/middleware/session";
import Account from "~/app/models/account";
import Subscription from "~/app/models/subscription";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/**
 * Billing controller for `/dashboard/billing`: `index` renders subscription status
 * and the portal/checkout button; `action` redirects to the Polar portal or checkout
 * (falling back to the billing page if Polar is unavailable).
 *
 * @returns The billing page (`index`), or a redirect to Polar or `/auth/login`
 *   (`action`).
 */
export default createController(routes.dashboard.billing, {
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let accountId = getAccountId();
			if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

			let [account, subscription] = await Promise.all([
				Account.findById(db, accountId),
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
					<form method="post" action="/dashboard/billing">
						{account?.polar_customer_id ? (
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

		action: inject([Database, PolarClient] as const, async (db, polar) => {
			let ctx = getContext();
			let accountId = getAccountId();
			if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

			let account = await Account.findById(db, accountId);
			let origin = new URL(ctx.request.url).origin;

			try {
				if (account?.polar_customer_id) {
					let { url } = await polar.createPortalSession(account.polar_customer_id);
					return redirect(url, { status: redirect.Status.SeeOther });
				} else {
					let { url } = await polar.createCheckoutSession(
						env.POLAR_PRODUCT_ID,
						undefined,
						`${origin}/dashboard`,
						{ account_id: accountId },
					);
					return redirect(url, { status: redirect.Status.SeeOther });
				}
			} catch {
				return redirect("/dashboard/billing", { status: redirect.Status.SeeOther });
			}
		}),
	},
});
