import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";

import { getAccountId } from "~/app/http/middleware/session";
import action from "~/app/lib/action";
import { platformDb } from "~/app/lib/db";
import { renderDocument } from "~/app/lib/render";
import Account from "~/app/models/account";
import Subscription from "~/app/models/subscription";
import { PolarService } from "~/app/services/polar";
import { Page } from "~/app/views/layout";

/** GET /dashboard/billing — subscription status + checkout/portal entry points. */
export const index = action<"GET", "/dashboard/billing">(async () => {
	let accountId = getAccountId();
	if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

	let db = platformDb();
	let [account, subscription] = await Promise.all([
		Account.findById(db, accountId),
		Subscription.findByAccount(db, accountId),
	]);

	let body = await renderDocument(
		<Page title="Billing">
			<p>
				<a href="/dashboard">← Dashboard</a>
			</p>
			<h1>Billing</h1>
			<p>
				Current status: <strong>{subscription?.status ?? "none"}</strong>
			</p>
			<p class="muted">
				A base monthly fee includes a generous page-view allowance pooled across all your blogs;
				overage is metered.
			</p>
			<form method="post" action="/dashboard/billing">
				{account?.polar_customer_id ? (
					<button type="submit" name="intent" value="portal">
						Manage billing
					</button>
				) : (
					<button type="submit" name="intent" value="checkout">
						Start subscription
					</button>
				)}
			</form>
		</Page>,
	);
	return ok(body);
});

/** POST /dashboard/billing — opens Polar checkout or the customer portal. */
export const action_ = action<"POST", "/dashboard/billing">(async ({ request }) => {
	let accountId = getAccountId();
	if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

	let db = platformDb();
	let account = await Account.findById(db, accountId);
	let polar = new PolarService();
	let origin = new URL(request.url).origin;

	if (account?.polar_customer_id) {
		let portal = await polar.portalUrl(account.polar_customer_id);
		if (portal) return redirect(portal, { status: redirect.Status.SeeOther });
	} else {
		let checkout = await polar.createCheckout(accountId, `${origin}/dashboard`);
		if (checkout) return redirect(checkout, { status: redirect.Status.SeeOther });
	}
	return redirect("/dashboard/billing", { status: redirect.Status.SeeOther });
});
