/**
 * Polar webhook endpoint: `POST /webhooks/polar`. The single write point for
 * the local projection of subscription state (ADR-005), and the reason the
 * every-minute scheduler asks Polar nothing at all: a billing event lands
 * here once and is applied to the owner's monitors immediately.
 *
 * Unauthenticated by the auth chain's standards — Polar has no session and
 * no `Origin` — so the signature over the raw body is the authentication.
 * See `bootstrap/app.tsx` for how the `/webhooks/` prefix is exempted from
 * cross-origin protection.
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
import { createAction } from "remix/router";

import Subscription, { SUBSCRIPTION_PRODUCT_ID } from "~/app/data/subscription";
import TrialConversion from "~/app/data/trial-conversion";
import { attributionProperties, trackSubscriptionStarted } from "~/app/services/funnel-events";
import routes from "~/routes/web";

/** Milliseconds in a day, for the days-to-convert figure the funnel event carries. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default createAction(routes.webhooks.polar, {
	handler: async (ctx) => {
		let polar = getServiceContainer().get(PolarClient);
		let db = getServiceContainer().get(Database);

		let result = await polar.parseWebhook(
			ctx.request,
			await ctx.request.text(),
			env.POLAR_WEBHOOK_SECRET,
		);

		if (isFailure(result)) {
			logger.error("webhook.polar.rejected", { reason: result.error.message });
			return badRequest({ error: result.error.message });
		}

		let subscription = subscriptionFromEvent(result.data);

		/**
		 * Every other event type Polar sends (orders, checkouts, benefit grants)
		 * and any subscription to a product this app doesn't sell monitoring
		 * through.
		 */
		if (!subscription || subscription.productId !== SUBSCRIPTION_PRODUCT_ID) {
			return ok({ ignored: true });
		}

		let ownerId = subscription.customer.externalId;
		if (!ownerId) {
			/**
			 * A Polar customer with no external id was never linked to a
			 * signed-in subject, so there is no owner whose monitors this event
			 * could apply to.
			 */
			logger.error("webhook.polar.unlinked_customer", {
				subscriptionId: subscription.id,
				customerId: subscription.customerId,
			});
			return ok({ ignored: true });
		}

		if (!(await Subscription.upsert(db, ownerId, subscription))) {
			/**
			 * A newer payload for this subscription is already stored: Polar's
			 * retries can arrive out of order, and applying this one would move
			 * the projection backwards, rescheduling from a stale status.
			 */
			logger.info("webhook.polar.stale_event", {
				type: result.data.type,
				subscriptionId: subscription.id,
			});
			return ok({ ignored: true });
		}

		let entitled = isActiveSubscriptionStatus(subscription.status);
		let monitors = await Subscription.applyEntitlement(db, ownerId, entitled);

		/**
		 * The only place that learns an account started paying: `markPaid`
		 * stamps a row only while `paid_at` is null, so monthly renewals
		 * can't move the conversion instant; a missing trial row is a routine no-op.
		 */
		let firstPayment = entitled && (await TrialConversion.markPaid(db, ownerId));

		/**
		 * Fires once per customer: `markPaid` stamps `paid_at` only the first
		 * time, so renewals never refire it. Campaign fields reflect the
		 * sign-in attribution on the conversion row, absent for direct signups.
		 */
		if (firstPayment) {
			let conversion = await TrialConversion.findByOwner(db, ownerId);

			trackSubscriptionStarted(logger, {
				ownerId,
				fromTrial: conversion !== null,
				monitorCount: monitors,
				daysToConvert:
					conversion === null
						? null
						: Math.floor((Date.now() - conversion.lead_created_at) / MS_PER_DAY),
				...attributionProperties(
					conversion === null
						? undefined
						: {
								landingPath: conversion.landing_path,
								source: conversion.campaign_source,
								campaign: conversion.campaign_name,
							},
				),
			});
		}

		logger.info("webhook.polar.subscription", {
			type: result.data.type,
			ownerId,
			status: subscription.status,
			entitled,
			monitors,
			firstPayment,
		});

		return ok({ received: true });
	},
});
