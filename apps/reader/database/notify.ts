/**
 * What a reader's own object does with what its scheduled check just found: the summary it
 * derives from one timestamp, the minimum gap and quiet window that decide whether it goes
 * out, the delivery itself, and what each push service response does to a device's row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";
import type { Mailer } from "@sdxc/mail";
import type { WebPushErrorCode } from "@sdxc/web-push";
import type { Database } from "remix/data-table";

import { zonedParts } from "@sdxc/dates/zone";
import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";

import type { UserModels } from "~/database/models/user";
import type { SelectPushSubscription, SelectSettings } from "~/database/schema";

import { NotificationEmail, textFrom, translationFor } from "~/app/push/copy";
import { unsubscribeUrl } from "~/app/push/unsubscribe";
import { vapidKeys } from "~/app/push/vapid";
import { NOTIFY_FEED_TITLES, PUSH_FAILURE_LIMIT } from "~/database/schema";
import routes from "~/routes/web";

/**
 * The shortest time between two interruptions on the push channel. A gap bounds
 * notifications per day however the posts are distributed, which a count threshold does
 * not, and a check inside it does nothing because the summary was never about that check.
 */
export const PUSH_GAP_MS = 15 * 60 * 1000;

/**
 * The shortest time between two emails. It is what converts the channel's cost from a
 * function of how much the world publishes into a function of how many hours are in a
 * month, which is the only form of that cost a plan price can absorb.
 */
export const EMAIL_GAP_MS = 4 * 60 * 60 * 1000;

/** The zone quiet hours are computed in when nothing has said which one the reader is in. */
export const DEFAULT_TIME_ZONE = "UTC";

/**
 * The language an email is written in. A message goes to one address rather than to one
 * browser, so there is no device whose language it could take instead.
 */
export const DEFAULT_EMAIL_LANGUAGE = "en";

/**
 * The posts this check has to have written before anybody is interrupted. One, because a
 * higher number silences the quiet feeds, which are exactly the feeds somebody who picked
 * three out of ninety-three chose.
 */
export const NOTIFY_THRESHOLD = 1;

/** How a notified feed reaches the reader. */
export type Channel = "push" | "email";

/**
 * The topic every summary is sent under, so a device that was offline receives only the
 * newest one: each summary covers everything since the last, so the older says less.
 */
export const PUSH_TOPIC = "summary";

/** Why a notification that had something to say did not go out. */
export type Suppression =
	/** Another one went out inside the minimum gap; the next check carries everything. */
	| "gap"
	/** The reader's own hours say to leave them alone; the next check outside them carries it. */
	| "quiet-hours"
	/** Feeds are opted in and no channel is on, which is a reader who thinks they configured this. */
	| "no-channel";

/** What a check found worth interrupting somebody for, as the payload carries it. */
export interface Summary {
	/** Posts this object wrote since the last notification, from opted-in feeds. */
	posts: number;
	/** How many feeds they came from. */
	feeds: number;
	/** Up to {@link NOTIFY_FEED_TITLES} of those feeds, by name. */
	titles: string[];
}

/** What one delivery to one device did to that device's row. */
export type PushOutcome =
	/** The service took it, so the count clears and the stamp moves. */
	| "accepted"
	/** The browser revoked this endpoint, so the row goes now rather than being retried. */
	| "expired"
	/** The service is busy or broken, which the count remembers. */
	| "transient"
	/**
	 * Our signature, keys or payload are wrong, which is a mistake on our side rather than a
	 * dead device, so the row stays and is not counted.
	 */
	| "rejected";

/** What the notification step did, which is what the object writes its event from. */
export interface NotifyOutcome {
	/** `true` when at least one channel accepted, which is what advances the timestamp. */
	notified: boolean;
	summary: Summary;
	/** The channels that were on, which is what a suppression of `no-channel` finds empty. */
	channels: Channel[];
	/** Devices a push reached, which is zero on every other path. */
	devices: number;
	/** Why nothing went out, or `null` when something did or when there was nothing to say. */
	suppressed: Suppression | null;
}

