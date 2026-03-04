import type { JSONValue } from "@pkg/types";

import { json } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import Subscription from "~/app/models/subscription";
import action from "~/lib/action";

/** Polar webhook event types we handle. */
let HANDLED_EVENT_TYPES = [
	"checkout.completed",
	"subscription.active",
	"subscription.canceled",
	"subscription.updated",
] as const;

/** Union type of handled Polar webhook event types. */
type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

/** Valid subscription status values from Polar. */
let SUBSCRIPTION_STATUSES = ["active", "canceled", "past_due"] as const;

/** Union type of valid subscription statuses. */
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Type guard to check if event type is one we handle.
 * @param type - The event type string to check.
 * @returns True if the type is a handled event type.
 */
function isHandledEventType(type: string): type is HandledEventType {
	return HANDLED_EVENT_TYPES.includes(type as HandledEventType);
}

/**
 * Type guard to check if status is a valid subscription status.
 * @param status - The status string to check.
 * @returns True if the status is a valid subscription status.
 */
function isValidSubscriptionStatus(status: string | undefined): status is SubscriptionStatus {
	return status !== undefined && SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus);
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
 * Verify Polar webhook signature using HMAC-SHA256.
 * @param body - The raw request body string.
 * @param signature - The signature from the X-Polar-Signature header.
 * @param secret - The webhook secret.
 * @returns True if the signature is valid.
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

	/** Constant-time comparison to prevent timing attacks. */
	if (signature.length !== expectedSignature.length) return false;

	let result = 0;
	for (let i = 0; i < signature.length; i++) {
		result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
	}
	return result === 0;
}

/**
 * Polar webhook handler for subscription lifecycle management.
 *
 * Events handled:
 * - checkout.completed: Link subscription to tenant after checkout
 * - subscription.active: Handle subscription activation
 * - subscription.canceled: Handle subscription cancellation
 * - subscription.updated: Sync subscription status changes
 */
export default action<"POST", "/api/webhooks/polar">(async ({ db, request, logger }) => {
	let log = logger.action("/api/webhooks/polar");

	let body = await request.text();

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
});

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
