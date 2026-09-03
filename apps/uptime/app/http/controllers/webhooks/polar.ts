/**
 * Billing webhook endpoint: `POST /webhooks/polar`. The single write point for the local
 * projection of subscription state (ADR-005), and the reason the every-minute scheduler asks
 * the platform nothing at all: a delivery lands here once and the owner's monitors are moved
 * immediately.
 *
 * Unauthenticated by the auth chain's standards — the sender has no session and no `Origin` —
 * so the signature over the raw body is the authentication, checked by the endpoint before any
 * handler below runs. See `bootstrap/app.tsx` for how the `/webhooks/` prefix is exempted from
 * cross-origin protection.
 *
 * Every handler does the same thing on purpose: it re-reads the customer's entitlement
 * snapshot rather than applying the delivery as a diff, because a delivery says *that*
 * something changed and only the snapshot says what is now true.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CustomerRef } from "@pkg/billing";
import type { RequestContext } from "remix/router";

import { BillingWebhook } from "@pkg/billing";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import TrialConversion from "~/app/data/trial-conversion";
import WebhookDeliveries from "~/app/data/webhook-delivery";
import { polar } from "~/app/lib/billing";
import { syncEntitlements } from "~/app/services/entitlements";
import { attributionProperties, trackSubscriptionStarted } from "~/app/services/funnel-events";

/** Milliseconds in a day, for the days-to-convert figure the funnel event carries. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The delivery log, opened per call from the request's own database so the endpoint costs no
 * connection at module scope and its statements land on the request's cost ledger.
 */
const deliveries = new WebhookDeliveries(() => getServiceContainer().get(Database));

/**
 * Re-reads the customer the delivery named and writes what the platform says, then records a
 * first payment. Throws on a failed read so the endpoint answers `503` and the platform
 * delivers again; the daily sweep repairs whatever never arrives.
 */
async function apply(ctx: RequestContext, customerId: string | null): Promise<void> {
	if (customerId === null) {
		/**
		 * A delivery about no payer at all names nothing this projection is keyed on, so there
		 * is no owner whose monitors it could apply to.
		 */
		return ctx.logger.error("webhook.polar.unnamed_customer");
	}

	let customer: CustomerRef = { id: customerId };
	let db = getServiceContainer().get(Database);
	let synced = await syncEntitlements(db, customer);

	if (isFailure(synced)) throw synced.error;

	if (synced.data === null) {
		/**
		 * A platform customer with no external id was never linked to a signed-in subject, so
		 * nothing here can be attributed to an owner.
		 */
		return ctx.logger.error("webhook.polar.unlinked_customer", { customerId });
	}

	let { ownerId, applied, entitled, monitors } = synced.data;

	/**
	 * The only place that learns an account started paying: `markPaid` stamps a row only while
	 * `paid_at` is null, so monthly renewals can't move the conversion instant; a missing trial
	 * row is a routine no-op.
	 */
	let firstPayment = entitled && (await TrialConversion.markPaid(db, ownerId));

	if (firstPayment) await trackConversion(ctx, db, ownerId, monitors);

	ctx.logger.info("webhook.polar.synced", {
		ownerId,
		applied,
		entitled,
		monitors,
		firstPayment,
	});
}

/**
 * Fires once per customer, since `markPaid` stamps `paid_at` only the first time. Campaign
 * fields reflect the sign-in attribution on the conversion row, absent for direct signups.
 */
async function trackConversion(
	ctx: RequestContext,
	db: Database,
	ownerId: string,
	monitors: number,
): Promise<void> {
	let conversion = await TrialConversion.findByOwner(db, ownerId);

	trackSubscriptionStarted(ctx.logger, {
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

export default new BillingWebhook(
	polar,
	{
		async "customer.created"(event, ctx) {
			await apply(ctx, event.customer.id);
		},

		/** Also where `customer.state_changed` lands, which is the broadest trigger there is. */
		async "customer.updated"(event, ctx) {
			await apply(ctx, event.customer.id);
		},

		async "subscription.activated"(event, ctx) {
			await apply(ctx, event.subscription.customerId);
		},

		async "subscription.updated"(event, ctx) {
			await apply(ctx, event.subscription.customerId);
		},

		async "subscription.canceled"(event, ctx) {
			await apply(ctx, event.subscription.customerId);
		},

		async "subscription.revoked"(event, ctx) {
			await apply(ctx, event.subscription.customerId);
		},

		async "order.paid"(event, ctx) {
			await apply(ctx, event.order.customerId);
		},
	},
	{ store: deliveries },
);
