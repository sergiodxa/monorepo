/**
 * The webhook strategy's destination: posts the JSON body and `Webhook-Signature` header
 * customers verify today, so moving delivery onto `@sdxc/messaging` changes nothing on
 * their end. The body is rebuilt from the portable message's `data` and `text`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message, MessageData } from "@sdxc/messaging";
import type { WebhookDelivery, WebhookSignContext } from "@sdxc/messaging/webhook";
import type { Result } from "@sdxc/result";

import { Hex, hmac } from "@sdxc/crypto";
import { MessagingError } from "@sdxc/messaging";
import { Webhook } from "@sdxc/messaging/webhook";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import { incidentNote, statusWord } from "~/app/services/alert-message";

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
 * Posts uptime's own payload, signed with `Webhook-Signature: sha256=<hex HMAC-SHA256 of
 * the body>` keyed by the raw secret; an empty secret sends the body unsigned.
 *
 * @example await new UptimeWebhook({ url: config.url, secret: config.secret }).send(message, { id: eventId });
 */
export class UptimeWebhook extends Webhook {
	override readonly provider: string = "uptime-webhook";

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
	 * Signs the body with the raw secret as the HMAC key; the signature header stays off
	 * a delivery whose alert has no secret configured.
	 *
	 * @param body - The exact text sent.
	 * @param context - The secret read for this send.
	 */
	protected override async sign(
		body: string,
		context: WebhookSignContext,
	): Promise<Result<Headers, MessagingError>> {
		let headers = new Headers();
		if (context.secret === "") return success(headers);

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
