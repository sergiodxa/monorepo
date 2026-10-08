/**
 * Background job that delivers one alert to its chat, paging or webhook channel and
 * settles the `pending` event it was queued with. Retryable failures come back with
 * backoff; a destination that answers it is gone marks the alert broken for its owner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	Destination,
	Message,
	MessagingError,
	MessagingErrorCode,
	Sent,
} from "@sdxc/messaging";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { createBackoff } from "@sdxc/backoff";
import { createJobHandler } from "@sdxc/jobs";
import { supports } from "@sdxc/messaging";
import { isFailure, isSuccess } from "@sdxc/result";

import type { SelectAlertEvent } from "~/database/schema";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import jobs from "~/app/jobs";

/**
 * Deliveries one message gets: the first and the queue's three redeliveries
 * (`max_retries` in `wrangler.jsonc`). Retrying past them dead-letters the message
 * with its event still `pending`, so the job settles the event on the last one.
 */
export const MAX_ATTEMPTS = 4;

/** The wait before each redelivery a platform names no delay for: 30s, 1m, 2m, capped at 30m. */
export const RETRY_BACKOFF = createBackoff({ base: "30 seconds", max: "30 minutes", jitter: 0.2 });

/** The codes after which a recovery that failed to edit the original is sent as a message of its own. */
const UPDATE_FALLBACK_CODES: ReadonlySet<MessagingErrorCode> = new Set<MessagingErrorCode>([
	"invalid-ref",
	"rejected",
]);

export default createJobHandler(jobs.deliverAlert, async (ctx) => {
	let db: Database = ctx.database;
	let { alertId, eventId, message } = ctx.input;
	ctx.log.set({ alert: { id: alertId }, alert_event: { id: eventId } });

	let event = await AlertEvent.findById(db, eventId);
	if (!event) return ctx.ack("The alert event no longer exists");
	/** A redelivery of a run that already settled its event sends nothing twice. */
	if (event.status !== "pending") return ctx.ack(`The alert event is already ${event.status}`);

	let alert = await Alert.findById(db, alertId);
	if (!alert) {
		await AlertEvent.markFailed(db, eventId, "The alert was deleted before delivery");
		return ctx.ack("The alert no longer exists");
	}

	if (alert.config.strategy === "email") {
		await AlertEvent.markFailed(db, eventId, "The alert's channel changed to email");
		return ctx.ack("The alert's channel is delivered inline");
	}

	let destination = ctx.destinations(alert.config);
	ctx.log.set({ alert: { id: alertId, provider: destination.provider } });

	let sent = await deliver(db, destination, event, message);
	if (isSuccess(sent)) {
		await AlertEvent.markSent(db, eventId, sent.data.ref);
		return;
	}

	let error = sent.error;
	ctx.log.set({ delivery: { code: error.code, status: error.status ?? undefined } });

	if (error.retryable && ctx.attempts < MAX_ATTEMPTS) {
		ctx.retry({
			delay: error.retryAfter ?? RETRY_BACKOFF.delay(ctx.attempts),
			reason: error.message,
			cause: error,
		});
	}

	if (error.code === "gone") await Alert.markBroken(db, alert.id, error.message);
	await AlertEvent.markFailed(db, eventId, `${error.message} (${error.code})`);
	return ctx.ack(error.message);
});

/**
 * Sends the message, or for a recovery edits the incident's original message in place
 * where the platform can and the stored ref is that platform's. An edit the platform
 * refuses falls back to a send, so the recovery always reaches the channel.
 */
async function deliver(
	db: Database,
	destination: Destination,
	event: SelectAlertEvent,
	message: Message,
): Promise<Result<Sent, MessagingError>> {
	let options = { id: event.id };
	if (message.state !== "resolved" || !supports(destination, "update")) {
		return await destination.send(message, options);
	}

	let ref = await AlertEvent.refForRecovery(db, event);
	if (!ref || ref.provider !== destination.provider) {
		return await destination.send(message, options);
	}

	let updated = await destination.update(ref, message, options);
	if (isFailure(updated) && UPDATE_FALLBACK_CODES.has(updated.error.code)) {
		return await destination.send(message, options);
	}
	return updated;
}
