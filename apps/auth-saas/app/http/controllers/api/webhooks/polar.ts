/**
 * `POST /api/webhooks/polar` — receives Polar billing webhooks and syncs subscription
 * lifecycle changes (checkout completion, activation, updates, cancellation) into the
 * local {@link Subscription} store. Verifies the Standard Webhooks signature and uses
 * retryable/non-retryable error classification to control Polar's redelivery.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@pkg/types";

import { json } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Subscription from "~/app/models/subscription";
import { TenantApiService } from "~/app/services/tenant-api";
import routes from "~/routes/web";

/** Polar webhook event types we handle. */
let HANDLED_EVENT_TYPES = [
	"checkout.completed",
	"subscription.active",
	"subscription.canceled",
	"subscription.updated",
] as const;

/** Union type of handled Polar webhook event types. */
type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

/**
 * Type guard to check if event type is one we handle.
 * @param type - The event type string to check.
 * @returns True if the type is a handled event type.
 */
function isHandledEventType(type: string): type is HandledEventType {
	return HANDLED_EVENT_TYPES.includes(type as HandledEventType);
}

/** Base webhook payload schema for Polar webhooks. */
let WebhookPayloadSchema = s.object({
	type: s.string(),
	data: s.object({
		id: s.string(),
		customer_id: s.optional(s.string()),
		subscription_id: s.optional(s.string()),
		status: s.optional(s.string()),
		current_period_start: s.optional(s.string()),
		current_period_end: s.optional(s.string()),
		metadata: s.optional(s.record(s.string(), s.string())),
	}),
});

/**
 * Polar webhook handler for subscription lifecycle management.
 *
 * Events handled:
 * - checkout.completed: Link subscription to tenant after checkout
 * - subscription.active: Handle subscription activation
 * - subscription.canceled: Handle subscription cancellation
 * - subscription.updated: Sync subscription status changes
 *
 * @returns A JSON acknowledgement (`{ received: true }`), or a `4xx`/`5xx` error for
 * an invalid signature, malformed payload, or a retryable processing failure.
 * @example
 * router.map(routes.api.webhooks.polar, polarWebhook);
 */
