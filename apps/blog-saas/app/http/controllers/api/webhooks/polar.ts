/**
 * The Polar webhook controller: verifies incoming billing events, keeps the local
 * account/subscription state in sync, and fans entitlement changes out to the
 * account's blogs (activating them on entitling events, suspending them on cancel).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { json } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Account from "~/app/models/account";
import Subscription, { type SubscriptionStatus } from "~/app/models/subscription";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
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

/**
 * Webhook handler for `POST /api/webhooks/polar`: verifies the signature, then on
 * subscription create/update events upserts the subscription and activates the
 * account's blogs when entitled or suspends them when the status is non-entitling
 * (so a downgrade delivered as `subscription.updated` takes effect immediately), and
 * on cancel/revoke events suspends them.
 *
 * @returns `401` for an invalid signature, otherwise `{ received: true }` JSON
 *   (including for ignored events referencing unknown accounts).
 */
export default createAction(
	routes.api.webhooks.polar,
	inject([Database, PolarClient, BlogProvisioner] as const, async (db, polar, provisioner) => {
		let ctx = getContext();
		let body = await ctx.request.text();
		if (!polar.verifyWebhook(ctx.request, body, env.POLAR_WEBHOOK_SECRET))
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
				await Subscription.upsert(db, accountId, {
					polar_subscription_id: data.id ?? null,
					polar_product_id: data.product_id ?? null,
					status,
					current_period_start: data.current_period_start ?? null,
					current_period_end: data.current_period_end ?? null,
				});
				// Only our configured product with an entitling status keeps blogs serving;
				// anything else (different product, or a status that moved to past_due/
				// unpaid/canceled/etc. on this same update event) must suspend the account's
				// blogs now rather than waiting for a separate cancel/revoke event.
				let target = webhookBlogStatus(data.product_id, status, env.POLAR_PRODUCT_ID);
				await provisioner.setAccountBlogsStatus(accountId, target);
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
 *
 * @param status The raw status string from the Polar event (may be undefined).
 * @returns The corresponding {@link SubscriptionStatus}, or `past_due` if unknown.
 * @example
 * normalizeStatus("trialing"); // "trialing"
 * normalizeStatus("mystery"); // "past_due"
 */
export function normalizeStatus(status: string | undefined): SubscriptionStatus {
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

/**
 * Decides whether a subscription event should activate an account's blogs. Requires
 * both that the event references our configured product (a different product must
 * never grant entitlement) and that the normalized status is entitling.
 *
 * @param productId The product id from the event (may be undefined).
 * @param status The normalized subscription status.
 * @param configuredProductId The platform's configured product id to match against.
 * @returns `true` only if the product matches and the status is `active`/`trialing`.
 */
export function entitlesActivation(
	productId: string | undefined,
	status: SubscriptionStatus,
	configuredProductId: string,
): boolean {
	let productMatches = productId === configuredProductId;
	return productMatches && (status === "active" || status === "trialing");
}

/**
 * Decides the blog status a create/update subscription event must fan out to the
 * account's blogs: `active` when the event {@link entitlesActivation entitles}
 * activation, otherwise `suspended`. Returning `suspended` for every non-entitling
 * event is what makes an `active → past_due`/`unpaid`/`canceled` transition delivered
 * as a `subscription.updated` take effect immediately, instead of leaving blogs
 * serving until a later cancel/revoke event.
 *
 * @param productId The product id from the event (may be undefined).
 * @param status The normalized subscription status.
 * @param configuredProductId The platform's configured product id to match against.
 * @returns `"active"` when entitled, otherwise `"suspended"`.
 * @example
 * webhookBlogStatus("prod_x", "active", "prod_x"); // "active"
 * webhookBlogStatus("prod_x", "past_due", "prod_x"); // "suspended"
 */
export function webhookBlogStatus(
	productId: string | undefined,
	status: SubscriptionStatus,
	configuredProductId: string,
): "active" | "suspended" {
	return entitlesActivation(productId, status, configuredProductId) ? "active" : "suspended";
}