/** Everything the notification step reads, so nothing here reaches for a request. */
export interface NotifyInput {
	/** The reader's models, whose devices are written as each push service answers. */
	models: UserModels;
	/** The settings row as the writes before this left it. */
	row: SelectSettings;
	/** Epoch milliseconds the gap and the quiet window are measured at. */
	now: number;
	/** Whether the reader's plan sends email, decided from the tier this object stores. */
	mayEmail: boolean;
	/** A mailer over the deployment's own transport, or `null` where none is bound. */
	mailer: Mailer | null;
	/**
	 * Where this app answers, which an email's links have to be absolute against. `null`
	 * while the deployment has not named one, which keeps the channel dark rather than
	 * sending a message whose button goes nowhere.
	 */
	appUrl: string | null;
	/** The reader this object belongs to, whom an email's unsubscribe link is signed for. */
	subject: string;
	/** Where this object writes its wide events. */
	record: (kind: Log.Kind, fields: Log.Fields) => void;
}

/**
 * The posts this object wrote since the last notification, from feeds the reader opted in
 * and still follows.
 *
 * The count is of rows this object wrote rather than of what the heads implied: a head can
 * over-report, a velocity drops items on the way in, and back-pressure can pause a feed
 * entirely, so a count from anywhere else would name posts the reader does not have.
 *
 * @param db - The reader's own database.
 * @param since - Epoch milliseconds the last notification went out at.
 */
export async function summarize(db: Database, since: number): Promise<Summary> {
	let { rows = [] } = await db.exec(
		`SELECT feeds.title AS title, COUNT(*) AS posts
		 FROM feed_items
		 JOIN feeds ON feeds.id = feed_items.feed_id
		 WHERE feed_items.created_at > ? AND feeds.notify = 1 AND feeds.unfollowed_at IS NULL
		 GROUP BY feeds.id
		 ORDER BY posts DESC`,
		[since],
	);

	let posts = 0;
	let titles: string[] = [];

	for (let row of rows) {
		let { title, posts: count } = row;
		if (typeof count !== "number") continue;

		posts += count;
		if (typeof title === "string") titles.push(title);
	}

	return { posts, feeds: titles.length, titles: titles.slice(0, NOTIFY_FEED_TITLES) };
}

/**
 * The hour of the day it is where the reader is, from an IANA zone name so a daylight
 * saving change is the platform's arithmetic rather than this app's.
 *
 * A zone the platform does not recognize reads as UTC, which keeps a wrong zone to a
 * notification at an odd hour rather than one that never arrives.
 *
 * @param at - Epoch milliseconds to read the hour of.
 * @param timeZone - The IANA name the reader's browser reported.
 */
export function localHour(at: number, timeZone: string): number {
	try {
		return zonedParts(at, timeZone).hour;
	} catch {
		return new Date(at).getUTCHours();
	}
}

/**
 * Whether a moment falls inside the reader's own quiet window, which wraps midnight
 * whenever it closes on an earlier hour than it opens on.
 *
 * @param at - Epoch milliseconds to test.
 * @param row - The settings row carrying the zone and the two hours.
 */
export function insideQuietHours(at: number, row: SelectSettings): boolean {
	if (!row.quiet_hours) return false;

	let hour = localHour(at, row.time_zone || DEFAULT_TIME_ZONE);
	let { quiet_from: from, quiet_to: to } = row;

	if (from === to) return false;
	if (from < to) return hour >= from && hour < to;

	return hour >= from || hour < to;
}

/**
 * The gap the reader's enabled channels are held to, which is the longest of them: one
 * timestamp gates one notification, and a notification goes out on every channel at once,
 * so the slowest channel is what bounds the pair.
 *
 * @param channels - The channels the reader turned on.
 */
export function gapFor(channels: readonly Channel[]): number {
	let gaps = channels.map((channel) => (channel === "email" ? EMAIL_GAP_MS : PUSH_GAP_MS));
	return gaps.length === 0 ? PUSH_GAP_MS : Math.max(...gaps);
}

