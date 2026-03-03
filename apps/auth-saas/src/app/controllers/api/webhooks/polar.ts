import type { JSONValue } from "@pkg/types";

import { json } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import Subscription from "~/app/models/subscription";
import action from "~/lib/action";

/**
 * Polar webhook event types we handle.
 */
let HANDLED_EVENT_TYPES = [
	"checkout.completed",
	"subscription.active",
	"subscription.canceled",
	"subscription.updated",
] as const;
type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

/**
 * Subscription status values from Polar.
 */
let SUBSCRIPTION_STATUSES = ["active", "canceled", "past_due"] as const;
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Type guard to check if event type is one we handle.
 */
function isHandledEventType(type: string): type is HandledEventType {
	return HANDLED_EVENT_TYPES.includes(type as HandledEventType);
}

/**
 * Type guard to check if status is a valid subscription status.
 */
function isValidSubscriptionStatus(status: string | undefined): status is SubscriptionStatus {
	return status !== undefined && SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus);
}

/**
 * Base webhook payload schema.
 */
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
 * Verify Polar webhook signature.
 * Polar uses HMAC-SHA256 with the webhook secret.
 */
async function verifyWebhookSignature(
	body: string,
	signature: string | null,
	secret: string,
): Promise<boolean> {
	if (!signature) return false;

	let encoder = new TextEncoder();
	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	let signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
	let expectedSignature = Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Constant-time comparison
	if (signature.length !== expectedSignature.length) return false;

	let result = 0;
	for (let i = 0; i < signature.length; i++) {
		result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
	}
	return result === 0;
}

/**
 * Polar webhook handler.
 * Receives events from Polar for subscription lifecycle management.
 *
 * Events handled:
 * - checkout.completed: Link subscription to tenant after checkout
 * - subscription.active: Handle subscription activation
 * - subscription.canceled: Handle subscription cancellation
 * - subscription.updated: Sync subscription status changes
 */
export default action<"POST", "/api/webhooks/polar">(async ({ db, request, logger }) => {
	let log = logger.action("/api/webhooks/polar");

	// Read body as text for signature verification
	let body = await request.text();

	// Verify webhook signature (required in production)
	let signature = request.headers.get("X-Polar-Signature");
	let webhookSecret = env.POLAR_WEBHOOK_SECRET;

	if (!webhookSecret && !import.meta.env.DEV) {
		log.error("POLAR_WEBHOOK_SECRET not configured in production");
		return json({ error: "Webhook secret not configured" }, { status: 500 });
	}

	if (webhookSecret) {
		let isValid = await verifyWebhookSignature(body, signature, webhookSecret);
		if (!isValid) {
			log.info("Invalid webhook signature");
			return json({ error: "Invalid signature" }, { status: 401 });
		}
	}

	// Parse and validate payload
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

	// Check if this is an event type we handle
	if (!isHandledEventType(type)) {
		log.info("Unhandled webhook event type", { type });
		return json({ received: true });
	}

	try {
		switch (type) {
			case "checkout.completed": {
				// After checkout, link the subscription to the tenant
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
				// Find subscription by Polar subscription ID and sync status
				let subscriptions = await db.findMany(Subscription.table, {
					where: { polar_subscription_id: data.id },
				});

				if (subscriptions.length > 0) {
					let subscription = subscriptions[0]!;
					// Only update status if it's a valid status value
					let newStatus = isValidSubscriptionStatus(data.status)
						? data.status
						: subscription.status;
					await db.update(
						Subscription.table,
						{ id: subscription.id },
						{
							status: newStatus,
							current_period_start: data.current_period_start ?? subscription.current_period_start,
							current_period_end: data.current_period_end ?? subscription.current_period_end,
							updated_at: new Date().toISOString(),
						},
					);
					log.info("Subscription status synced", {
						subscriptionId: subscription.id,
						status: newStatus,
					});
				}
				break;
			}

			case "subscription.canceled": {
				// Find and mark subscription as canceled
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
					log.info("Subscription canceled", { subscriptionId: subscription.id });
				}
				break;
			}
		}
	} catch (error) {
		// Determine if this is a retryable error
		// Database errors and network issues should be retried
		// Validation errors should not be retried
		let isRetryable = isRetryableError(error);

		log.error("Webhook processing failed", {
			type,
			error: error instanceof Error ? error.message : String(error),
			retryable: isRetryable,
		});

		if (isRetryable) {
			// Return 500 to allow Polar to retry
			return json({ error: "Processing failed, please retry" }, { status: 500 });
		}

		// Non-retryable errors return 200 to prevent infinite retries
	}

	return json({ received: true });
});

/**
 * Determines if an error is retryable (transient) vs permanent.
 * Network errors, database timeouts, etc. should be retried.
 * Validation errors, not found errors should not be retried.
 */
function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	let message = error.message.toLowerCase();

	// Database/network errors are retryable
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

	// D1 specific errors
	if (message.includes("d1_error") || message.includes("database")) {
		return true;
	}

	// Everything else is non-retryable (validation errors, etc.)
	return false;
}
