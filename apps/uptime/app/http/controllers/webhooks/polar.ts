/**
 * Polar webhook endpoint: `POST /webhooks/polar`. The single write point for the local
 * projection of subscription state (ADR-005), and the reason the every-minute scheduler
 * asks Polar nothing at all: a billing event lands here once and is applied to the
 * owner's monitors immediately, instead of being re-derived per check.
 *
 * Unauthenticated by the auth chain's standards — Polar has no session and no
 * `Origin` — so the signature over the raw body *is* the authentication. `parseWebhook`
 * fails closed on a missing secret or a bad signature, and nothing reaches the upsert
 * before it succeeds. See `bootstrap/app.tsx` for how the `/webhooks/` prefix is exempted
 * from cross-origin protection.
 *
 * Both directions of the response matter to Polar: it retries a non-2xx delivery, so an
 * event this app does not model answers 200 (there is nothing to retry) while a rejected
 * signature answers 400.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok } from "@pkg/http/response/json";
import { logger } from "@pkg/logger";
import { isActiveSubscriptionStatus, PolarClient, subscriptionFromEvent } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Subscription, { SUBSCRIPTION_PRODUCT_ID } from "~/app/data/subscription";
import routes from "~/routes/web";

/** POST /webhooks/polar */
export default createAction(routes.webhooks.polar, {
	handler: async (ctx) => {
		let polar = getServiceContainer().get(PolarClient);
		let db = getServiceContainer().get(Database);

		let result = polar.parseWebhook(
			ctx.request,
			await ctx.request.text(),
			env.POLAR_WEBHOOK_SECRET,
		);

		if (isFailure(result)) {
			logger.error("webhook.polar.rejected", { reason: result.error.message });
			return badRequest({ error: result.error.message });
		}

		let subscription = subscriptionFromEvent(result.data);

		// Every other event type Polar sends (orders, checkouts, benefit grants) and any
		// subscription to a product this app doesn't sell monitoring through.
		if (!subscription || subscription.productId !== SUBSCRIPTION_PRODUCT_ID) {
			return ok({ ignored: true });
		}

		let ownerId = subscription.customer.externalId;
		if (!ownerId) {
			// A Polar customer with no external id was never linked to a signed-in subject, so
			// there is no owner whose monitors this event could apply to.
			logger.error("webhook.polar.unlinked_customer", {
				subscriptionId: subscription.id,
				customerId: subscription.customerId,
			});
			return ok({ ignored: true });
		}

		if (!(await Subscription.upsert(db, ownerId, subscription))) {
			// A newer payload for this subscription is already stored: Polar retries and its
			// events can arrive out of order, so applying this one would move the projection
			// backwards and reschedule from a stale status.
			logger.info("webhook.polar.stale_event", {
				type: result.data.type,
				subscriptionId: subscription.id,
			});
			return ok({ ignored: true });
		}

		let entitled = isActiveSubscriptionStatus(subscription.status);
		let monitors = await Subscription.applyEntitlement(db, ownerId, entitled);

		logger.info("webhook.polar.subscription", {
			type: result.data.type,
			ownerId,
			status: subscription.status,
			entitled,
			monitors,
		});

		return ok({ received: true });
	},
});