/**
 * What a send's failure means for the device it was about, or `accepted` for none. A `gone`
 * is the browser telling the truth and is acted on; a refused signature, a malformed row or
 * an oversized payload is our own mistake, which no device should be deleted for.
 *
 * @param code - The failure's code, or `null` when the push service took the message.
 */
export function pushOutcome(code: WebPushErrorCode | null): PushOutcome {
	if (code === null) return "accepted";
	if (code === "gone") return "expired";
	if (
		code === "rate-limited" ||
		code === "unavailable" ||
		code === "timeout" ||
		code === "network"
	) {
		return "transient";
	}

	return "rejected";
}

/**
 * Notifies the reader about everything that has arrived since the last notification, and
 * says whether anything went out.
 *
 * It resolves whatever happens. It is the last step of a check, after every row is written
 * and every cursor has advanced, so a delivery that fails costs nothing but itself and the
 * alarm re-arms unaffected.
 *
 * @param input - The models, the settings row, the clock and the mailer.
 * @example let outcome = await notify({ models, row, now: Date.now(), mayEmail, mailer, record });
 */
export async function notify(input: NotifyInput): Promise<NotifyOutcome> {
	let { models, row, now, record } = input;

	let summary = await summarize(models.posts.db, row.last_notified_at ?? 0);
	let channels = await enabledChannels(input);

	let outcome: NotifyOutcome = {
		notified: false,
		summary,
		channels,
		devices: 0,
		suppressed: null,
	};

	if (summary.posts < NOTIFY_THRESHOLD) return outcome;

	let suppression = suppressionFor(summary, channels, row, now);

	if (suppression !== null) {
		record("alarm", {
			event: "user.notify.suppressed",
			reason: suppression,
			posts: summary.posts,
		});

		outcome.suppressed = suppression;
		return outcome;
	}

	let started = now;
	let accepted = false;

	if (channels.includes("push")) {
		let delivered = await deliverPush(input, summary);
		outcome.devices = delivered.devices;
		accepted ||= delivered.accepted;
	}

	if (channels.includes("email")) accepted ||= await deliverEmail(input, summary);

	outcome.notified = accepted;

	record("alarm", {
		event: "user.notify",
		posts: summary.posts,
		feeds: summary.feeds,
		channels: channels.join(","),
		devices: outcome.devices,
		durationMs: Date.now() - started,
	});

	return outcome;
}

/**
 * The channels that can actually carry a notification: push once a device is registered,
 * email once the plan allows it, a transport is bound and sign-in has written an address.
 *
 * Enforced here rather than in the form, so a reader whose plan lapsed stops being emailed
 * without anything having to go back and clear a switch.
 */
async function enabledChannels(input: NotifyInput): Promise<Channel[]> {
	let { models, row, mayEmail, mailer, appUrl } = input;
	let channels: Channel[] = [];

	if (row.notify_push && (await models.devices.query().count()) > 0) channels.push("push");

	if (row.notify_email && mayEmail && mailer !== null && appUrl !== null && row.email) {
		channels.push("email");
	}

	return channels;
}

/**
 * Why this notification is being held rather than sent, and `null` when nothing holds it.
 *
 * A held notification advances nothing, which is what makes every one of these a deferral:
 * the next check outside the gap or outside the window carries everything since.
 */
function suppressionFor(
	summary: Summary,
	channels: readonly Channel[],
	row: SelectSettings,
	now: number,
): Suppression | null {
	if (channels.length === 0) return "no-channel";

	if (row.last_notified_at !== null && now - row.last_notified_at < gapFor(channels)) return "gap";

	if (insideQuietHours(now, row)) return "quiet-hours";

	return null;
}

/**
 * Delivers one notification to every device the reader registered, concurrently, and
 * applies each answer to the row it was about.
 *
 * It answers accepted on the first device that took it: requiring all would let one broken
 * endpoint re-notify every working one on every check, and requiring none would drop the
 * notification whenever the first send failed.
 */
