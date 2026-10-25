/**
 * The webhook strategy's destination: posts uptime's JSON body, rebuilt from the portable
 * message's `data` and `text`, signed with Standard Webhooks or, for an alert still on it,
 * the `Webhook-Signature: sha256=<hex>` header receivers verified before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message, MessageData } from "@sdxc/messaging";
import type { WebhookDelivery, WebhookOptions, WebhookSignContext } from "@sdxc/messaging/webhook";
import type { Result } from "@sdxc/result";

import { Base64, Hex, hmac } from "@sdxc/crypto";
import { MessagingError } from "@sdxc/messaging";
import { Webhook } from "@sdxc/messaging/webhook";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { WebhookSignatureScheme } from "~/database/schema";

import { incidentNote, statusWord } from "~/app/services/alerts/message";

/** The prefix Standard Webhooks puts on a base64 signing secret. */
const STANDARD_SECRET_PREFIX = "whsec_";

/**
 * The secret a Standard Webhooks library verifies an alert's deliveries with. A secret
 * already written as `whsec_<base64>` is used as it is; any other text is keyed by its
 * UTF-8 bytes, which is `whsec_` followed by that text in base64.
 *
 * @param secret - The alert's signing secret as the customer saved it.
 * @returns The `whsec_` secret to configure on the receiver.
 * @example standardWebhooksSecret("shh"); // "whsec_c2ho"
 */
export function standardWebhooksSecret(secret: string): string {
	if (secret.startsWith(STANDARD_SECRET_PREFIX)) {
		let encoded = secret.slice(STANDARD_SECRET_PREFIX.length);
		let padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
		if (encoded !== "" && isSuccess(Base64.decode(padded))) return secret;
	}
	return `${STANDARD_SECRET_PREFIX}${Base64.encode(secret)}`;
}

/** How an uptime webhook is configured: the generic destination plus its signature scheme. */
export interface UptimeWebhookOptions extends WebhookOptions {
	/**
	 * Which signature a delivery carries. The two schemes share the `webhook-signature`
	 * header name, so a delivery carries exactly one of them.
	 *
	 * @default "legacy"
	 */
	signature?: WebhookSignatureScheme;
}

/** The body every uptime webhook delivery has carried, field for field. */
export interface UptimeWebhookBody {
	monitorId: string;
	monitorType: string;
	monitorName: string;
	eventType: string;
	snapshot: MessageData;
	/** The alert as plain text: monitor, status, snapshot lines, time and dashboard link. */
	message: string;
	/** ISO 8601; the same instant the message's `Time:` line names. */
	timestamp: string;
}

/** The fields of `Message.data` the body is rebuilt from, as `alertMessage` writes them. */
const ALERT_DATA_SCHEMA = s.object({
	monitorId: s.string(),
	monitorType: s.string(),
	monitorName: s.string(),
	eventType: s.enum_(["down", "up", "degraded"]),
	dashboardUrl: s.string(),
	incident: s.optional(s.object({ sent: s.number(), suppressed: s.number() })),
});

/**
 * Posts uptime's own payload, signed with Standard Webhooks or with the legacy
 * `Webhook-Signature: sha256=<hex HMAC-SHA256 of the body>` keyed by the raw secret; an
 * empty secret sends the body unsigned.
 *
 * @example await new UptimeWebhook({ url, secret, signature: "standard-webhooks" }).send(message, { id: eventId });
 */
export class UptimeWebhook extends Webhook {
	override readonly provider: string = "uptime-webhook";

	#signature: WebhookSignatureScheme;

	/** @param options - The URL, the signing secret and the signature scheme. */
	constructor(options: UptimeWebhookOptions) {
		super(options);
		this.#signature = options.signature ?? "legacy";
	}

	/**
	 * Rebuilds the body from the message; a message carrying no alert data is posted as the
	 * portable envelope, which is what a receiver of any other message would read.
	 *
	 * @param message - A message built by `alertMessage`.
	 * @param delivery - The send time, the timestamp of a message that states none.
	 */
	override render(message: Message, delivery: WebhookDelivery): object {
		let parsed = s.parseSafe(ALERT_DATA_SCHEMA, message.data ?? {});
		if (!parsed.success) return super.render(message, delivery);

		let data = parsed.value;
		let timestamp = (message.timestamp ?? delivery.timestamp).toISOString();

		let note = data.incident ? `\n\n${incidentNote(data.incident)}` : "";
		let text = message.text ?? "";
		let snapshotText = note && text.endsWith(note) ? text.slice(0, -note.length) : text;

		let lines = [
			`Monitor: ${data.monitorName} (${data.monitorType})`,
			`Status: ${statusWord(data.eventType)}`,
			...(snapshotText === "" ? [] : [snapshotText]),
			`Time: ${timestamp}`,
			`Dashboard: ${data.dashboardUrl}`,
		];

		let body: UptimeWebhookBody = {
			monitorId: data.monitorId,
			monitorType: data.monitorType,
			monitorName: data.monitorName,
			eventType: data.eventType,
			snapshot: message.data?.["snapshot"] ?? null,
			message: `${lines.join("\n")}${note}`,
			timestamp,
		};
		return body;
	}

	/**
	 * Signs the body with the alert's scheme. Standard Webhooks covers the delivery id and
	 * timestamp too, keyed by {@link standardWebhooksSecret}; every header stays off a
	 * delivery whose alert has no secret configured.
	 *
	 * @param body - The exact text sent.
	 * @param context - The delivery id, send time and the secret read for this send.
	 */
	protected override async sign(
		body: string,
		context: WebhookSignContext,
	): Promise<Result<Headers, MessagingError>> {
		if (context.secret === "") return success(new Headers());
		if (this.#signature === "standard-webhooks") {
			return await super.sign(body, {
				...context,
				secret: standardWebhooksSecret(context.secret),
			});
		}

		let headers = new Headers();

		let mac = await hmac.sign(context.secret, body);
		if (isFailure(mac)) {
			return failure(
				new MessagingError(`${this.provider} could not sign the delivery: ${mac.error.message}`, {
					code: "invalid-destination",
					provider: this.provider,
				}),
			);
		}

		headers.set("Webhook-Signature", `sha256=${Hex.encode(mac.data)}`);
		return success(headers);
	}
}
