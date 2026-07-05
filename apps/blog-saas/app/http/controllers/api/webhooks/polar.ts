import { json } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Account from "~/app/models/account";
import Subscription, { type SubscriptionStatus } from "~/app/models/subscription";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
import { PolarService } from "~/app/services/polar";
import routes from "~/routes/web";

/** Shape of the Polar webhook payload fields this handler reads. */
interface PolarEvent {
	type: string;
	data?: {
		id?: string;
		customer_id?: string;
		product_id?: string;
		status?: string;
		current_period_start?: string;
		current_period_end?: string;
		metadata?: { account_id?: string };
	};
}

/** POST /api/webhooks/polar — syncs subscription state and fans suspension out. */
export default createAction(
	routes.api.webhooks.polar,
	inject([Database, PolarService, BlogProvisioner] as const, async (db, polar, provisioner) => {
		let ctx = getContext();
		let body = await ctx.request.text();
		if (!polar.verifyWebhook(ctx.request, body))
			return new Response("invalid signature", { status: 401 });

		let event = JSON.parse(body) as PolarEvent;
		let data = event.data ?? {};
		let accountId = data.metadata?.account_id;
		if (!accountId) return json({ received: true });

		// The account_id comes from metadata we set at checkout, but only act on it if the
		// account actually exists (ignore events referencing unknown/removed accounts).
		let account = await Account.findById(db, accountId);
		if (!account) return json({ received: true });

		if (data.customer_id) await Account.setPolarCustomerId(db, accountId, data.customer_id);

		switch (event.type) {
			case "checkout.completed":
			case "subscription.created":
			case "subscription.active":
			case "subscription.updated": {
				let status = normalizeStatus(data.status);
				// Only our configured product grants entitlement; a different product must
				// never activate blogs even if the event is otherwise valid.
				let productMatches = data.product_id === env.POLAR_PRODUCT_ID;
				await Subscription.upsert(db, accountId, {
					polar_subscription_id: data.id ?? null,
					polar_product_id: data.product_id ?? null,
					status,
					current_period_start: data.current_period_start ?? null,
					current_period_end: data.current_period_end ?? null,
				});
				if (productMatches && (status === "active" || status === "trialing")) {
					await provisioner.setAccountBlogsStatus(accountId, "active");
				}
				break;
			}
			case "subscription.canceled":
			case "subscription.revoked": {
				await Subscription.upsert(db, accountId, { status: "canceled" });
				await provisioner.setAccountBlogsStatus(accountId, "suspended");
				break;
			}
		}

		return json({ received: true });
	}),
);

/**
 * Maps a Polar status string to our subscription status enum. Unknown statuses fail
 * closed to `past_due` (no entitlement granted) rather than defaulting to `active`.
 */
function normalizeStatus(status: string | undefined): SubscriptionStatus {
	switch (status) {
		case "active":
		case "trialing":
		case "past_due":
		case "canceled":
		case "unpaid":
			return status;
		default:
			return "past_due";
	}
}