export default createAction(
	routes.api.webhooks.polar,
	inject([Database] as const, async (db) => {
		let { request, logger } = getContext();
		let log = logger.action("/api/webhooks/polar");

		let body = await request.text();
		let webhookSecret = env.POLAR_WEBHOOK_SECRET;

		if (!webhookSecret) {
			if (!import.meta.env.DEV) {
				log.error("POLAR_WEBHOOK_SECRET not configured in production");
				return json({ error: "Webhook secret not configured" }, { status: 500 });
			}
		} else {
			// Polar signs webhooks with the Standard Webhooks scheme (webhook-id,
			// webhook-timestamp, webhook-signature headers). `verifyWebhook` fails closed
			// on a bad/missing signature and accepts an authentic-but-unmodeled event
			// (whose payload our own schema validation below still handles).
			let polar = new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN });
			if (!(await polar.verifyWebhook(request, body, webhookSecret))) {
				log.info("Invalid webhook signature");
				return json({ error: "Invalid signature" }, { status: 401 });
			}
		}

		let payload: unknown;
		try {
			payload = JSON.parse(body);
		} catch {
			log.info("Invalid JSON payload");
			return json({ error: "Invalid JSON" }, { status: 400 });
		}

		let result = await validate(payload as JSONValue, WebhookPayloadSchema);
		if (isFailure(result)) {
			log.info("Invalid webhook payload", { issues: result.error.issues.length });
			return json({ error: "Invalid payload" }, { status: 400 });
		}

		let { type, data } = result.data;

		log.info("Webhook received", { type, dataId: data.id });

		if (!isHandledEventType(type)) {
			log.info("Unhandled webhook event type", { type });
			return json({ received: true });
		}

		try {
			switch (type) {
				case "checkout.completed": {
					let tenantId = data.metadata?.tenant_id;
					let subscriptionId = data.subscription_id;

					if (tenantId && subscriptionId) {
						await Subscription.linkPolarSubscription(db, tenantId, subscriptionId);
						log.info("Subscription linked after checkout", { tenantId, subscriptionId });
					} else {
						log.info("Checkout completed but missing tenant_id or subscription_id", {
							tenantId,
							subscriptionId,
						});
					}
					break;
				}

				case "subscription.active":
				case "subscription.updated": {
					let subscriptions = await db.findMany(Subscription.table, {
						where: { polar_subscription_id: data.id },
					});

					if (subscriptions.length > 0) {
						let subscription = subscriptions[0]!;
						// Map every Polar status through the canonical mapper so transitions
						// to unpaid/incomplete/trialing (all valid enum values) are synced,
						// not just active/canceled/past_due. Missing status keeps the current.
						let newStatus = data.status
							? Subscription.mapPolarStatus(data.status)
							: subscription.status;
						await db.update(
							Subscription.table,
							{ id: subscription.id },
							{
								status: newStatus,
								current_period_start:
									data.current_period_start ?? subscription.current_period_start,
								current_period_end: data.current_period_end ?? subscription.current_period_end,
								updated_at: new Date().toISOString(),
							},
						);
						// Propagate the runtime entitlement gate: a status that no longer
						// entitles the tenant (e.g. active -> unpaid) must suspend its provider
						// surface, and a recovery (e.g. past_due -> active) must lift it.
						await syncTenantSuspension(subscription.tenant_id, newStatus);
						log.info("Subscription status synced", {
							subscriptionId: subscription.id,
							status: newStatus,
						});
					}
					break;
				}

				case "subscription.canceled": {
					let subscriptions = await db.findMany(Subscription.table, {
						where: { polar_subscription_id: data.id },
					});

					if (subscriptions.length > 0) {
						let subscription = subscriptions[0]!;
						await db.update(
							Subscription.table,
							{ id: subscription.id },
							{
								status: "canceled",
								updated_at: new Date().toISOString(),
							},
						);
						// A canceled subscription never entitles the tenant: suspend its
						// provider surface so tenant OIDC traffic stops, not just dashboard access.
						await syncTenantSuspension(subscription.tenant_id, "canceled");
						log.info("Subscription canceled", { subscriptionId: subscription.id });
					}
					break;
				}
			}
		} catch (error) {
			/**
			 * Database and network errors should be retried.
			 * Validation errors should not be retried to prevent infinite loops.
			 */
			let isRetryable = isRetryableError(error);

			log.error("Webhook processing failed", {
				type,
				error: error instanceof Error ? error.message : String(error),
				retryable: isRetryable,
			});

			if (isRetryable) {
				return json({ error: "Processing failed, please retry" }, { status: 500 });
			}

			/** Non-retryable errors return 200 to prevent Polar from retrying indefinitely. */
		}

		return json({ received: true });
	}),
);

/**
 * Pushes the tenant-runtime entitlement gate into the tenant Durable Object to match the
 * new subscription status, so a lapsed subscription stops the tenant's OIDC provider
 * surface (not just dashboard access) and a recovery restores it.
 *
 * Runs inside the webhook's try/catch, so a transient Durable Object failure propagates
 * and is classified as retryable, letting Polar redeliver until the gate is applied.
 *
 * @param tenantId - The tenant whose Durable Object gate to update.
 * @param status - The tenant's new local subscription status.
 * @returns A promise that resolves once the gate is pushed.
 */
async function syncTenantSuspension(tenantId: string, status: string): Promise<void> {
	await new TenantApiService(tenantId).setSuspended(!Subscription.isEntitled(status));
}

/**
 * Determines if an error is retryable (transient) vs permanent.
 * @param error - The error to check.
 * @returns True if the error is retryable (network/database issues), false for permanent errors.
 */
function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	let message = error.message.toLowerCase();

	if (
		message.includes("timeout") ||
		message.includes("connection") ||
		message.includes("network") ||
		message.includes("unavailable") ||
		message.includes("econnrefused") ||
		message.includes("econnreset")
	) {
		return true;
	}

	if (message.includes("d1_error") || message.includes("database")) {
		return true;
	}

	return false;
}