async function deliverPush(
	input: NotifyInput,
	summary: Summary,
): Promise<{ accepted: boolean; devices: number }> {
	let keys = vapidKeys();
	if (keys === null) return { accepted: false, devices: 0 };

	/** One sender for the round, so devices on one push service share one VAPID signature. */
	let push = new WebPush({ vapid: keys });
	let devices = await input.models.devices.query().all();
	let accepted = 0;

	await Promise.all(
		devices.map(async (device) => {
			if (await deliverTo(input, push, device, summary)) accepted += 1;
		}),
	);

	return { accepted: accepted > 0, devices: accepted };
}

/**
 * Sends to one device and writes what came back onto its row, answering whether the push
 * service took it.
 *
 * A refusal is a value rather than a rejection, so one unreachable service cannot take the
 * notification away from the devices beside it.
 */
async function deliverTo(
	input: NotifyInput,
	push: WebPush,
	device: SelectPushSubscription,
	summary: Summary,
): Promise<boolean> {
	let { models, now, record } = input;
	let started = Date.now();

	let { t } = translationFor(device.locale);

	let payload = JSON.stringify({
		...textFrom(t, summary),
		posts: summary.posts,
		feeds: summary.feeds,
		titles: summary.titles,
		url: routes.reading.index.href(),
	});

	let sent = await push.send(
		{
			endpoint: device.endpoint,
			keys: { p256dh: device.p256dh, auth: device.auth },
			applicationServerKey: device.vapid_key ?? undefined,
		},
		payload,
		{ topic: PUSH_TOPIC },
	);

	let error = isFailure(sent) ? sent.error : null;
	let status = isFailure(sent) ? (sent.error.status ?? undefined) : sent.data.status;
	let outcome = pushOutcome(error?.code ?? null);

	if (error?.code === "payload-too-large") {
		record("alarm", {
			event: "push.rejected",
			reason: error.code,
			failureCount: device.failure_count,
		});

		return false;
	}

	record("alarm", {
		event: "push.delivered",
		status,
		code: error?.code,
		durationMs: Date.now() - started,
	});

	if (outcome === "accepted") {
		await models.devices.update({ id: device.id }, { last_delivered_at: now, failure_count: 0 });

		return true;
	}

	if (outcome === "expired") {
		record("alarm", { event: "push.expired", status, failureCount: device.failure_count });
		await models.devices.delete({ id: device.id });

		return false;
	}

	if (outcome === "rejected") {
		record("alarm", {
			event: "push.rejected",
			reason: error?.code,
			status,
			failureCount: device.failure_count,
		});
		return false;
	}

	let failures = device.failure_count + 1;

	if (failures >= PUSH_FAILURE_LIMIT) {
		record("alarm", { event: "push.expired", status, failureCount: failures });
		await models.devices.delete({ id: device.id });

		return false;
	}

	await models.devices.update({ id: device.id }, { failure_count: failures });

	return false;
}

/**
 * Sends the same summary to the address sign-in wrote, and answers whether the transport
 * took it. The mailer reports a failure as a value, so a refused send is branched on rather
 * than caught.
 */
async function deliverEmail(input: NotifyInput, summary: Summary): Promise<boolean> {
	let { mailer, row, appUrl, record, subject } = input;
	if (mailer === null || appUrl === null || !row.email) return false;

	let { t } = translationFor(DEFAULT_EMAIL_LANGUAGE);

	/** A link that cannot be signed leaves the settings page as the way out, and is recorded. */
	let unsubscribe = await unsubscribeUrl(subject, appUrl);

	let sent = await mailer.send(
		new NotificationEmail(
			row.email,
			textFrom(t, summary),
			new URL(routes.reading.index.href(), appUrl).toString(),
			{
				reason: t("notifications.email.footer"),
				unsubscribeUrl: isFailure(unsubscribe) ? null : unsubscribe.data,
				unsubscribeLabel: t("notifications.email.unsubscribe"),
				listName: t("notifications.email.listName"),
			},
		),
	);
	let ok = !isFailure(sent);

	record("alarm", {
		event: "mail.notify",
		ok,
		posts: summary.posts,
		feeds: summary.feeds,
		unsubscribe: !isFailure(unsubscribe),
	});

	return ok;
}
